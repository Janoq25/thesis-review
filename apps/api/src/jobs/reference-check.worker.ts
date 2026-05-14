import { Worker, Job } from 'bullmq';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { CrossRefService } from '../references/references.service';
import { PrismaService } from '../prisma/prisma.service';

let referencesService: CrossRefService;
let prisma: PrismaService;

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  referencesService = app.get(CrossRefService);
  prisma = app.get(PrismaService);
})();

export const referenceCheckWorker = new Worker(
  'reference-check',
  async (job: Job<{ advanceId: string }>) => {
    const { advanceId } = job.data;

    const chunks = await prisma.advanceChunk.findMany({
      where: { advanceId },
      select: { content: true },
    });

    if (chunks.length === 0) {
      return { skipped: true, reason: 'no_chunks' };
    }

    const fullText = chunks.map((c) => c.content).join('\n\n');
    await referencesService.analyzeReferences(advanceId, fullText);

    return { advanceId, done: true };
  },
  {
    connection: { host: process.env.REDIS_HOST || 'localhost', port: 6379 },
    concurrency: 3,
    limiter: { max: 10, duration: 60_000 }, // CrossRef rate limit
  },
);
