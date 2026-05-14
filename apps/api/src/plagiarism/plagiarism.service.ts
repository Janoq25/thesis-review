import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIEmbeddings } from '@langchain/openai';

@Injectable()
export class PlagiarismService {
  private readonly logger = new Logger(PlagiarismService.name);
  private embeddings: OpenAIEmbeddings;

  // Umbral a partir del cual se considera alerta crítica
  private readonly CRITICAL_THRESHOLD = 0.85;
  private readonly WARNING_THRESHOLD = 0.70;

  constructor(private prisma: PrismaService) {
    this.embeddings = new OpenAIEmbeddings({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'text-embedding-3-large',
    });
  }

  async analyzeByEmbeddings(advanceId: string): Promise<void> {
    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
      include: { program: true },
    });

    // Crear reporte inicial
    const report = await this.prisma.plagiarismReport.create({
      data: {
        advanceId,
        method: 'EMBEDDINGS_COSINE',
        overallScore: 0,
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
      targetAdvanceId: string;
      sectionName: string;
      similarity: number;
      sourceSnippet: string;
      targetSnippet: string;
      severity: string;
    }> = [];

    // Comparar cada chunk fuente contra todos los otros
    for (const sourceChunk of sourceChunks) {
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
        const severity =
          match.similarity >= this.CRITICAL_THRESHOLD ? 'critical' : 'warning';

        alerts.push({
          targetAdvanceId: match.advanceId,
          sectionName: sourceChunk.sectionName,
          similarity: Math.round(match.similarity * 100) / 100,
          sourceSnippet: sourceChunk.content.substring(0, 200),
          targetSnippet: match.content.substring(0, 200),
          severity,
        });
      }
    }

    // Deduplicar por targetAdvanceId + sectionName, quedarse con mayor similitud
    const deduped = this.deduplicateAlerts(alerts);
    const overallScore = deduped.length > 0
      ? Math.max(...deduped.map((a) => a.similarity)) * 100
      : 0;

    // Guardar alertas y actualizar reporte
    await this.prisma.$transaction([
      this.prisma.plagiarismAlert.createMany({
        data: deduped.map((a) => ({ ...a, reportId: report.id })),
      }),
      this.prisma.plagiarismReport.update({
        where: { id: report.id },
        data: {
          status: 'done',
          overallScore: Math.round(overallScore * 10) / 10,
        },
      }),
    ]);

    this.logger.log(
      `Plagio analizado — avance ${advanceId}: ${deduped.length} alertas, score máx ${overallScore.toFixed(1)}%`,
    );
  }

  private deduplicateAlerts(
    alerts: Array<{ targetAdvanceId: string; sectionName: string; similarity: number; [k: string]: any }>,
  ) {
    const map = new Map<string, typeof alerts[0]>();
    for (const alert of alerts) {
      const key = `${alert.targetAdvanceId}::${alert.sectionName}`;
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
            targetAdvanceId: b.id,
          },
          orderBy: { similarity: 'desc' },
        });
        matrix[a.student.name][b.student.name] =
          result ? result.similarity : 0;
      }
    }

    return matrix;
  }

  // Integración con Copyleaks API (externo)
  async analyzeWithCopyleaks(advanceId: string, fileBuffer: Buffer, filename: string) {
    const report = await this.prisma.plagiarismReport.create({
      data: { advanceId, method: 'COPYLEAKS_API', overallScore: 0, status: 'processing' },
    });

    // Iniciar escaneo en Copyleaks
    const scanId = `thesis-${advanceId}-${Date.now()}`;
    const base64Content = fileBuffer.toString('base64');

    const response = await fetch(
      `https://api.copyleaks.com/v3/businesses/submit/file/${scanId}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${process.env.COPYLEAKS_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          base64: base64Content,
          filename,
          properties: {
            webhooks: {
              status: `${process.env.API_PUBLIC_URL}/webhooks/copyleaks/{STATUS}`,
            },
            sensitiveDataProtection: { copyleaksDb: false }, // no almacenar en BD de CL
          },
        }),
      },
    );

    if (!response.ok) {
      await this.prisma.plagiarismReport.update({
        where: { id: report.id },
        data: { status: 'failed' },
      });
      throw new Error(`Copyleaks error: ${response.status}`);
    }

    await this.prisma.plagiarismReport.update({
      where: { id: report.id },
      data: { externalId: scanId },
    });

    return { reportId: report.id, scanId };
  }

  // Webhook que Copyleaks llama al completar el escaneo
  async handleCopyleaksWebhook(scanId: string, payload: any) {
    const report = await this.prisma.plagiarismReport.findFirst({
      where: { externalId: scanId },
    });
    if (!report) return;

    const overallScore = payload.scannedDocument?.matchedWords
      ? (payload.scannedDocument.matchedWords / payload.scannedDocument.totalWords) * 100
      : 0;

    await this.prisma.plagiarismReport.update({
      where: { id: report.id },
      data: {
        status: 'done',
        overallScore: Math.round(overallScore * 10) / 10,
      },
    });
  }
}
