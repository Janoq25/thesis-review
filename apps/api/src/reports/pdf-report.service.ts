import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import PDFDocument from "pdfkit";

@Injectable()
export class PdfReportService {
  private readonly logger = new Logger(PdfReportService.name);

  constructor(private prisma: PrismaService) {}

  async generateAdvanceReport(advanceId: string): Promise<Buffer> {
    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
      include: {
        student: { select: { name: true, email: true, advisor: { select: { name: true } } } },
        program: { select: { name: true } },
        template: { select: { name: true, version: true } },
        aiAnalysis: { include: { findings: { orderBy: { severity: "asc" } } } },
        review: { include: { reviewer: { select: { name: true } } } },
        plagiarismReport: { include: { alerts: { orderBy: { similarity: "desc" } } } },
        referenceAnalysis: { include: { references: { orderBy: { status: "asc" } } } },
      },
    });

    this.logger.log(`Generando reporte PDF profesional e integral para avance ${advanceId}`);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: "A4", bufferPages: true });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const primaryColor = "#185FA5";
      const secondaryColor = "#4B5563";
      const darkColor = "#1F2937";
      const lightBg = "#F9FAFB";
      const borderLineColor = "#E5E7EB";

      const drawHeader = (title: string) => {
        doc.fillColor(primaryColor).rect(50, 40, 495, 40).fill();
        doc.fillColor("#FFFFFF").fontSize(14).font("Helvetica-Bold").text(title, 65, 55);
        doc.fontSize(8).font("Helvetica").text("THESISREVIEW SYSTEM", 400, 58, { align: "right" });
        doc.y = 100;
      };

      const drawFooter = () => {
        const totalPages = doc.bufferedPageRange().count;
        for (let i = 0; i < totalPages; i++) {
          doc.switchToPage(i);
          doc.fillColor(secondaryColor).fontSize(8).font("Helvetica")
             .text(`Generado automáticamente por ThesisReview Hub · Página ${i + 1} de ${totalPages}`, 50, 785, { align: "center" });
        }
      };

      const drawSectionTitle = (title: string) => {
        doc.moveDown(1);
        doc.fillColor(primaryColor).font("Helvetica-Bold").fontSize(12).text(title);
        doc.strokeColor(primaryColor).lineWidth(1).moveTo(50, doc.y + 2).lineTo(545, doc.y + 2).stroke();
        doc.moveDown(1);
      };

      // PAGE 1: PORTADA
      drawHeader("REPORTE INTEGRAL DE EVALUACIÓN");
      doc.moveDown(1.5);
      doc.fillColor(darkColor).fontSize(18).font("Helvetica-Bold").text(advance.title, { align: "center" });
      doc.moveDown(2);

      doc.fillColor(lightBg).rect(50, doc.y, 495, 140).fill();
      doc.strokeColor(borderLineColor).lineWidth(1).rect(50, doc.y, 495, 140).stroke();
      
      let technicalY = doc.y + 15;
      const drawRow = (label: string, value: string) => {
        doc.fillColor(secondaryColor).font("Helvetica-Bold").fontSize(9).text(label, 70, technicalY);
        doc.fillColor(darkColor).font("Helvetica").fontSize(10).text(value, 180, technicalY);
        technicalY += 20;
      };

      drawRow("Estudiante:", advance.student.name);
      drawRow("Programa Académico:", advance.program.name);
      drawRow("Asesor a Cargo:", advance.student.advisor?.name ?? "No asignado");
      drawRow("Tipo de Avance:", `${advance.advanceType.replace("_", " ").toUpperCase()} (v${advance.version})`);
      drawRow("Plantilla / Rúbrica:", `${advance.template.name} (v${advance.template.version})`);
      drawRow("Fecha de Evaluación:", new Date().toLocaleDateString("es-PE"));

      doc.y = technicalY + 15;
      if (advance.aiAnalysis?.executiveSummary) {
        drawSectionTitle("RESUMEN EJECUTIVO");
        doc.fillColor(darkColor).font("Helvetica").fontSize(10).text(advance.aiAnalysis.executiveSummary, { align: "justify", lineGap: 3 });
      }

      // PAGE 2: MÉTRICAS
      doc.addPage();
      drawHeader("MÉTRICAS DE CALIDAD IA");
      if (advance.aiAnalysis) {
        const startY = 120;
        const cardWidth = 110;
        const drawMetric = (title: string, score: number, index: number) => {
          const x = 50 + index * (cardWidth + 15);
          doc.fillColor("#FFFFFF").rect(x, startY, cardWidth, 70).fill();
          doc.strokeColor(borderLineColor).lineWidth(1).rect(x, startY, cardWidth, 70).stroke();
          doc.fillColor(primaryColor).rect(x, startY, cardWidth, 4).fill();
          doc.fillColor(secondaryColor).font("Helvetica-Bold").fontSize(8).text(title.toUpperCase(), x + 10, startY + 15, { width: cardWidth - 20, align: "center" });
          doc.fillColor(darkColor).font("Helvetica-Bold").fontSize(20).text(`${score.toFixed(0)}%`, x, startY + 35, { width: cardWidth, align: "center" });
        };
        drawMetric("Estructura", advance.aiAnalysis.structureScore, 0);
        drawMetric("Contenido", advance.aiAnalysis.contentScore, 1);
        drawMetric("Redacción", advance.aiAnalysis.formScore, 2);
        drawMetric("Originalidad", advance.aiAnalysis.originalityScore, 3);
        doc.y = startY + 110;
        doc.fillColor("#EFF6FF").rect(50, doc.y, 495, 45).fill();
        doc.fillColor("#1E40AF").font("Helvetica-Bold").fontSize(14).text(`PUNTAJE IA CONVERTIDO: ${advance.aiAnalysis.gradeConverted.toFixed(1)} / 20`, 50, doc.y + 16, { align: "center" });
        doc.y += 80;
        drawSectionTitle("HALLAZGOS Y RECOMENDACIONES");
        advance.aiAnalysis.findings.forEach((f) => {
          if (doc.y > 700) { doc.addPage(); drawHeader("HALLAZGOS (CONT.)"); doc.y = 120; }
          const color = f.severity === "CRITICAL" ? "#B91C1C" : f.severity === "MAJOR" ? "#B45309" : "#1D4ED8";
          doc.fillColor(color).font("Helvetica-Bold").fontSize(10).text(`[${f.severity}] ${f.sectionRef}`);
          doc.fillColor(darkColor).font("Helvetica").fontSize(9).text(f.description, { align: "justify" });
          doc.fillColor(secondaryColor).font("Helvetica-Oblique").fontSize(9).text(`Recomendación: ${f.recommendation}`, { indent: 10 });
          doc.moveDown(0.8);
        });
      }

      // PAGE 3: PLAGIO
      doc.addPage();
      drawHeader("ANÁLISIS DE SIMILITUD Y PLAGIO");
      if (advance.plagiarismReport) {
        const report = advance.plagiarismReport;
        doc.moveDown(1);
        doc.fillColor("#FEF2F2").rect(50, doc.y, 230, 60).fill();
        doc.fillColor("#991B1B").font("Helvetica-Bold").fontSize(9).text("SIMILITUD TOTAL", 65, doc.y + 15);
        doc.fontSize(18).text(`${report.overallSimilarity.toFixed(1)}%`, 65, doc.y + 28);
        if (report.aiScore !== null) {
          doc.fillColor("#F5F3FF").rect(315, doc.y - 60, 230, 60).fill();
          doc.fillColor("#5B21B6").font("Helvetica-Bold").fontSize(9).text("PROBABILIDAD DE IA", 330, doc.y - 45);
          doc.fontSize(18).text(`${report.aiScore.toFixed(1)}%`, 330, doc.y - 32);
        }
        doc.y += 20;
        drawSectionTitle("FUENTES COINCIDENTES");
        report.alerts.forEach((a, i) => {
          if (doc.y > 700) { doc.addPage(); drawHeader("FUENTES (CONT.)"); doc.y = 120; }
          doc.fillColor(darkColor).font("Helvetica-Bold").fontSize(9).text(`${i+1}. Coincidencia de ${(a.similarity * 100).toFixed(1)}%`);
          doc.fillColor("#2563EB").fontSize(8).text(a.sourceUrl || "Documento Interno", { underline: true });
          doc.moveDown(0.5);
        });
      }

      // PAGE 4: REFERENCIAS
      doc.addPage();
      drawHeader("VALIDACIÓN DE REFERENCIAS (APA)");
      if (advance.referenceAnalysis) {
        drawSectionTitle("ESTADO DE BIBLIOGRAFÍA");
        const refs = advance.referenceAnalysis.references;
        doc.fillColor(lightBg).rect(50, doc.y, 495, 50).fill();
        doc.fillColor(darkColor).font("Helvetica").fontSize(10).text(`Total analizadas: ${refs.length}`, 70, doc.y + 15);
        const verified = refs.filter(r => r.status === "VERIFIED").length;
        doc.text(`Verificadas en CrossRef: ${verified}`, 70, doc.y + 30);
        doc.y += 70;
        refs.forEach(r => {
          if (doc.y > 720) { doc.addPage(); drawHeader("REFERENCIAS (CONT.)"); doc.y = 120; }
          const color = r.status === "VERIFIED" ? "#059669" : r.status === "POSSIBLE_HALLUCINATION" ? "#DC2626" : "#D97706";
          doc.fillColor(color).font("Helvetica-Bold").fontSize(8).text(`[${r.status}]`, { continued: true });
          doc.fillColor(darkColor).font("Helvetica").fontSize(8).text(` ${r.rawText}`);
          doc.moveDown(0.3);
        });
      }

      // PAGE 5: DICTAMEN
      doc.addPage();
      drawHeader("DICTAMEN FINAL DEL ASESOR");
      if (advance.review) {
        const r = advance.review;
        const color = r.status === "APPROVED" ? "#059669" : r.status === "REJECTED" ? "#DC2626" : "#D97706";
        doc.fillColor(color).rect(50, 120, 495, 50).fill();
        doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(16).text(`ESTADO: ${r.status}`, 50, 137, { align: "center" });
        doc.y = 200;
        drawSectionTitle("OBSERVACIONES DEL ASESOR");
        doc.fillColor(darkColor).font("Helvetica").fontSize(11).text(r.humanComment || "Sin comentarios adicionales.", { align: "justify" });
        doc.moveDown(4);
        const sigY = doc.y;
        doc.strokeColor(secondaryColor).lineWidth(1).moveTo(180, sigY).lineTo(370, sigY).stroke();
        doc.fillColor(darkColor).font("Helvetica-Bold").fontSize(10).text(r.reviewer.name, 50, sigY + 10, { align: "center" });
        doc.fillColor(secondaryColor).font("Helvetica").fontSize(9).text("Asesor / Docente Revisor", 50, sigY + 25, { align: "center" });
      } else {
        doc.fillColor(secondaryColor).font("Helvetica-Oblique").fontSize(12).text("Pendiente de revisión por el asesor académico.", { align: "center" });
      }

      drawFooter();
      doc.end();
    });
  }

  async generateVersionsComparison(advanceId: string): Promise<Buffer> { return Buffer.from(""); }
  async generateBatchReport(programId: string, period: string): Promise<Buffer> { return Buffer.from(""); }
  async generateStatsCsv(programId: string): Promise<string> { return ""; }
}
