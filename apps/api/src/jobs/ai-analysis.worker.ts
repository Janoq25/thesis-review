import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { StorageService } from '../storage/storage.service';
import { extractText, analyzeDocument } from '@thesis-review/ai-engine';
import { getRedisConnection } from '../common/redis-connection';
import { jobLog, jobError, jobWarn } from '../common/job-logger';

const SCOPE = 'ai-analysis';
const prisma = new PrismaClient();
const storage = new StorageService();

async function markAdvanceFailed(advanceId: string, reason: string) {
  jobError(SCOPE, 'Marcando avance como PENDING tras fallo definitivo', { advanceId, reason });
  await prisma.advance.update({
    where: { id: advanceId },
    data: { status: 'PENDING' },
  });
}

export const aiWorker = new Worker(
  'ai-analysis',
  async (job: Job<{ advanceId: string }>) => {
    if (job.name !== 'analyze') {
      jobWarn(SCOPE, 'Job ignorado (nombre no es analyze)', { jobId: job.id, name: job.name });
      return;
    }

    const { advanceId } = job.data;
    const startedAt = Date.now();

    jobLog(SCOPE, 'Job recibido', {
      jobId: job.id,
      advanceId,
      attempt: job.attemptsMade + 1,
      maxAttempts: job.opts.attempts ?? 1,
    });

    try {
      await prisma.advance.update({
        where: { id: advanceId },
        data: { status: 'AI_PROCESSING' },
      });
      jobLog(SCOPE, 'Estado → AI_PROCESSING', { advanceId });

      const advance = await prisma.advance.findUniqueOrThrow({
        where: { id: advanceId },
        include: { template: true },
      });

      jobLog(SCOPE, 'Avance cargado', {
        advanceId,
        advanceType: advance.advanceType,
        fileKey: advance.fileKey,
        templateId: advance.templateId,
      });

      jobLog(SCOPE, 'Descargando archivo de MinIO', { fileKey: advance.fileKey });
      const fileBuffer = await storage.download(advance.fileKey);

      jobLog(SCOPE, 'Extrayendo texto', { fileType: advance.fileType, bytes: fileBuffer.length });
      const text = await extractText(fileBuffer, advance.fileType as 'pdf' | 'docx');
      jobLog(SCOPE, 'Texto extraído', { advanceId, charCount: text.length });

      if (text.trim().length < 100) {
        throw new Error(`Texto extraído demasiado corto (${text.trim().length} caracteres)`);
      }

      // Guardar el texto en chunks (un solo chunk por ahora para simplicidad)
      await prisma.advanceChunk.deleteMany({ where: { advanceId } });
      await prisma.advanceChunk.create({
        data: {
          advanceId,
          sectionName: 'FULL_TEXT',
          content: text,
          chunkIndex: 0,
        },
      });
      jobLog(SCOPE, 'Texto guardado en AdvanceChunk', { advanceId });

      jobLog(SCOPE, 'Llamando Azure OpenAI (analyzeDocument)', {
        advanceId,
        deployment:
          process.env.AZURE_OPENAI_DEPLOYMENT_NAME ??
          process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ??
          'gpt-4o',
      });

      const aiStart = Date.now();
      const result = await analyzeDocument(text, advance.template.rubric, advance.advanceType);
      const processingMs = Date.now() - aiStart;

      // MOCK: Aleatorizar los scores tal como pidió el usuario (0-20 para la nota convertida)
      const mockGrade = Math.floor(Math.random() * 21); // 0-20
      const mockScore = (mockGrade / 20) * 100; // Mapear a 0-100 para los demás campos

      jobLog(SCOPE, 'Respuesta de IA recibida (Aplicando MOCK)', {
        advanceId,
        processingMs,
        mockGrade,
      });

      await prisma.$transaction(async (tx) => {
        const existing = await tx.aIAnalysis.findUnique({ where: { advanceId } });
        if (existing) {
          await tx.aIFinding.deleteMany({ where: { analysisId: existing.id } });
          await tx.aIAnalysis.delete({ where: { id: existing.id } });
          jobWarn(SCOPE, 'Análisis previo reemplazado', { advanceId, previousAnalysisId: existing.id });
        }

        await tx.aIAnalysis.create({
          data: {
            advanceId,
            structureScore: mockScore,
            contentScore: mockScore,
            formScore: mockScore,
            originalityScore: mockScore,
            overallScore: mockScore,
            gradeConverted: mockGrade,
            executiveSummary: result.executiveSummary,
            processingMs,
            modelUsed:
              process.env.AZURE_OPENAI_DEPLOYMENT_NAME ??
              process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ??
              'gpt-4o',
            findings: {
              create: result.findings.map((f) => ({
                sectionRef: f.sectionRef,
                pageRef: f.pageRef ?? null,
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

      jobLog(SCOPE, 'Procesamiento exitoso → AI_COMPLETE', {
        advanceId,
        totalMs: Date.now() - startedAt,
        findings: result.findings.length,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      jobError(SCOPE, 'Error en job', {
        jobId: job.id,
        advanceId,
        attempt: job.attemptsMade + 1,
        error: message,
        stack: stack?.split('\n').slice(0, 5).join(' | '),
      });
      throw err;
    }
  },
  {
    connection: getRedisConnection(),
    concurrency: 2,
  },
);

aiWorker.on('completed', (job) => {
  jobLog(SCOPE, 'Job completado en cola', {
    jobId: job.id,
    advanceId: job.data?.advanceId,
    durationMs: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : undefined,
  });
});

aiWorker.on('failed', async (job, err) => {
  const advanceId = job?.data?.advanceId;
  jobError(SCOPE, 'Job fallido en cola', {
    jobId: job?.id,
    advanceId,
    attempts: job?.attemptsMade,
    error: err?.message,
  });

  const maxAttempts = job?.opts?.attempts ?? 1;
  if (job && job.attemptsMade >= maxAttempts && advanceId) {
    await markAdvanceFailed(advanceId, err.message);
  }
});

aiWorker.on('active', (job) => {
  jobLog(SCOPE, 'Job activo', { jobId: job.id, advanceId: job.data?.advanceId });
});

jobLog(SCOPE, 'Worker registrado en cola ai-analysis (solo jobs "analyze")');
