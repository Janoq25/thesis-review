import { Worker, Job } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { FineTuningService } from '../fine-tuning/fine-tuning.service';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';

let ftService: FineTuningService;

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  ftService = app.get(FineTuningService);
})();

export const ftStatusWorker = new Worker(
  'fine-tuning-status',
  async (job: Job<{ jobId: string; datasetId: string }>) => {
    const status = await ftService.pollFineTuningJob(job.data.jobId, job.data.datasetId);

    if (status === 'queued' || status === 'running' || status === 'validating_files') {
      // Re-encolar para verificar en 5 minutos
      throw new Error('JOB_IN_PROGRESS'); // BullMQ reintentará
    }

    return { status };
  },
  {
    connection: { host: process.env.REDIS_HOST, port: 6379 },
    concurrency: 1,
    settings: {
      backoffStrategy: (attemptsMade: number) => Math.min(5 * 60_000 * attemptsMade, 30 * 60_000),
    },
  },
);

ftStatusWorker.on('failed', (job, err) => {
  if (err.message !== 'JOB_IN_PROGRESS') {
    console.error(`FT status job ${job?.id} failed permanently:`, err.message);
  }
});
