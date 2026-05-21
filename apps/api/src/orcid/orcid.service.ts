import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AzureChatOpenAI } from '@langchain/openai';
import { createAzureChatLLM } from '../common/azure-openai.config';
import * as crypto from 'crypto';

const ORCID_BASE = 'https://pub.orcid.org/v3.0';
const ORCID_AUTH = 'https://orcid.org/oauth';

@Injectable()
export class OrcidService {
  private readonly logger = new Logger(OrcidService.name);
  private llm: AzureChatOpenAI;

  constructor(private prisma: PrismaService) {
    this.llm = createAzureChatLLM(
      process.env.AZURE_OPENAI_CHAT_MINI_DEPLOYMENT ?? 'gpt-4o-mini',
    );
  }

  // Paso 1: Generar URL de autorización OAuth ORCID
  getAuthorizationUrl(userId: string): string {
    const state = crypto.randomBytes(16).toString('hex');
    const params = new URLSearchParams({
      client_id: process.env.ORCID_CLIENT_ID!,
      response_type: 'code',
      scope: '/authenticate /read-limited',
      redirect_uri: `${process.env.API_PUBLIC_URL}/orcid/callback`,
      state: `${userId}:${state}`,
    });
    return `${ORCID_AUTH}/authorize?${params.toString()}`;
  }

