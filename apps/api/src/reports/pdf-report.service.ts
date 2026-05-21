import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import PDFDocument from 'pdfkit';

@Injectable()
export class PdfReportService {
  private readonly logger = new Logger(PdfReportService.name);

  constructor(private prisma: PrismaService) {}

  async generateAdvanceReport(advanceId: string): Promise<Buffer> {
    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
      include: {
        student: { select: { name: true, email: true } },
        program: { select: { name: true } },
        template: { select: { name: true, version: true } },
        aiAnalysis: { include: { findings: { orderBy: { severity: 'asc' } } } },
        review: { include: { reviewer: { select: { name: true } } } },
      },
    });

    this.logger.log(`Generando reporte PDF profesional para avance ${advanceId}`);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // --- Encabezado ---
      doc.fontSize(20).text('REPORTE DE EVALUACIÓN DE TESIS', { align: 'center' });
      doc.moveDown();
      
      // --- Información General ---
      doc.fontSize(12).font('Helvetica-Bold').text('Información del Avance');
      doc.font('Helvetica').fontSize(10);
      doc.text(`Título: ${advance.title}`);
      doc.text(`Estudiante: ${advance.student.name}`);
      doc.text(`Programa: ${advance.program.name}`);
      doc.text(`Tipo: ${advance.advanceType}`);
      doc.text(`Versión: v${advance.version}`);
      doc.text(`Fecha: ${new Date().toLocaleDateString()}`);
      doc.moveDown();

      // --- Resultados de la IA ---
      if (advance.aiAnalysis) {
        doc.fontSize(12).font('Helvetica-Bold').text('Resultados de Evaluación IA');
        doc.font('Helvetica').fontSize(10);
        doc.text(`Puntaje de Estructura: ${advance.aiAnalysis.structureScore}%`);
        doc.text(`Puntaje de Contenido: ${advance.aiAnalysis.contentScore}%`);
        doc.text(`Puntaje de Forma: ${advance.aiAnalysis.formScore}%`);
        doc.text(`Puntaje de Originalidad: ${advance.aiAnalysis.originalityScore}%`);
        doc.moveDown();
        doc.fontSize(14).fillColor('#185FA5').text(`NOTA CONVERTIDA: ${advance.aiAnalysis.gradeConverted.toFixed(1)} / 20`);
        doc.fillColor('black');
        doc.moveDown();

        doc.fontSize(12).font('Helvetica-Bold').text('Hallazgos Detectados');
        advance.aiAnalysis.findings.forEach((finding, i) => {
          doc.moveDown(0.5);
          doc.fontSize(10).font('Helvetica-Bold').text(`${i + 1}. [${finding.severity}] ${finding.sectionRef}`);
          doc.font('Helvetica').text(finding.description);
          doc.fontSize(9).fillColor('#666666').text(`Sugerencia: ${finding.recommendation}`);
          doc.fillColor('black');
        });
      }

      // --- Resumen Ejecutivo ---
      if (advance.aiAnalysis?.executiveSummary) {
        doc.addPage();
        doc.fontSize(12).font('Helvetica-Bold').text('Resumen Ejecutivo');
        doc.font('Helvetica').fontSize(10).text(advance.aiAnalysis.executiveSummary);
      }

      doc.end();
    });
  }

  async generateVersionsComparison(advanceId: string): Promise<Buffer> {
    this.logger.log(`Generando comparación de versiones para avance ${advanceId}`);
    return Buffer.from(`<html><body><h1>Comparación de versiones - ${advanceId}</h1></body></html>`, 'utf-8');
  }

  async generateBatchReport(programId: string, period: string): Promise<Buffer> {
    this.logger.log(`Generando reporte batch para programa ${programId}, período ${period}`);
    return Buffer.from(`<html><body><h1>Reporte Batch - ${programId} - ${period}</h1></body></html>`, 'utf-8');
  }

  async generateStatsCsv(programId: string): Promise<string> {
    const advances = await this.prisma.advance.findMany({
      where: { programId },
      include: {
        student: { select: { name: true } },
        aiAnalysis: { select: { overallScore: true } },
        review: { select: { finalGrade: true, status: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const header = 'Estudiante,Título,Estado,Puntaje IA,Calificación Final,Fecha\n';
    const rows = advances.map((a) =>
      [
        a.student.name,
        `"${a.title}"`,
        a.status,
        a.aiAnalysis?.overallScore?.toFixed(1) ?? '',
        a.review?.finalGrade?.toFixed(1) ?? '',
        a.createdAt.toISOString().split('T')[0],
      ].join(','),
    );

    return header + rows.join('\n');
  }
}
