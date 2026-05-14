import { Injectable } from '@nestjs/common';
import puppeteer from 'puppeteer';
import Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PdfReportService {
  constructor(private prisma: PrismaService) {}

  async generateAdvanceReport(advanceId: string): Promise<Buffer> {
    // Recopilar todos los datos del avance
    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
      include: {
        student: { select: { name: true, email: true } },
        program: { select: { name: true } },
        template: { select: { name: true, version: true } },
        aiAnalysis: {
          include: {
            findings: {
              orderBy: { severity: 'asc' },
            },
          },
        },
        review: {
          include: {
            reviewer: { select: { name: true } },
          },
        },
      },
    });

    const plagiarismReport = await this.prisma.plagiarismReport.findFirst({
      where: { advanceId },
      include: { alerts: { take: 5, orderBy: { similarity: 'desc' } } },
      orderBy: { createdAt: 'desc' },
    });

    const refAnalysis = await this.prisma.referenceAnalysis.findUnique({
      where: { advanceId },
      include: {
        references: {
          where: { status: { not: 'VERIFIED' } },
          take: 10,
        },
      },
    });

    // Cargar plantilla HTML
    const templatePath = path.join(__dirname, 'templates', 'advance-report.hbs');
    const templateSrc = await fs.readFile(templatePath, 'utf-8');
    const template = Handlebars.compile(templateSrc);

    // Helpers de Handlebars
    Handlebars.registerHelper('formatDate', (d: Date) =>
      new Date(d).toLocaleDateString('es-PE', {
        year: 'numeric', month: 'long', day: 'numeric',
      }),
    );
    Handlebars.registerHelper('severityClass', (s: string) => {
      const map: Record<string, string> = {
        CRITICAL: 'severity-critical',
        MAJOR: 'severity-major',
        MINOR: 'severity-minor',
        SUGGESTION: 'severity-suggestion',
      };
      return map[s] ?? '';
    });
    Handlebars.registerHelper('round', (n: number, dec: number) =>
      Number(n ?? 0).toFixed(dec ?? 1),
    );

    const html = template({
      advance,
      analysis: advance.aiAnalysis,
      findings: advance.aiAnalysis?.findings ?? [],
      review: advance.review,
      plagiarism: plagiarismReport,
      references: refAnalysis,
      generatedAt: new Date(),
      institution: process.env.INSTITUTION_NAME ?? 'Universidad',
    });

    // Generar PDF con Puppeteer
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '20mm', bottom: '20mm', left: '18mm', right: '18mm' },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-family: Arial, sans-serif; font-size: 9px; color: #6B7280;
          width: 100%; padding: 0 18mm; display: flex; justify-content: space-between;">
          <span>${process.env.INSTITUTION_NAME ?? 'Universidad'} — Sistema de Revisión de Tesis</span>
          <span>Confidencial</span>
        </div>`,
      footerTemplate: `
        <div style="font-family: Arial, sans-serif; font-size: 9px; color: #6B7280;
          width: 100%; padding: 0 18mm; display: flex; justify-content: space-between;">
          <span>Generado el <span class="date"></span></span>
          <span>Página <span class="pageNumber"></span> de <span class="totalPages"></span></span>
        </div>`,
    });

    await browser.close();
    return Buffer.from(pdf);
  }
}
