import { Worker, Job } from 'bullmq';
import { PdfReportService } from '../reports/pdf-report.service';
import { PrismaService } from '../prisma/prisma.service';

const prisma = new PrismaService();
const pdfService = new PdfReportService(prisma);

export const pdfGenerationWorker = new Worker(
  'pdf-generation',
  async (job: Job<{ advanceId: string }>) => {
    const { advanceId } = job.data;
    await pdfService.generateAdvanceReport(advanceId);
    // En un caso real el PDF podría subirse a S3 o MinIO aquí.
  },
  { connection: { host: process.env.REDIS_HOST, port: 6379 }, concurrency: 2 },
);
