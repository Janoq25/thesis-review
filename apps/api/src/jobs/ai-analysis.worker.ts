import { Worker, Job } from 'bullmq';
import { PrismaClient } from '@prisma/client';
import { StorageService } from '../storage/storage.service';

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

    // TODO: Integrar con @thesis/ai-engine cuando esté disponible
    // Por ahora se registra el inicio del procesamiento
    console.log(`[ai-analysis worker] Procesando avance ${advanceId}`);

    await prisma.advance.update({
      where: { id: advanceId },
      data: { status: 'AI_COMPLETE' },
    });
  },
  { connection: { host: process.env.REDIS_HOST || 'localhost', port: 6379 }, concurrency: 4 }
);
