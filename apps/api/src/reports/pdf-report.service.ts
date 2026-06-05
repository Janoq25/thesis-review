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
        student: { select: { name: true, email: true, advisor: { select: { name: true } } } },
        program: { select: { name: true } },
        template: { select: { name: true, version: true } },
        aiAnalysis: { include: { findings: { orderBy: { severity: 'asc' } } } },
        review: { include: { reviewer: { select: { name: true } } } },
        plagiarismReport: { include: { alerts: { orderBy: { similarity: 'desc' } } } },
        referenceAnalysis: { include: { references: { orderBy: { status: 'asc' } } } },
      },
    });

    this.logger.log(`Generando reporte PDF profesional e integral para avance ${advanceId}`);

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const primaryColor = '#185FA5';
      const secondaryColor = '#4B5563';
      const darkColor = '#1F2937';
      const lightBg = '#F9FAFB';
      const borderLineColor = '#E5E7EB';

      // --- Helper: Cabecera Estilo Corporativo ---
      const drawHeader = (title: string) => {
        doc.fillColor(primaryColor);
        doc.rect(50, 40, 495, 4).fill();
        
        doc.fillColor(darkColor).fontSize(14).font('Helvetica-Bold').text(title, 50, 55);
        doc.fillColor(secondaryColor).fontSize(8).font('Helvetica').text('SISTEMA DE EVALUACIÓN DE TESIS - THESISREVIEW', 50, 75, { align: 'right' });
        doc.strokeColor(borderLineColor).lineWidth(1).moveTo(50, 85).lineTo(545, 85).stroke();
        doc.y = 100;
      };

      // PAGE 1: PORTADA & INFORMACIÓN GENERAL
      drawHeader('REPORTE INTEGRAL DE EVALUACIÓN');

      // Título del documento evaluado
      doc.moveDown(1);
      doc.fillColor(primaryColor).fontSize(16).font('Helvetica-Bold').text(advance.title, { align: 'left' });
      doc.moveDown(1.5);

      // Ficha Técnica (Cuadro de Información General)
      doc.fillColor(lightBg).rect(50, doc.y, 495, 130).fill();
      
      doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(10);
      let technicalY = doc.y + 10;
      
      const drawRow = (label: string, value: string) => {
        doc.font('Helvetica-Bold').text(label, 70, technicalY);
        doc.font('Helvetica').text(value, 180, technicalY);
        technicalY += 18;
      };

      drawRow('Estudiante:', advance.student.name);
      drawRow('Correo:', advance.student.email);
      drawRow('Asesor:', advance.student.advisor?.name ?? 'No asignado');
      drawRow('Programa:', advance.program.name);
      drawRow('Avance:', `${advance.advanceType === 'chapter_1' ? 'Capítulo I' : advance.advanceType === 'chapter_2' ? 'Capítulo II' : 'Tesis Completa'} (v${advance.version})`);
      drawRow('Plantilla Usada:', `${advance.template.name} (v${advance.template.version})`);
      
      doc.y = technicalY + 10;
      doc.moveDown(2);

      // Resumen Ejecutivo de la Evaluación IA
      if (advance.aiAnalysis?.executiveSummary) {
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('Resumen Ejecutivo de la Evaluación IA');
        doc.strokeColor(primaryColor).lineWidth(0.5).moveTo(50, doc.y + 2).lineTo(200, doc.y + 2).stroke();
        doc.moveDown(0.8);
        doc.fillColor(darkColor).font('Helvetica').fontSize(9.5).text(advance.aiAnalysis.executiveSummary, { align: 'justify', lineGap: 3 });
      }

      // PAGE 2: DETALLES DE EVALUACIÓN IA & NOTAS
      doc.addPage();
      drawHeader('EVALUACIÓN IA Y CUMPLIMIENTO');
      doc.moveDown(1);

      if (advance.aiAnalysis) {
        // Tarjetas de puntajes en una grilla
        const startY = doc.y;
        const cardWidth = 110;
        const cardHeight = 60;
        const gap = 15;

        const drawScoreCard = (title: string, score: number, index: number) => {
          const x = 50 + index * (cardWidth + gap);
          // Dibujar fondo
          doc.fillColor('#F9FAFB').rect(x, startY, cardWidth, cardHeight).fill();
          // Borde
          doc.strokeColor(borderLineColor).lineWidth(1).rect(x, startY, cardWidth, cardHeight).stroke();
          // Dibujar borde izquierdo acentuado
          doc.fillColor(primaryColor).rect(x, startY, 4, cardHeight).fill();
          
          // Título de la tarjeta
          doc.fillColor(secondaryColor).font('Helvetica-Bold').fontSize(8.5).text(title, x + 10, startY + 12, { width: cardWidth - 15 });
          // Puntaje
          doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(14).text(`${score.toFixed(0)}%`, x + 10, startY + 32);
        };

        drawScoreCard('Estructura', advance.aiAnalysis.structureScore, 0);
        drawScoreCard('Contenido', advance.aiAnalysis.contentScore, 1);
        drawScoreCard('Redacción / Forma', advance.aiAnalysis.formScore, 2);
        drawScoreCard('Originalidad', advance.aiAnalysis.originalityScore, 3);

        doc.y = startY + cardHeight + 25;

        // Nota final convertida
        doc.fillColor('#EFF6FF').rect(50, doc.y, 495, 40).fill();
        doc.strokeColor('#DBEAFE').lineWidth(1).rect(50, doc.y, 495, 40).stroke();
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(13)
           .text(`NOTA IA CONVERTIDA: ${advance.aiAnalysis.gradeConverted.toFixed(1)} / 20`, 70, doc.y + 13);

        doc.y = doc.y + 60;

        // Hallazgos detectados
        if (advance.aiAnalysis.findings.length > 0) {
          doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('Hallazgos y Observaciones Críticas de la IA');
          doc.strokeColor(primaryColor).lineWidth(0.5).moveTo(50, doc.y + 2).lineTo(200, doc.y + 2).stroke();
          doc.moveDown(0.8);

          advance.aiAnalysis.findings.forEach((finding, index) => {
            if (doc.y > 680) { // Salto de página preventivo
              doc.addPage();
              drawHeader('EVALUACIÓN IA Y CUMPLIMIENTO (Continuación)');
              doc.moveDown(1);
            }
            
            doc.moveDown(0.5);
            // Cabecera del hallazgo
            const severityColor = finding.severity === 'CRITICAL' ? '#EF4444' : finding.severity === 'MAJOR' ? '#F59E0B' : '#3B82F6';
            doc.fillColor(severityColor).font('Helvetica-Bold').fontSize(9.5).text(`[${finding.severity}] - Sección: ${finding.sectionRef}`);
            
            // Descripción y sugerencias
            doc.fillColor(darkColor).font('Helvetica').fontSize(9).text(finding.description, { align: 'justify', lineGap: 1 });
            doc.fillColor(secondaryColor).font('Helvetica-Oblique').fontSize(8.5).text(`Acción correctiva sugerida: ${finding.recommendation}`);
            doc.moveDown(0.4);
          });
        }
      } else {
        doc.fillColor(secondaryColor).font('Helvetica-Oblique').fontSize(11).text('No hay análisis de IA disponible para este avance.');
      }

      // PAGE 3: ANÁLISIS DE PLAGIO Y SIMILITUD (Copyleaks)
      doc.addPage();
      drawHeader('REPORTE DE PLAGIO E INTELIGENCIA ARTIFICIAL');
      doc.moveDown(1);

      if (advance.plagiarismReport) {
        const report = advance.plagiarismReport;
        
        // Tarjetas de plagio
        const startY = doc.y;
        const cardWidth = 230;
        const cardHeight = 65;
        const gap = 35;

        // Tarjeta Plagio
        doc.fillColor('#FEF2F2').rect(50, startY, cardWidth, cardHeight).fill();
        doc.fillColor('#EF4444').rect(50, startY, 5, cardHeight).fill();
        doc.fillColor('#991B1B').font('Helvetica-Bold').fontSize(10).text('ÍNDICE DE SIMILITUD (PLAGIO)', 65, startY + 15);
        doc.fillColor('#7F1D1D').font('Helvetica-Bold').fontSize(16).text(`${report.overallSimilarity.toFixed(1)}%`, 65, startY + 35);

        // Tarjeta IA (Copyleaks AI Score)
        if (report.aiScore !== null && report.aiScore !== undefined) {
          doc.fillColor('#FAF5FF').rect(50 + cardWidth + gap, startY, cardWidth, cardHeight).fill();
          doc.fillColor('#8B5CF6').rect(50 + cardWidth + gap, startY, 5, cardHeight).fill();
          doc.fillColor('#5B21B6').font('Helvetica-Bold').fontSize(10).text('PROBABILIDAD DE ESCRITURA POR IA', 50 + cardWidth + gap + 15, startY + 15);
          doc.fillColor('#4C1D95').font('Helvetica-Bold').fontSize(16).text(`${report.aiScore.toFixed(1)}%`, 50 + cardWidth + gap + 15, startY + 35);
        }

        doc.y = startY + cardHeight + 25;

        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('Fuentes de Similitud Coincidentes');
        doc.strokeColor(primaryColor).lineWidth(0.5).moveTo(50, doc.y + 2).lineTo(200, doc.y + 2).stroke();
        doc.moveDown(0.8);

        if (report.alerts.length > 0) {
          report.alerts.forEach((alert, index) => {
            if (doc.y > 700) {
              doc.addPage();
              drawHeader('REPORTE DE PLAGIO E INTELIGENCIA ARTIFICIAL (Continuación)');
              doc.moveDown(1);
            }
            
            doc.moveDown(0.4);
            doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(9)
               .text(`${index + 1}. Coincidencia: ${(alert.similarity * 100).toFixed(0)}%`);
            
            const sourceUrl = alert.sourceUrl || 'Documento interno del repositorio';
            doc.fillColor('#2563EB').font('Helvetica').fontSize(8.5).text(`Fuente: ${sourceUrl}`, { underline: true });
            
            if (alert.matchedText) {
              doc.fillColor(secondaryColor).font('Helvetica-Oblique').fontSize(8)
                 .text(`Texto coincidente: "${alert.matchedText.trim()}"`, { lineGap: 1 });
            }
            doc.moveDown(0.4);
          });
        } else {
          doc.fillColor(secondaryColor).font('Helvetica-Oblique').fontSize(9.5).text('No se encontraron fuentes de plagio con similitud superior al umbral configurado.');
        }
      } else {
        doc.fillColor(secondaryColor).font('Helvetica-Oblique').fontSize(11).text('No hay reporte de plagio disponible.');
      }

      // PAGE 4: CUMPLIMIENTO DE REFERENCIAS BIBLIOGRÁFICAS (APA 7)
      doc.addPage();
      drawHeader('ANÁLISIS DE REFERENCIAS Y CITAS');
      doc.moveDown(1);

      if (advance.referenceAnalysis) {
        const refs = advance.referenceAnalysis.references;
        const totalRefs = refs.length;
        const verifiedRefs = refs.filter(r => r.verified || r.status === 'VERIFIED').length;
        const hallucinations = refs.filter(r => r.status === 'POSSIBLE_HALLUCINATION');
        const missingDoi = refs.filter(r => r.status === 'DOI_MISSING');
        const incorrectDoi = refs.filter(r => r.status === 'DOI_INCORRECT');

        // Resumen
        doc.fillColor('#F3F4F6').rect(50, doc.y, 495, 65).fill();
        doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(9.5).text('Resumen de Cumplimiento de Referencias (APA 7)', 70, doc.y + 12);
        
        doc.font('Helvetica').fontSize(9);
        doc.text(`Total Referencias Analizadas: ${totalRefs}`, 70, doc.y + 30);
        doc.text(`Referencias Indexadas/Verificadas: ${verifiedRefs} de ${totalRefs}`, 70, doc.y + 44);
        
        doc.text(`Hallucinadas/Falsas: ${hallucinations.length}`, 320, doc.y + 30);
        doc.text(`Con errores (DOI faltante/incorrecto): ${missingDoi.length + incorrectDoi.length}`, 320, doc.y + 44);

        doc.y = doc.y + 85;

        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('Detalle de Alertas y Observaciones en Referencias');
        doc.strokeColor(primaryColor).lineWidth(0.5).moveTo(50, doc.y + 2).lineTo(200, doc.y + 2).stroke();
        doc.moveDown(0.8);

        const problematicRefs = refs.filter(r => r.status !== 'VERIFIED');
        
        if (problematicRefs.length > 0) {
          problematicRefs.forEach((ref, index) => {
            if (doc.y > 700) {
              doc.addPage();
              drawHeader('ANÁLISIS DE REFERENCIAS Y CITAS (Continuación)');
              doc.moveDown(1);
            }
            
            doc.moveDown(0.4);
            const statusLabel = ref.status === 'POSSIBLE_HALLUCINATION' ? 'POSIBLE ALUCINACIÓN (CITA INVENTADA)' :
                                ref.status === 'DOI_MISSING' ? 'DOI FALTANTE' :
                                ref.status === 'DOI_INCORRECT' ? 'DOI INCORRECTO' : 'NO ENCONTRADA EN BASE DE DATOS';
            const badgeColor = ref.status === 'POSSIBLE_HALLUCINATION' ? '#EF4444' : '#F59E0B';

            doc.fillColor(badgeColor).font('Helvetica-Bold').fontSize(8.5).text(`[${statusLabel}]`);
            doc.fillColor(darkColor).font('Helvetica').fontSize(8.5).text(ref.rawText, { lineGap: 1 });
            
            if (ref.issues && ref.issues.length > 0) {
              doc.fillColor(secondaryColor).font('Helvetica-Oblique').fontSize(8).text(`Observaciones: ${ref.issues.join(', ')}`);
            }
            doc.moveDown(0.4);
          });
        } else {
          doc.fillColor(secondaryColor).font('Helvetica-Oblique').fontSize(9.5).text('Todas las referencias bibliográficas fueron validadas satisfactoriamente en CrossRef y siguen correctamente la norma APA 7.');
        }
      } else {
        doc.fillColor(secondaryColor).font('Helvetica-Oblique').fontSize(11).text('No hay análisis de referencias disponible.');
      }

      // PAGE 5: DECISIÓN DEL ASESOR Y OBSERVACIONES HUMANAS
      doc.addPage();
      drawHeader('DICTAMEN DE REVISIÓN DEL ASESOR');
      doc.moveDown(1);

      if (advance.review) {
        const review = advance.review;
        
        // Estado final del Dictamen
        const dictamenColor = review.status === 'APPROVED' ? '#10B981' : review.status === 'REJECTED' ? '#EF4444' : '#F59E0B';
        const dictamenText = review.status === 'APPROVED' ? 'APROBADO' : review.status === 'REJECTED' ? 'RECHAZADO' : 'OBSERVADO';

        doc.fillColor(dictamenColor).rect(50, doc.y, 495, 45).fill();
        doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(14).text(`DICTAMEN FINAL: ${dictamenText}`, 70, doc.y + 16);
        
        doc.y = doc.y + 65;

        // Nota final
        const finalGradeText = review.finalGrade !== null && review.finalGrade !== undefined ? `${review.finalGrade.toFixed(1)} / 20` : 'No asignada';
        doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(12).text('Calificación Asignada por el Asesor');
        doc.font('Helvetica').fontSize(10).text(`Nota final de revisión: ${finalGradeText}`);
        doc.moveDown(1.5);

        // Rúbrica de cumplimiento humano
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('Rúbrica de Calidad Evaluada');
        doc.strokeColor(primaryColor).lineWidth(0.5).moveTo(50, doc.y + 2).lineTo(200, doc.y + 2).stroke();
        doc.moveDown(0.8);

        const rubricAnswers = review.rubricAnswers as Record<string, boolean> ?? {};
        const rubricKeys = Object.keys(rubricAnswers);

        if (rubricKeys.length > 0) {
          rubricKeys.forEach(key => {
            const checked = rubricAnswers[key];
            doc.fillColor(checked ? '#10B981' : '#EF4444').font('Helvetica-Bold').fontSize(9)
               .text(checked ? '  [✓] CUMPLE' : '  [✗] NO CUMPLE', { continued: true });
            doc.fillColor(darkColor).font('Helvetica').fontSize(9).text(`  - ${key.toUpperCase()}`);
            doc.moveDown(0.2);
          });
        } else {
          doc.fillColor(secondaryColor).font('Helvetica-Oblique').fontSize(9.5).text('No se registraron criterios de rúbrica específicos.');
        }

        doc.moveDown(1.5);

        // Comentarios de la revisión
        doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(12).text('Observaciones del Asesor / Jurado');
        doc.strokeColor(primaryColor).lineWidth(0.5).moveTo(50, doc.y + 2).lineTo(200, doc.y + 2).stroke();
        doc.moveDown(0.8);

        if (review.humanComment) {
          doc.fillColor(darkColor).font('Helvetica').fontSize(9.5).text(review.humanComment, { align: 'justify', lineGap: 2.5 });
        } else {
          doc.fillColor(secondaryColor).font('Helvetica-Oblique').fontSize(9.5).text('El asesor no registró comentarios adicionales.');
        }

        doc.moveDown(3);

        // Firma digital simulada
        const startSignatureY = doc.y;
        if (startSignatureY < 720) {
          doc.strokeColor(secondaryColor).lineWidth(0.5).moveTo(180, startSignatureY + 40).lineTo(370, startSignatureY + 40).stroke();
          doc.fillColor(darkColor).font('Helvetica-Bold').fontSize(9.5).text(review.reviewer.name, 50, startSignatureY + 45, { align: 'center' });
          doc.fillColor(secondaryColor).font('Helvetica').fontSize(8.5).text('Asesor / Docente Revisor', 50, startSignatureY + 58, { align: 'center' });
        }
      } else {
        doc.fillColor(secondaryColor).font('Helvetica-Oblique').fontSize(11).text('Este avance se encuentra pendiente de revisión por parte de su asesor.');
      }

      // --- Numeración de Páginas ---
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc.fillColor(secondaryColor).fontSize(8).font('Helvetica')
           .text(`Página ${i + 1} de ${totalPages}`, 50, 780, { align: 'center' });
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
