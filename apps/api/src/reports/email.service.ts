import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { PdfReportService } from './pdf-report.service';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(
    private prisma: PrismaService,
    private pdfService: PdfReportService,
  ) {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? 'smtp.gmail.com',
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
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
          select: { finalGrade: true, humanComment: true, status: true,
                    reviewer: { select: { name: true } } },
        },
      },
    });

    const pdf = await this.pdfService.generateAdvanceReport(advanceId);

    const recipients = options.recipients ?? [advance.student.email];
    const templateSrc = await fs.readFile(
      path.join(__dirname, 'email-templates', 'advance-report.hbs'),
      'utf-8',
    );
    const template = Handlebars.compile(templateSrc);
    const html = template({
      studentName: advance.student.name,
      program: advance.program.name,
      advanceType: advance.advanceType,
      version: advance.version,
      status: advance.status,
      aiScore: advance.aiAnalysis?.overallScore?.toFixed(1) ?? '—',
      finalGrade: advance.review?.finalGrade?.toFixed(1) ?? '—',
      reviewerName: advance.review?.reviewer?.name ?? '—',
      humanComment: advance.review?.humanComment ?? '',
      customMessage: options.customMessage ?? '',
      institution: process.env.INSTITUTION_NAME,
      year: new Date().getFullYear(),
    });

    for (const to of recipients) {
      await this.transporter.sendMail({
        from: `"${process.env.INSTITUTION_NAME}" <${process.env.SMTP_USER}>`,
        to,
        subject: `Resultado de revisión — ${advance.advanceType} v${advance.version}`,
        html,
        attachments: [
          {
            filename: `reporte-${advance.advanceType}-v${advance.version}.pdf`,
            content: pdf,
            contentType: 'application/pdf',
          },
        ],
      });
      this.logger.log(`Email enviado a ${to} para avance ${advanceId}`);
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

    await this.transporter.sendMail({
      from: `"${process.env.INSTITUTION_NAME}" <${process.env.SMTP_USER}>`,
      to: advisorEmail,
      subject: `Alerta: bajo cumplimiento en avance de ${advance.student.name}`,
      html: `
        <p>Estimado/a ${advance.student.advisor?.name},</p>
        <p>El avance <strong>${advance.advanceType} v${advance.version}</strong> de
        <strong>${advance.student.name}</strong> obtuvo un cumplimiento de IA de
        <strong>${score.toFixed(1)}%</strong>, por debajo del umbral institucional.</p>
        <p>Se recomienda una revisión prioritaria.</p>
        <p>— Sistema ThesisReview</p>
      `,
    });
  }
}
