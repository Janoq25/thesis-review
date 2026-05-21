import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AzureOpenAIEmbeddings } from '@langchain/openai';
import { createAzureEmbeddings } from '../common/azure-openai.config';

@Injectable()
export class PlagiarismService {
  private readonly logger = new Logger(PlagiarismService.name);
  private embeddings: AzureOpenAIEmbeddings;

  // Umbral a partir del cual se considera alerta crítica
  private readonly CRITICAL_THRESHOLD = 0.85;
  private readonly WARNING_THRESHOLD = 0.70;

  constructor(private prisma: PrismaService) {
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
  }

  // Integración con Copyleaks API (MOCK - no API keys available)
  async analyzeWithCopyleaks(advanceId: string, fileBuffer: Buffer, filename: string) {
    const report = await this.prisma.plagiarismReport.create({
      data: { advanceId, overallSimilarity: 0, status: 'processing' },
    });

    const scanId = `thesis-${advanceId}-${Date.now()}`;
    
    // MOCK: Simulate API delay and directly call the webhook handler logic
    setTimeout(async () => {
      await this.handleCopyleaksWebhook(scanId, {
        scannedDocument: { matchedWords: 15, totalWords: 100 } // 15% similarity mock
      });
    }, 5000);

    await this.prisma.plagiarismReport.update({
      where: { id: report.id },
      data: { scanId },
    });

    return { reportId: report.id, scanId };
  }

  // Webhook que Copyleaks llama al completar el escaneo
  async handleCopyleaksWebhook(scanId: string, payload: any) {
    const report = await this.prisma.plagiarismReport.findFirst({
      where: { scanId },
    });
    if (!report) return;

    const overallScore = payload.scannedDocument?.matchedWords
      ? (payload.scannedDocument.matchedWords / payload.scannedDocument.totalWords) * 100
      : 0;

    await this.prisma.plagiarismReport.update({
      where: { id: report.id },
      data: {
        status: 'complete',
        overallSimilarity: Math.round(overallScore * 10) / 10,
      },
    });
  }
}
