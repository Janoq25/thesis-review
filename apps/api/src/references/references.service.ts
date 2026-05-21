import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AzureChatOpenAI } from '@langchain/openai';
import { createAzureChatLLM } from '../common/azure-openai.config';
import { extractText } from '@thesis-review/ai-engine';
import { z } from 'zod';

const referenceAnalysisSchema = z.object({
  references: z.array(z.object({
    rawText: z.string().describe("El texto original completo de la referencia tal cual aparece en el documento"),
    title: z.string().nullable().optional().default(null),
    authors: z.string().nullable().optional().default(null),
    year: z.number().nullable().optional().default(null),
    doi: z.string().nullable().optional().default(null),
    status: z.enum(['VERIFIED', 'DOI_MISSING', 'POSSIBLE_HALLUCINATION', 'NOT_FOUND', 'DOI_INCORRECT', 'UNINDEXED'])
      .default('NOT_FOUND')
      .describe("Clasificación del estado de la referencia. Usa VERIFIED si está bien estructurada APA 7. Usa DOI_MISSING si es válida pero falta DOI. Usa POSSIBLE_HALLUCINATION si parece falsa o mal construida. Usa NOT_FOUND si está demasiado incompleta."),
    issues: z.array(z.string()).default([]).describe("Lista de errores observados en la referencia según APA 7. Ej: 'Falta cursiva en la revista', 'Falta número de páginas'"),
    suggestion: z.string().nullable().optional().default(null).describe("Sugerencia de cómo debería redactarse correctamente esta referencia")
  }))
});

@Injectable()
export class CrossRefService {
  private readonly logger = new Logger(CrossRefService.name);
  private llm: AzureChatOpenAI;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {
    this.llm = createAzureChatLLM(
      process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ?? process.env.AZURE_OPENAI_DEPLOYMENT_NAME ?? 'gpt-4o',
    );
  }

  async analyzeReferences(advanceId: string, documentText: string): Promise<void> {
    this.logger.log(`Iniciando análisis de referencias IA One-Shot para avance ${advanceId}`);
    
    let textToAnalyze = documentText;

    // FALLBACK: Si no hay texto (chunks vacíos), intentar extraerlo del archivo original
    if (!textToAnalyze || textToAnalyze.trim().length < 50) {
      this.logger.warn(`DocumentText vacío para avance ${advanceId}. Intentando extracción de emergencia desde el archivo.`);
      try {
        const advance = await this.prisma.advance.findUniqueOrThrow({ where: { id: advanceId } });
        const buffer = await this.storage.download(advance.fileKey);
        textToAnalyze = await extractText(buffer, advance.fileType as any);
        this.logger.log(`Extracción de emergencia exitosa: ${textToAnalyze.length} caracteres.`);
        
        // Guardar para la próxima vez
        await this.prisma.advanceChunk.create({
          data: {
            advanceId,
            sectionName: 'EMERGENCY_FULL_TEXT',
            content: textToAnalyze,
            chunkIndex: 0,
          }
        });
      } catch (err) {
        this.logger.error(`Fallo crítico en extracción de emergencia para ${advanceId}`, err);
        throw new Error('No se pudo recuperar el texto del documento para el análisis.');
      }
    }

    let analysis = await this.prisma.referenceAnalysis.findUnique({
      where: { advanceId },
    });

    if (!analysis) {
      analysis = await this.prisma.referenceAnalysis.create({
        data: { advanceId },
      });
    } else {
      await this.prisma.reference.deleteMany({
        where: { analysisId: analysis.id },
      });
    }

    const bibIndex = textToAnalyze.search(/referencias\s+bibliográficas?|bibliografía|references/i);
    let bibSection = bibIndex !== -1 ? textToAnalyze.slice(bibIndex) : textToAnalyze.slice(-10000);

    // Si la sección de bibliografía es muy corta, intentar con los últimos 15000 caracteres
    if (bibSection.length < 500) {
      this.logger.warn(`Sección de bibliografía muy corta (${bibSection.length} chars). Usando fallback de los últimos 15000.`);
      bibSection = textToAnalyze.slice(-15000);
    }

    this.logger.log(`Longitud del texto para análisis: ${bibSection.length} caracteres.`);

    const prompt = `
      Eres un experto en bibliografía académica y normativas APA 7.
      Tu tarea es extraer TODAS las referencias bibliográficas del texto y analizarlas individualmente.
      
      INSTRUCCIONES OBLIGATORIAS:
      1. Extrae cada referencia del texto.
      2. Para CADA referencia, debes completar TODOS los campos del JSON. No omitas ningún campo.
      3. Si no encuentras un dato (como DOI o Año), pon null, pero mantén el campo en el objeto.
      4. Evalúa la calidad: ¿Cumple con APA 7? ¿Los autores parecen reales? ¿Tiene DOI?
      
      CAMPOS POR REFERENCIA:
      - rawText: Texto original.
      - status: Uno de ['VERIFIED', 'DOI_MISSING', 'POSSIBLE_HALLUCINATION', 'NOT_FOUND', 'DOI_INCORRECT', 'UNINDEXED'].
      - issues: Array de strings con errores encontrados. Si no hay, array vacío [].
      - suggestion: Texto con la referencia corregida según APA 7.
      
      Devuelve el resultado estrictamente en formato JSON.
      
      TEXTO A ANALIZAR:
      ${bibSection.substring(0, 20000)}
    `;

    try {
      const structuredLlm = this.llm.withStructuredOutput(referenceAnalysisSchema, {
        name: 'reference_analysis'
      });

      const result = await structuredLlm.invoke(prompt);

      const referencesData = result.references.map((ref) => ({
        analysisId: analysis!.id,
        rawText: ref.rawText,
        authors: ref.authors ?? null,
        year: ref.year ?? null,
        title: ref.title ?? null,
        doi: ref.doi ?? null,
        status: ref.status as any,
        verified: ref.status === 'VERIFIED',
        issues: ref.issues ?? [],
        crossrefData: ref.suggestion ? { suggestion: ref.suggestion } : {},
      }));

      await this.prisma.reference.createMany({
        data: referencesData,
      });

      this.logger.log(`Análisis completado — avance ${advanceId}: ${result.references.length} referencias procesadas.`);
    } catch (error) {
      this.logger.error('Error durante el análisis estructurado de IA', error);
      throw new Error('No se pudieron analizar las referencias con IA.');
    }
  }
}
