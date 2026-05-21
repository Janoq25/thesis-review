import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { StorageService } from '../storage/storage.service';
import { extractText, analyzeDocument } from '@thesis-review/ai-engine';

const prisma = new PrismaClient();
const storage = new StorageService();

export const aiWorker = new Worker(
  'ai-analysis',
  async (job: Job<{ advanceId: string }>) => {
    const { advanceId } = job.data;

    await prisma.advance.update({
      where: { id: advanceId },
      data: { status: 'AI_PROCESSING' },
    });

    console.log(`[ai-analysis worker] Iniciando procesamiento avance ${advanceId}`);

    const advance = await prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
      include: { template: true },
    });

    const fileBuffer = await storage.download(advance.fileKey);
    const text = await extractText(fileBuffer, advance.fileType as 'pdf' | 'docx');

    console.log(`[ai-analysis worker] Texto extraído (${text.length} caracteres), analizando con IA...`);
    const startTime = Date.now();
    const result = await analyzeDocument(text, advance.template.rubric, advance.advanceType);
    const processingMs = Date.now() - startTime;

    console.log(`[ai-analysis worker] Análisis completado, guardando resultados...`);

    await prisma.$transaction(async (tx) => {
      await tx.aIAnalysis.create({
        data: {
          advanceId,
          structureScore: result.structureScore,
          contentScore: result.contentScore,
          formScore: result.formScore,
          originalityScore: result.originalityScore,
          overallScore: result.overallScore,
          gradeConverted: result.gradeConverted,
          executiveSummary: result.executiveSummary,
          processingMs,
          modelUsed: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o',
          findings: {
            create: result.findings.map(f => ({
              sectionRef: f.sectionRef,
              pageRef: f.pageRef || null,
              severity: f.severity,
              description: f.description,
              correctionSteps: f.correctionSteps,
              exampleImprovement: f.exampleImprovement,
              recommendation: f.recommendation,
            })),
          },
        },
      });

      await tx.advance.update({
        where: { id: advanceId },
        data: { status: 'AI_COMPLETE' },
      });
    });

    console.log(`[ai-analysis worker] Procesamiento exitoso para avance ${advanceId}`);
  },
  { connection: { host: process.env.REDIS_HOST || 'localhost', port: 6379 }, concurrency: 4 }
);
