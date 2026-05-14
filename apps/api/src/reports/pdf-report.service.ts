import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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

    // Generar HTML básico
    const html = `
      <html><body>
        <h1>Reporte de Avance: ${advance.title}</h1>
        <p>Estudiante: ${advance.student.name}</p>
        <p>Programa: ${advance.program.name}</p>
        <p>Estado: ${advance.status}</p>
      </body></html>
    `;

    // TODO: Usar puppeteer cuando esté instalado
    this.logger.log(`Generando reporte PDF para avance ${advanceId}`);
    return Buffer.from(html, 'utf-8');
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
