import { Worker, Job } from 'bullmq';
import { AnalysisPipeline } from '@thesis/ai-engine';
import { PrismaClient } from '@prisma/client';
import { StorageService } from '../storage/storage.service';

const prisma = new PrismaClient();
const storage = new StorageService();
const pipeline = new AnalysisPipeline({
  openaiKey: process.env.OPENAI_API_KEY!,
  maxGrade: Number(process.env.MAX_GRADE ?? 20),
});

export const aiWorker = new Worker(
  'ai-analysis',
  async (job: Job<{ advanceId: string }>) => {
    const { advanceId } = job.data;

    await prisma.advance.update({
      where: { id: advanceId },
      data: { status: 'AI_PROCESSING' },
    });

    const advance = await prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
      include: { template: true },
    });

    // Descargar archivo desde S3/MinIO
    const fileBuffer = await storage.download(advance.fileKey);
    const advanceText = await pipeline.extractText(
      fileBuffer, advance.fileType as 'pdf' | 'docx'
    );

    // Generar y guardar embeddings del avance
    const chunks = await pipeline.chunkDocument(advanceText);
    const embeddings = await pipeline.generateEmbeddings(chunks);

    await prisma.$transaction(
      chunks.map((chunk, i) =>
        prisma.$executeRaw`
          INSERT INTO "AdvanceChunk" (id, "advanceId", "sectionName", content, embedding, "chunkIndex")
          VALUES (gen_random_uuid(), ${advanceId}, 'auto', ${chunk},
          ${embeddings[i]}::vector, ${i})
        `
      )
    );

    // Obtener texto del patrón
    const templateBuffer = await storage.download(advance.template.fileKey);
    const templateText = await pipeline.extractText(templateBuffer, 'docx');

    // Ejecutar análisis
    const result = await pipeline.analyze(
      advanceText,
      advance.template.extractedSchema as object,
      templateText,
      advance.advanceType,
    );

    // Guardar resultados
    await prisma.aIAnalysis.create({
      data: {
        advanceId,
        structureScore: result.scores.structure,
        contentScore: result.scores.content,
        formScore: result.scores.form,
        originalityScore: result.scores.originality,
        overallScore: result.scores.overall,
        gradeConverted: result.grade,
        executiveSummary: result.executiveSummary,
        processingMs: result.processingMs,
        modelUsed: 'gpt-4o',
        findings: {
          create: result.findings.map(f => ({
            sectionRef: f.sectionRef,
            pageRef: f.pageRef,
            severity: f.severity,
            description: f.description,
            correctionSteps: f.correctionSteps,
            exampleImprovement: f.exampleImprovement,
            recommendation: f.recommendation,
          })),
        },
      },
    });

    await prisma.advance.update({
      where: { id: advanceId },
      data: { status: 'AI_COMPLETE' },
    });
  },
  { connection: { host: process.env.REDIS_HOST, port: 6379 }, concurrency: 4 }
);
