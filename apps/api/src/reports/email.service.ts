import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfReportService } from './pdf-report.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(
    private prisma: PrismaService,
    private pdfService: PdfReportService,
  ) {}

  async sendAdvanceReport(
    advanceId: string,
    options: { recipients?: string[]; customMessage?: string },
  ) {
    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
      include: {
        student: { select: { name: true, email: true } },
        program: { select: { name: true } },
        aiAnalysis: { select: { overallScore: true, gradeConverted: true } },
        review: {
          select: {
            finalGrade: true,
            humanComment: true,
            status: true,
            reviewer: { select: { name: true } },
          },
        },
      },
    });

    const recipients = options.recipients ?? [advance.student.email];
    this.logger.log(`Email de reporte solicitado para avance ${advanceId}, destinatarios: ${recipients.join(', ')}`);
    // TODO: Integrar con SMTP cuando se configure nodemailer
    this.logger.warn('EmailService: nodemailer no configurado — email no enviado');
  }

  async sendLowComplianceAlert(advanceId: string) {
    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
      include: {
        student: {
          select: { name: true, email: true, advisor: { select: { name: true, email: true } } },
        },
        aiAnalysis: { select: { overallScore: true } },
      },
    });

    const advisorEmail = advance.student.advisor?.email;
    if (!advisorEmail) return;

    const score = advance.aiAnalysis?.overallScore ?? 0;
    this.logger.warn(
      `EmailService: alerta de bajo cumplimiento (${score.toFixed(1)}%) para avance ${advanceId} — email no enviado (SMTP no configurado)`,
    );
  }
}
