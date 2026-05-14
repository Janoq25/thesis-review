import { Worker, Job } from 'bullmq';
import { EmailService } from '../reports/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { PdfReportService } from '../reports/pdf-report.service';

const prisma = new PrismaService();
const pdfService = new PdfReportService(prisma);
const emailService = new EmailService(prisma, pdfService);

export const emailWorker = new Worker(
  'email',
  async (job: Job<{ type: string; data: any }>) => {
    const { type, data } = job.data;
    
    if (type === 'advance_report') {
      await emailService.sendAdvanceReport(data.advanceId, { recipients: data.recipients, customMessage: data.customMessage });
    } else if (type === 'low_compliance_alert') {
      await emailService.sendLowComplianceAlert(data.advanceId);
    }
  },
  { connection: { host: process.env.REDIS_HOST, port: 6379 }, concurrency: 5 },
);
