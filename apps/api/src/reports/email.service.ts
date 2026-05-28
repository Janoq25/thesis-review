import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PdfReportService } from './pdf-report.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private pdfService: PdfReportService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      secure: process.env.SMTP_PORT === '465',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

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

    try {
      const pdfBuffer = await this.pdfService.generateAdvanceReport(advanceId);
      
      await this.transporter.sendMail({
        from: `"Sistema de Tesis" <${process.env.SMTP_USER}>`,
        to: recipients.join(', '),
        subject: `Reporte de Avance: ${advance.title}`,
        text: options.customMessage || `Hola ${advance.student.name}, adjuntamos el reporte de tu avance.`,
        attachments: [
          {
            filename: `Reporte_${advance.title}.pdf`,
            content: pdfBuffer,
          },
        ],
      });
      
      this.logger.log(`Email enviado exitosamente para avance ${advanceId}`);
    } catch (error) {
      this.logger.error(`Error enviando email para avance ${advanceId}: ${error.message}`);
    }
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
    
    try {
      await this.transporter.sendMail({
        from: `"Alertas Tesis" <${process.env.SMTP_USER}>`,
        to: advisorEmail,
        subject: `Alerta: Bajo Cumplimiento - ${advance.student.name}`,
        text: `El estudiante ${advance.student.name} ha subido un avance con un puntaje de cumplimiento bajo (${score.toFixed(1)}%). Se recomienda revisar el documento.`,
      });
      this.logger.log(`Alerta de bajo cumplimiento enviada a ${advisorEmail}`);
    } catch (error) {
      this.logger.error(`Error enviando alerta a ${advisorEmail}: ${error.message}`);
    }
  }
}
