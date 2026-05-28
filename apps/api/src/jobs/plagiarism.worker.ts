import { Worker, Job } from 'bullmq';
import { PlagiarismService } from '../plagiarism/plagiarism.service';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

const prisma = new PrismaService();
const storage = new StorageService();
const plagiarismService = new PlagiarismService(prisma, storage);

export const plagiarismWorker = new Worker(
  'plagiarism-analysis',
  async (job: Job<{ advanceId: string; method: 'embeddings' | 'copyleaks' }>) => {
    const { advanceId, method } = job.data;
    if (method === 'copyleaks') {
      await plagiarismService.analyzeWithCopyleaks(advanceId);
    } else if (method === 'embeddings') {
      await plagiarismService.analyzeByEmbeddings(advanceId);
    }
  },
  { connection: { host: process.env.REDIS_HOST, port: 6379 }, concurrency: 2 },
);
