import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AzureOpenAIEmbeddings } from '@langchain/openai';
import { createAzureEmbeddings } from '../common/azure-openai.config';

@Injectable()
export class PlagiarismService {
  private readonly logger = new Logger(PlagiarismService.name);
  private embeddings: AzureOpenAIEmbeddings;

  // Cache para token de Copyleaks
  private copyleaksToken: string | null = null;
  private copyleaksTokenExpiresAt: number = 0;

  // Umbral a partir del cual se considera alerta crítica
  private readonly CRITICAL_THRESHOLD = 0.85;
  private readonly WARNING_THRESHOLD = 0.70;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {
    this.embeddings = createAzureEmbeddings();
  }

  async analyzeByEmbeddings(advanceId: string): Promise<void> {
    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
      include: { program: true },
    });

    // Crear reporte inicial (limpiando el anterior si existe)
    await this.prisma.plagiarismReport.deleteMany({
      where: { advanceId },
    });

    const report = await this.prisma.plagiarismReport.create({
      data: {
        advanceId,
        overallSimilarity: 0,
        status: 'processing',
      },
    });

    // Obtener chunks del avance actual
    const sourceChunks = await this.prisma.advanceChunk.findMany({
      where: { advanceId },
    });

    if (sourceChunks.length === 0) {
      await this.prisma.plagiarismReport.update({
        where: { id: report.id },
        data: { status: 'done' },
      });
      return;
    }

    // Obtener chunks de otros avances del mismo programa (excluyendo versiones del mismo estudiante)
    const otherChunks = await this.prisma.$queryRaw<
      Array<{
        id: string;
        advanceId: string;
        sectionName: string;
        content: string;
        embedding: string;
        studentId: string;
      }>
    >`
      SELECT ac.id, ac."advanceId", ac."sectionName", ac.content,
             ac.embedding::text, a."studentId"
      FROM "AdvanceChunk" ac
      JOIN "Advance" a ON a.id = ac."advanceId"
      WHERE a."programId" = ${advance.programId}
        AND a."studentId" != ${advance.studentId}
        AND ac.embedding IS NOT NULL
      LIMIT 5000
    `;

    const alerts: Array<{
      sourceUrl: string;
      similarity: number;
      matchedText: string;
    }> = [];

    // Comparar cada chunk fuente contra todos los otros
    for (const sourceChunk of sourceChunks as any[]) {
      if (!sourceChunk.embedding) continue;

      // Usar pgvector para similitud coseno — mucho más eficiente que JS
      const similar = await this.prisma.$queryRaw<
        Array<{ advanceId: string; sectionName: string; content: string; similarity: number }>
      >`
        SELECT ac."advanceId", ac."sectionName", ac.content,
               1 - (ac.embedding <=> ${sourceChunk.embedding}::vector) AS similarity
        FROM "AdvanceChunk" ac
        JOIN "Advance" a ON a.id = ac."advanceId"
        WHERE a."programId" = ${advance.programId}
          AND a."studentId" != ${advance.studentId}
          AND ac.embedding IS NOT NULL
          AND 1 - (ac.embedding <=> ${sourceChunk.embedding}::vector) > ${this.WARNING_THRESHOLD}
        ORDER BY similarity DESC
        LIMIT 3
      `;

      for (const match of similar) {
        alerts.push({
          sourceUrl: `/advances/${match.advanceId}`,
          similarity: Math.round(match.similarity * 100) / 100,
          matchedText: sourceChunk.content.substring(0, 200),
        });
      }
    }

    // Deduplicar por targetAdvanceId + sectionName, quedarse con mayor similitud
    const deduped = this.deduplicateAlerts(alerts);
    
    // MOCK: Usar un número aleatorio entre 0 y 20 tal como pidió el usuario
    const mockSimilarity = Math.floor(Math.random() * 21);
    const overallScore = mockSimilarity;

    // Guardar alertas y actualizar reporte
    await this.prisma.$transaction([
      this.prisma.plagiarismAlert.createMany({
        data: deduped.map((a) => ({ ...a, reportId: report.id })),
      }),
      this.prisma.plagiarismReport.update({
        where: { id: report.id },
        data: {
          status: 'complete',
          overallSimilarity: overallScore,
        },
      }),
    ]);

    this.logger.log(
      `Plagio analizado (MOCK) — avance ${advanceId}: ${deduped.length} alertas, score mock ${overallScore}%`,
    );
  }

  private deduplicateAlerts(
    alerts: Array<{ sourceUrl: string; matchedText: string; similarity: number }>,
  ) {
    const map = new Map<string, typeof alerts[0]>();
    for (const alert of alerts) {
      const key = `${alert.sourceUrl}::${alert.matchedText}`;
      const existing = map.get(key);
      if (!existing || alert.similarity > existing.similarity) {
        map.set(key, alert);
      }
    }
    return Array.from(map.values());
  }

  async getSimilarityMatrix(programId: string) {
    // Retorna matriz de similitud promedio entre todos los estudiantes del programa
    const advances = await this.prisma.advance.findMany({
      where: { programId, status: 'APPROVED' },
      include: { student: { select: { id: true, name: true } } },
      distinct: ['studentId'],
    });

    const matrix: Record<string, Record<string, number>> = {};

    for (const a of advances) {
      matrix[a.student.name] = {};
      for (const b of advances) {
        if (a.id === b.id) {
          matrix[a.student.name][b.student.name] = 1.0;
          continue;
        }
        const result = await this.prisma.plagiarismAlert.findFirst({
          where: {
            report: { advanceId: a.id },
            sourceUrl: { contains: b.id },
          },
          orderBy: { similarity: 'desc' },
        });
        matrix[a.student.name][b.student.name] =
          result ? result.similarity : 0;
      }
    }

    return matrix;
  }  // Obtener token de Copyleaks con cache de expiración
  async getCopyleaksToken(): Promise<string> {
    const email = process.env.COPYLEAKS_EMAIL;
    const key = process.env.COPYLEAKS_API_KEY;

    if (!email || !key) {
      throw new Error('Copyleaks credentials not configured in environment variables');
    }

    const now = Date.now();
    if (this.copyleaksToken && this.copyleaksTokenExpiresAt > now + 5 * 60 * 1000) {
      return this.copyleaksToken;
    }

    try {
      const res = await fetch('https://id.copyleaks.com/v3/account/login/api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, key }),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Copyleaks login failed: ${res.status} - ${errText}`);
      }

      const data = (await res.json()) as { access_token: string; expire: string };
      this.copyleaksToken = data.access_token;
      this.copyleaksTokenExpiresAt = new Date(data.expire).getTime();
      return this.copyleaksToken;
    } catch (err) {
      this.logger.error('Error authenticating with Copyleaks:', err);
      throw err;
    }
  }

  // Integración real con Copyleaks API
  async analyzeWithCopyleaks(advanceId: string) {
    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
      select: { id: true, fileKey: true, fileType: true, title: true, programId: true, studentId: true, advanceType: true, assignmentId: true, version: true },
    });

    // Eliminar reportes y alertas previas de este avance si existen
    await this.prisma.plagiarismAlert.deleteMany({
      where: { report: { advanceId } },
    });
    await this.prisma.plagiarismReport.deleteMany({
      where: { advanceId },
    });

    // Crear nuevo reporte en estado procesamiento
    const report = await this.prisma.plagiarismReport.create({
      data: {
        advanceId,
        overallSimilarity: 0,
        status: 'processing',
        method: 'copyleaks',
      },
    });

    const scanId = report.id; // report.id es un CUID único de 25 caracteres, cumpliendo el límite de 36 de Copyleaks

    try {
      // Obtener buffer del archivo desde MinIO/S3
      const buffer = await this.storage.download(advance.fileKey);
      const filename = `${advance.title}.${advance.fileType}`;

      const token = await this.getCopyleaksToken();

      const webhookBaseUrl = process.env.COPYLEAKS_WEBHOOK_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const sandbox = process.env.COPYLEAKS_SANDBOX === 'true' || !process.env.COPYLEAKS_EMAIL || !process.env.COPYLEAKS_API_KEY;

      const response = await fetch(`https://api.copyleaks.com/v3/scans/submit/file/${scanId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base64: buffer.toString('base64'),
          filename,
          properties: {
            webhooks: {
              status: `${webhookBaseUrl}/webhooks/copyleaks/{STATUS}`,
            },
            aiGeneratedText: {
              detect: true,
            },
            pdf: {
              create: true,
            },
            sandbox,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Copyleaks scan submission failed: ${response.status} - ${errText}`);
      }

      // Actualizar reporte con el scanId
      await this.prisma.plagiarismReport.update({
        where: { id: report.id },
        data: { scanId },
      });

      this.logger.log(`Copyleaks scan submitted successfully: scanId=${scanId}, sandbox=${sandbox}`);
      return { reportId: report.id, scanId };
    } catch (err) {
      this.logger.error(`Failed to submit Copyleaks scan for advance ${advanceId}:`, err);
      await this.prisma.plagiarismReport.update({
        where: { id: report.id },
        data: { status: 'error' },
      });
      throw err;
    }
  }

  // Webhook que Copyleaks llama al completar el escaneo
  async handleCopyleaksWebhook(scanId: string, payload: any) {
    const report = await this.prisma.plagiarismReport.findFirst({
      where: { scanId },
    });
    if (!report) {
      this.logger.warn(`No plagiarism report found for scanId: ${scanId}`);
      return;
    }

    // Calcular similitud global
    const matched = payload.scannedDocument?.matchedWords ?? 0;
    const total = payload.scannedDocument?.totalWords ?? 1;
    const overallSimilarity = Math.round((matched / total) * 1000) / 10;

    // Calcular score de IA desde las notificaciones
    let aiScore: number | null = null;
    const alerts = payload.notifications?.alerts ?? [];
    const aiAlert = alerts.find((a: any) => a.code === 'suspected-ai-text');
    if (aiAlert) {
      aiScore = Number(aiAlert.additionalData?.aiScore ?? aiAlert.additionalData?.aiPercentage ?? 100);
    } else {
      aiScore = 0; // Si no hay alerta de sospecha, es 0%
    }

    // Actualizar reporte con los scores resumidos
    await this.prisma.plagiarismReport.update({
      where: { id: report.id },
      data: {
        overallSimilarity,
        aiScore,
      },
    });

    this.logger.log(`Copyleaks scan complete: similarity=${overallSimilarity}%, AI score=${aiScore}%. Starting Export.`);

    // Obtener los matches de plagio de los distintos repositorios
    const matches = [
      ...(payload.results?.internet ?? []),
      ...(payload.results?.database ?? []),
      ...(payload.results?.repositories ?? []),
      ...(payload.results?.batch ?? []),
    ];

    // Lanzar proceso de exportación asíncrono
    try {
      const token = await this.getCopyleaksToken();
      const webhookBaseUrl = process.env.COPYLEAKS_WEBHOOK_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
      const exportId = `export-${Date.now()}`;

      const exportResponse = await fetch(`https://api.copyleaks.com/v3/downloads/${scanId}/export/${exportId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          completionWebhook: `${webhookBaseUrl}/webhooks/copyleaks/export/completion`,
          results: matches.map((m: any) => ({
            id: m.id,
            endpoint: `${webhookBaseUrl}/webhooks/copyleaks/export/${scanId}/results/${m.id}`,
            verb: 'POST',
          })),
          pdfReport: {
            endpoint: `${webhookBaseUrl}/webhooks/copyleaks/export/${scanId}/pdf`,
            verb: 'POST',
          },
        }),
      });

      if (!exportResponse.ok) {
        const errText = await exportResponse.text();
        throw new Error(`Copyleaks export trigger failed: ${exportResponse.status} - ${errText}`);
      }

      this.logger.log(`Copyleaks export triggered for scanId=${scanId}`);
    } catch (err) {
      this.logger.error(`Failed to trigger Copyleaks export for scanId ${scanId}:`, err);
      await this.prisma.plagiarismReport.update({
        where: { id: report.id },
        data: { status: 'error' },
      });
    }
  }

  // Guardar un resultado de plagio exportado
  async saveCopyleaksPlagiarismResult(scanId: string, resultId: string, payload: any) {
    const report = await this.prisma.plagiarismReport.findFirst({
      where: { scanId },
    });
    if (!report) return;

    this.logger.log(`Copyleaks result export payload keys: ${payload ? Object.keys(payload).join(', ') : 'null'}`);
    if (payload && payload.text) {
      this.logger.log(`Copyleaks payload.text type: ${typeof payload.text}, keys/value: ${typeof payload.text === 'object' ? Object.keys(payload.text).join(', ') : payload.text}`);
    }

    let matchedText = 'Coincidencia de plagio detectada';
    if (payload && payload.text) {
      if (typeof payload.text === 'string') {
        matchedText = payload.text;
      } else if (typeof payload.text === 'object') {
        // En caso de que sea un objeto con estructura (por ejemplo, con value, o array de tokens/caracteres)
        matchedText = payload.text.value || payload.text.text || payload.text.content || JSON.stringify(payload.text);
      } else {
        matchedText = String(payload.text);
      }
    }

    // Guardar la alerta/match de plagio
    await this.prisma.plagiarismAlert.create({
      data: {
        reportId: report.id,
        similarity: payload.similarity || (payload.score?.aggregatedScore ? payload.score.aggregatedScore / 100 : 0),
        sourceUrl: payload.source?.url || payload.source?.title || 'Fuente externa',
        matchedText: matchedText.substring(0, 500),
      },
    });
  }

  // Guardar el PDF de reporte exportado
  async saveCopyleaksPdfReport(scanId: string, pdfBuffer: Buffer) {
    const report = await this.prisma.plagiarismReport.findFirst({
      where: { scanId },
      include: { advance: true },
    });
    if (!report) return;

    const folderName = report.advance.assignmentId || report.advance.advanceType;
    const reportKey = `advances/${report.advance.programId}/${report.advance.studentId}/${folderName}/v${report.advance.version}-reporte-copyleaks.pdf`;

    // Subir el reporte PDF a MinIO/S3
    await this.storage.upload(reportKey, pdfBuffer, 'application/pdf');

    // Actualizar el reporte y marcar como finalizado completamente
    await this.prisma.plagiarismReport.update({
      where: { id: report.id },
      data: {
        copyleaksReportKey: reportKey,
        status: 'complete',
      },
    });

    this.logger.log(`Copyleaks PDF report successfully saved for scanId=${scanId}`);
  }
}
