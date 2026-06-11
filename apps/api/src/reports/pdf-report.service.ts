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

    this.logger.log(`Generando reporte PDF profesional detallado para avance ${advanceId}`);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ 
        margin: 50, 
        size: "A4", 
        bufferPages: true,
        autoFirstPage: true 
      });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const colors = {
        primary: "#185FA5",
        secondary: "#4B5563",
        dark: "#1F2937",
        lightBg: "#F9FAFB",
        border: "#E5E7EB",
        critical: "#B91C1C",
        major: "#B45309",
        minor: "#1D4ED8",
        success: "#059669"
      };

      const drawHeader = (title: string) => {
        doc.fillColor(colors.primary).rect(0, 0, 595.28, 80).fill();
        doc.fillColor("#FFFFFF").fontSize(16).font("Helvetica-Bold").text(title, 50, 32);
        doc.fontSize(8).font("Helvetica").text("PLATAFORMA DE GESTIÓN ACADÉMICA", 50, 55);
        doc.text("THESISREVIEW HUB", 400, 55, { align: "right", width: 145 });
        doc.y = 110;
      };

      const drawSectionTitle = (title: string) => {
        doc.moveDown(1.5);
        const currentY = doc.y;
        doc.fillColor(colors.primary).font("Helvetica-Bold").fontSize(13).text(title.toUpperCase());
        doc.strokeColor(colors.primary).lineWidth(1.5).moveTo(50, currentY + 18).lineTo(545, currentY + 18).stroke();
        doc.moveDown(1);
      };

      // --- PAGE 1: PORTADA ---
      drawHeader("REPORTE INTEGRAL DE EVALUACIÓN");

      doc.moveDown(1);
      doc.fillColor(colors.dark).fontSize(20).font("Helvetica-Bold").text(advance.title, { align: "center" });
      doc.moveDown(2);

      // FICHA TÉCNICA
      doc.fillColor(colors.lightBg).rect(50, doc.y, 495, 160).fill();
      doc.strokeColor(colors.border).lineWidth(1).rect(50, doc.y, 495, 160).stroke();
      
      let ty = doc.y + 20;
      const row = (l: string, v: string) => {
        doc.fillColor(colors.secondary).font("Helvetica-Bold").fontSize(10).text(l, 75, ty);
        doc.fillColor(colors.dark).font("Helvetica").fontSize(11).text(v, 200, ty);
        ty += 22;
      };

      row("Estudiante:", advance.student.name);
      row("Programa:", advance.program.name);
      row("Asesor:", advance.student.advisor?.name ?? "No asignado");
      row("Tipo de Avance:", `${advance.advanceType.replace("_", " ").toUpperCase()} (v${advance.version})`);
      row("Plantilla:", `${advance.template.name}`);
      row("Fecha Reporte:", new Date().toLocaleDateString("es-PE"));

      doc.y = ty + 20;

      if (advance.aiAnalysis?.executiveSummary) {
        drawSectionTitle("Resumen Ejecutivo de la Evaluación");
        doc.fillColor(colors.dark).font("Helvetica").fontSize(10.5).text(advance.aiAnalysis.executiveSummary, { align: "justify", lineGap: 3 });
      }

      // --- PAGE 2: ANÁLISIS DE CALIDAD IA ---
      doc.addPage();
      drawHeader("I. ANÁLISIS DE CALIDAD POR IA");

      if (advance.aiAnalysis) {
        // Tarjetas de Métricas
        const cardW = 110;
        const cardH = 75;
        const startY = doc.y;
        
        const metric = (t: string, s: number, i: number) => {
          const x = 50 + i * (cardW + 15);
          doc.fillColor("#FFFFFF").rect(x, startY, cardW, cardH).fill();
          doc.strokeColor(colors.border).lineWidth(1).rect(x, startY, cardW, cardH).stroke();
          doc.fillColor(colors.primary).rect(x, startY, cardW, 5).fill();
          doc.fillColor(colors.secondary).font("Helvetica-Bold").fontSize(8).text(t, x, startY + 18, { width: cardW, align: "center" });
          doc.fillColor(colors.dark).font("Helvetica-Bold").fontSize(22).text(`${s.toFixed(0)}%`, x, startY + 38, { width: cardW, align: "center" });
        };

        metric("ESTRUCTURA", advance.aiAnalysis.structureScore, 0);
        metric("CONTENIDO", advance.aiAnalysis.contentScore, 1);
        metric("REDACCIÓN", advance.aiAnalysis.formScore, 2);
        metric("ORIGINALIDAD", advance.aiAnalysis.originalityScore, 3);

        doc.y = startY + cardH + 30;
        doc.fillColor("#EFF6FF").rect(50, doc.y, 495, 50).fill();
        doc.fillColor("#1E40AF").font("Helvetica-Bold").fontSize(15).text(`PUNTAJE GLOBAL IA: ${advance.aiAnalysis.gradeConverted.toFixed(1)} / 20.0`, 50, doc.y + 18, { align: "center" });

        doc.y += 80;
        drawSectionTitle("Hallazgos Detallados de la IA");

        advance.aiAnalysis.findings.forEach((f, idx) => {
          if (doc.y > 680) { doc.addPage(); drawHeader("I. ANÁLISIS IA (CONTINUACIÓN)"); doc.y = 110; }
          
          const sevColor = f.severity === "CRITICAL" ? colors.critical : f.severity === "MAJOR" ? colors.major : colors.minor;
          doc.fillColor(sevColor).font("Helvetica-Bold").fontSize(10).text(`${idx + 1}. [${f.severity}] - Sección: ${f.sectionRef}`);
          
          doc.fillColor(colors.dark).font("Helvetica-Bold").fontSize(9).text("Observación: ", { continued: true });
          doc.font("Helvetica").text(f.description, { align: "justify" });
          
          doc.font("Helvetica-Bold").text("Pasos de corrección: ", { continued: true });
          doc.font("Helvetica").text(f.correctionSteps);
          
          if (f.exampleImprovement) {
            doc.fillColor(colors.success).font("Helvetica-Oblique").fontSize(9).text(`Ejemplo sugerido: "${f.exampleImprovement}"`, { indent: 15 });
          }
          
          doc.fillColor(colors.secondary).font("Helvetica-Bold").fontSize(9).text("Recomendación final: ", { continued: true });
          doc.font("Helvetica").text(f.recommendation);
          
          doc.moveDown(1);
          doc.strokeColor(colors.border).lineWidth(0.5).moveTo(70, doc.y).lineTo(525, doc.y).stroke();
          doc.moveDown(0.5);
        });
      }

      // --- PAGE 3: SIMILITUD Y PLAGIO ---
      doc.addPage();
      drawHeader("II. ANÁLISIS DE SIMILITUD (COPYLEAKS)");

      if (advance.plagiarismReport) {
        const p = advance.plagiarismReport;
        
        doc.fillColor(p.overallSimilarity > 25 ? "#FEF2F2" : "#F0FDF4").rect(50, doc.y, 235, 70).fill();
        doc.fillColor(p.overallSimilarity > 25 ? colors.critical : colors.success).font("Helvetica-Bold").fontSize(10).text("ÍNDICE DE SIMILITUD", 65, doc.y + 15);
        doc.fontSize(24).text(`${p.overallSimilarity.toFixed(1)}%`, 65, doc.y + 32);

        if (p.aiScore !== null) {
          doc.fillColor("#F5F3FF").rect(310, doc.y - 70, 235, 70).fill();
          doc.fillColor("#5B21B6").font("Helvetica-Bold").fontSize(10).text("PROBABILIDAD DE TEXTO POR IA", 325, doc.y - 55);
          doc.fontSize(24).text(`${p.aiScore.toFixed(1)}%`, 325, doc.y - 38);
        }

        doc.y += 30;
        drawSectionTitle("Fuentes de Coincidencia Detectadas");

        if (p.alerts && p.alerts.length > 0) {
          p.alerts.forEach((a, i) => {
            if (doc.y > 680) { doc.addPage(); drawHeader("II. SIMILITUD (CONTINUACIÓN)"); doc.y = 110; }
            
            doc.fillColor(colors.dark).font("Helvetica-Bold").fontSize(10).text(`${i + 1}. Coincidencia del ${(a.similarity * 100).toFixed(1)}%`);
            doc.fillColor("#2563EB").fontSize(9).text(`URL: ${a.sourceUrl || "Base de datos interna"}`, { underline: true });
            
            if (a.matchedText) {
              doc.fillColor(colors.secondary).font("Helvetica-Oblique").fontSize(8.5).text(`Fragmento detectado: "${a.matchedText.substring(0, 300)}..."`, { indent: 10, lineGap: 2 });
            }
            doc.moveDown(1);
          });
        } else {
          doc.fillColor(colors.secondary).font("Helvetica-Oblique").fontSize(11).text("No se detectaron fuentes de similitud por encima del umbral permitido.");
        }
      }

      // --- PAGE 4: REFERENCIAS BIBLIOGRÁFICAS ---
      doc.addPage();
      drawHeader("III. VERIFICACIÓN DE REFERENCIAS (APA 7)");

      if (advance.referenceAnalysis) {
        const refs = advance.referenceAnalysis.references;
        
        doc.fillColor(colors.lightBg).rect(50, doc.y, 495, 60).fill();
        doc.fillColor(colors.dark).font("Helvetica-Bold").fontSize(10).text(`Total Referencias Analizadas: ${refs.length}`, 75, doc.y + 15);
        const verifiedCount = refs.filter(r => r.status === "VERIFIED").length;
        doc.fillColor(colors.success).text(`Verificadas satisfactoriamente: ${verifiedCount}`, 75, doc.y + 32);

        doc.y += 40;
        drawSectionTitle("Desglose del Estado de Referencias");

        refs.forEach((r, idx) => {
          if (doc.y > 700) { doc.addPage(); drawHeader("III. REFERENCIAS (CONTINUACIÓN)"); doc.y = 110; }
          
          const statusColors: any = {
            "VERIFIED": colors.success,
            "POSSIBLE_HALLUCINATION": colors.critical,
            "DOI_MISSING": colors.major,
            "NOT_FOUND": colors.secondary
          };
          
          const sc = statusColors[r.status] || colors.dark;
          doc.fillColor(sc).font("Helvetica-Bold").fontSize(9).text(`[${r.status}]`, { continued: true });
          doc.fillColor(colors.dark).font("Helvetica").fontSize(9).text(` ${r.rawText}`);
          
          // Nota: El campo suggestion no existe en el esquema, usamos issues si tiene datos.
          if (r.issues && r.issues.length > 0) {
            doc.fillColor(colors.secondary).font("Helvetica-Oblique").fontSize(8.5).text(`Observaciones: ${r.issues.join(", ")}`, { indent: 20 });
          }
          doc.moveDown(0.5);
        });
      }

      // --- PAGE 5: DICTAMEN FINAL ---
      doc.addPage();
      drawHeader("IV. DICTAMEN FINAL Y OBSERVACIONES");

      if (advance.review) {
        const rev = advance.review;
        const statusConfig: any = {
          "APPROVED": { label: "APROBADO", color: colors.success },
          "REJECTED": { label: "RECHAZADO", color: colors.critical },
          "OBSERVED": { label: "CON OBSERVACIONES", color: colors.major }
        };
        const cfg = statusConfig[rev.status] || { label: rev.status, color: colors.secondary };

        doc.fillColor(cfg.color).rect(50, doc.y, 495, 60).fill();
        doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(18).text(`ESTADO FINAL: ${cfg.label}`, 50, doc.y + 22, { align: "center" });

        doc.y += 90;
        drawSectionTitle("Comentarios del Asesor / Revisor");
        
        doc.fillColor(colors.dark).font("Helvetica").fontSize(12).text(rev.humanComment || "El revisor no ha ingresado comentarios detallados todavía.", { align: "justify", lineGap: 4 });

        doc.moveDown(5);
        const sigY = doc.y;
        doc.strokeColor(colors.secondary).lineWidth(1).moveTo(180, sigY).lineTo(370, sigY).stroke();
        doc.fillColor(colors.dark).font("Helvetica-Bold").fontSize(11).text(rev.reviewer.name, 50, sigY + 12, { align: "center" });
        doc.fillColor(colors.secondary).font("Helvetica").fontSize(10).text("Asesor Académico / Docente Revisor", 50, sigY + 28, { align: "center" });
      } else {
        doc.fillColor(colors.secondary).font("Helvetica-Oblique").fontSize(13).text("Este documento se encuentra en espera de la validación final por parte del asesor académico asignado.", { align: "center", width: 400 });
      }

      // PIE DE PÁGINA FINAL (Para todas las páginas)
      const range = doc.bufferedPageRange();
      for (let i = 0; i < range.count; i++) {
        doc.switchToPage(i);
        // Usamos una posición segura para evitar saltos de página accidentales
        doc.fillColor(colors.secondary).fontSize(8).font("Helvetica")
           .text(`Documento generado por ThesisReview Hub · Página ${i + 1} de ${range.count}`, 50, 800, { 
             align: "center",
             lineBreak: false 
           });
      }

      doc.end();
    });
  }

  async generateVersionsComparison(advanceId: string): Promise<Buffer> { return Buffer.from(""); }
  async generateBatchReport(programId: string, period: string): Promise<Buffer> { return Buffer.from(""); }
  async generateStatsCsv(programId: string): Promise<string> { return ""; }
}
