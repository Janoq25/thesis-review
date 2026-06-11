import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { PdfReportService } from "./pdf-report.service";
import * as nodemailer from "nodemailer";

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
      secure: process.env.SMTP_PORT === "465",
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
    this.logger.log(`Email de reporte solicitado para avance ${advanceId}, destinatarios: ${recipients.join(", ")}`);

    const score = advance.aiAnalysis?.overallScore ?? 0;
    const statusLabel = advance.review?.status === "APPROVED" ? "APROBADO" : advance.review?.status === "REJECTED" ? "RECHAZADO" : "PENDIENTE";
    const statusColor = advance.review?.status === "APPROVED" ? "#10B981" : advance.review?.status === "REJECTED" ? "#EF4444" : "#F59E0B";

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; color: #374151; max-width: 600px; margin: auto; border: 1px solid #E5E7EB; border-radius: 8px; overflow: hidden;">
        <div style="background-color: #185FA5; padding: 24px; text-align: center; color: white;">
          <h1 style="margin: 0; font-size: 20px;">Reporte de Evaluación de Tesis</h1>
          <p style="margin: 8px 0 0; opacity: 0.8; font-size: 14px;">${advance.program.name}</p>
        </div>
        <div style="padding: 24px;">
          <p style="font-size: 16px; margin-top: 0;">Hola <strong>${advance.student.name}</strong>,</p>
          <p>${options.customMessage || "Se ha generado el reporte integral de tu avance de tesis. Adjunto encontrarás el documento PDF con todos los detalles del análisis de IA, plagio y referencias."}</p>
          
          <div style="background-color: #F9FAFB; border-radius: 6px; padding: 16px; margin: 24px 0; border: 1px solid #E5E7EB;">
            <h2 style="font-size: 14px; margin-top: 0; color: #1F2937; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #E5E7EB; padding-bottom: 8px;">Resumen del Avance</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 10px;">
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Título:</td>
                <td style="padding: 8px 0; font-weight: 600;">${advance.title}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Cumplimiento IA:</td>
                <td style="padding: 8px 0; font-weight: 600;">${score.toFixed(1)}%</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #6B7280;">Estado de Revisión:</td>
                <td style="padding: 8px 0;"><span style="background-color: ${statusColor}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600;">${statusLabel}</span></td>
              </tr>
            </table>
          </div>

          <p style="font-size: 14px; line-height: 1.5;">Si tienes alguna duda sobre este reporte, por favor comunícate con tu asesor académico.</p>

          <p style="font-size: 13px; color: #9CA3AF; text-align: center; margin-top: 32px; border-top: 1px solid #F3F4F6; padding-top: 16px;">
            Este es un correo automático generado por el Sistema de Revisión de Tesis.<br>
            © ${new Date().getFullYear()} ThesisReview Hub
          </p>
        </div>
      </div>
    `;

    try {
      const pdfBuffer = await this.pdfService.generateAdvanceReport(advanceId);
      
      await this.transporter.sendMail({
        from: `"Sistema de Tesis" <${process.env.SMTP_USER}>`,
        to: recipients.join(", "),
        subject: `Reporte de Avance: ${advance.title}`,
        text: options.customMessage || `Hola ${advance.student.name}, adjuntamos el reporte de tu avance.`,
        html: htmlContent,
        attachments: [
          {
            filename: `Reporte_${advance.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.pdf`,
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
