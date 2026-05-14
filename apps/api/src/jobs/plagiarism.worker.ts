import { Worker, Job } from 'bullmq';
import { PlagiarismService } from '../plagiarism/plagiarism.service';

import { PrismaService } from '../prisma/prisma.service';

const prisma = new PrismaService();
const plagiarismService = new PlagiarismService(prisma);

export const plagiarismWorker = new Worker(
  'plagiarism-analysis',
  async (job: Job<{ advanceId: string; method: 'embeddings' | 'copyleaks' }>) => {
    const { advanceId, method } = job.data;
    if (method === 'embeddings') {
      await plagiarismService.analyzeByEmbeddings(advanceId);
    }
    // Copyleaks se dispara manualmente desde el controller
  },
  { connection: { host: process.env.REDIS_HOST, port: 6379 }, concurrency: 2 },
);