  // Paso 2: Callback OAuth — intercambiar código por tokens
  async handleOAuthCallback(code: string, state: string): Promise<void> {
    const [userId] = state.split(':');

    const tokenRes = await fetch(`${ORCID_AUTH}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.ORCID_CLIENT_ID!,
        client_secret: process.env.ORCID_CLIENT_SECRET!,
        grant_type: 'authorization_code',
        code,
        redirect_uri: `${process.env.API_PUBLIC_URL}/orcid/callback`,
      }),
    });

    const tokenData = await tokenRes.json();

    // Guardar perfil básico
    await this.prisma.orcidProfile.upsert({
      where: { userId },
      create: {
        userId,
        orcidId: tokenData.orcid,
        accessToken: this.encrypt(tokenData.access_token),
        refreshToken: this.encrypt(tokenData.refresh_token),
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        name: tokenData.name,
      },
      update: {
        accessToken: this.encrypt(tokenData.access_token),
        refreshToken: this.encrypt(tokenData.refresh_token),
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      },
    });

    // Sincronizar publicaciones en background
    await this.syncPublications(userId);
  }

  // Sincronizar publicaciones desde ORCID API
  async syncPublications(userId: string): Promise<void> {
    const profile = await this.prisma.orcidProfile.findUniqueOrThrow({
      where: { userId },
    });

    const accessToken = this.decrypt(profile.accessToken);

    // Obtener lista de works
    const worksRes = await fetch(`${ORCID_BASE}/${profile.orcidId}/works`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/vnd.orcid+json',
      },
    });

    const worksData = await worksRes.json();
    const groups: any[] = worksData?.group ?? [];

    // Para cada trabajo, obtener detalle
    const publications: Array<{
      putCode: string;
      title: string;
      journal: string | null;
      year: number | null;
      doi: string | null;
      workType: string | null;
      url: string | null;
    }> = [];

    for (const group of groups.slice(0, 50)) { // máx 50 publicaciones
      const summary = group['work-summary']?.[0];
      if (!summary) continue;

      const putCode = String(summary['put-code']);
      const title = summary.title?.title?.value ?? '';
      const year = summary['publication-date']?.year?.value
        ? Number(summary['publication-date'].year.value)
        : null;
      const journal = summary['journal-title']?.value ?? null;
      const doi = summary['external-ids']?.['external-id']?.find(
        (e: any) => e['external-id-type'] === 'doi',
      )?.['external-id-value'] ?? null;

      publications.push({
        putCode,
        title,
        journal,
        year,
        doi,
        workType: summary.type ?? null,
        url: doi ? `https://doi.org/${doi}` : null,
      });
    }

    // Extraer keywords de publicaciones con IA (Opcional, pero no las guardamos en DB)
    const keywords = await this.extractExpertiseKeywords(
      publications.map((p) => p.title),
    );

    // Guardar todo en BD en el campo works (Json)
    await this.prisma.orcidProfile.update({
      where: { id: profile.id },
      data: { works: publications as any },
    });

    this.logger.log(`ORCID sincronizado — usuario ${userId}: ${publications.length} publicaciones`);
  }

  // Calcular compatibilidad asesor-tesis basándose en keywords ORCID vs texto del avance
  async calculateCompatibility(
    advisorId: string,
    advanceText: string,
  ): Promise<{ score: number; matchedKeywords: string[] }> {
    const profile = await this.prisma.orcidProfile.findUnique({
      where: { userId: advisorId },
    });

    if (!profile) return { score: 0, matchedKeywords: [] };

    // Si tuviéramos keywords guardados. Como no hay, extraemos de sus titles de works.
    const works: any[] = (profile.works as any[]) || [];
    const titles = works.map((w) => w.title);
    const advisorKeywords = (await this.extractExpertiseKeywords(titles)).map(k => k.toLowerCase());

    // Extraer keywords del avance
    const advanceKeywordsRes = await this.llm.invoke([
      {
        role: 'system',
        content:
          'Extrae entre 5 y 15 conceptos clave del texto académico. ' +
          'Responde solo con JSON: {"keywords": [...]}',
      },
      { role: 'user', content: advanceText.substring(0, 2000) },
    ]);

    const advanceKeywords: string[] = JSON.parse(
      advanceKeywordsRes.content as string,
    ).keywords.map((k: string) => k.toLowerCase());

    // Intersección
    const matched = advanceKeywords.filter((k) =>
      advisorKeywords.some(
        (ak) => ak.includes(k) || k.includes(ak) || this.levenshtein(ak, k) <= 2,
      ),
    );

    const score = Math.min(
      100,
      Math.round((matched.length / Math.max(advanceKeywords.length, 1)) * 100 * 1.5),
    );

    return { score, matchedKeywords: matched };
  }

  private async extractExpertiseKeywords(titles: string[]): Promise<string[]> {
    if (!titles.length) return [];
    const combined = titles.slice(0, 20).join('. ');
    const res = await this.llm.invoke([
      {
        role: 'system',
        content:
          'A partir de estos títulos de publicaciones académicas, extrae entre 8 y 20 áreas temáticas de expertise del investigador. ' +
          'Sé específico (ej: "machine learning", "aprendizaje adaptativo", no "educación"). ' +
          'Responde solo con JSON: {"keywords": [...]}',
      },
      { role: 'user', content: combined },
    ]);

    return JSON.parse(res.content as string).keywords ?? [];
  }

  private levenshtein(a: string, b: string): number {
    const dp = Array.from({ length: a.length + 1 }, (_, i) =>
      Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
    );
    for (let i = 1; i <= a.length; i++)
      for (let j = 1; j <= b.length; j++)
        dp[i][j] =
          a[i - 1] === b[j - 1]
            ? dp[i - 1][j - 1]
            : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    return dp[a.length][b.length];
  }

  private encrypt(text: string): string {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(process.env.ENCRYPTION_KEY || '12345678901234567890123456789012', 'utf8');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
    return iv.toString('hex') + ':' + cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
  }

  private decrypt(encrypted: string): string {
    const [ivHex, enc] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const key = Buffer.from(process.env.ENCRYPTION_KEY || '12345678901234567890123456789012', 'utf8');
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    return decipher.update(enc, 'hex', 'utf8') + decipher.final('utf8');
  }

  private async getValidAccessToken(profileId: string): Promise<string> {
    const profile = await this.prisma.orcidProfile.findUniqueOrThrow({
      where: { id: profileId },
    });

    // Si el token expira en menos de 5 minutos, renovarlo
    const fiveMin = new Date(Date.now() + 5 * 60_000);
    if (profile.expiresAt > fiveMin) {
      return this.decrypt(profile.accessToken);
    }

    // Renovar usando refresh token
    const refreshToken = this.decrypt(profile.refreshToken);
    const tokenRes = await fetch(`${ORCID_AUTH}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.ORCID_CLIENT_ID!,
        client_secret: process.env.ORCID_CLIENT_SECRET!,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    });

    if (!tokenRes.ok) {
      // Token expirado definitivamente — marcar para re-auth
      await this.prisma.orcidProfile.update({
        where: { id: profileId },
        data: { accessToken: '', expiresAt: new Date(0) },
      });
      throw new Error('ORCID token expirado — el usuario debe re-autenticarse');
    }

    const tokenData = await tokenRes.json();
    await this.prisma.orcidProfile.update({
      where: { id: profileId },
      data: {
        accessToken: this.encrypt(tokenData.access_token),
        refreshToken: this.encrypt(tokenData.refresh_token),
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
      },
    });

    return tokenData.access_token;
  }

}