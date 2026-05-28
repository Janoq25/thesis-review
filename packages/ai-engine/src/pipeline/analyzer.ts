import { AzureChatOpenAI } from '@langchain/openai';
import { z } from 'zod';
import { PromptTemplate } from '@langchain/core/prompts';

const analysisSchema = z.object({
  structureScore: z.number().min(0).max(100),
  contentScore: z.number().min(0).max(100),
  formScore: z.number().min(0).max(100),
  originalityScore: z.number().min(0).max(100),
  overallScore: z.number().min(0).max(100),
  gradeConverted: z.number().min(0).max(20),
  executiveSummary: z.string(),
  findings: z.array(z.object({
    sectionRef: z.string(),
    pageRef: z.number().optional().nullable(),
    severity: z.enum(['CRITICAL', 'MAJOR', 'MINOR', 'SUGGESTION']),
    description: z.string(),
    correctionSteps: z.string(),
    exampleImprovement: z.string(),
    recommendation: z.string(),
  })),
});

export type AIAnalysisResult = z.infer<typeof analysisSchema>;

function azureInstanceName(): string {
  if (process.env.AZURE_OPENAI_API_INSTANCE_NAME) {
    return process.env.AZURE_OPENAI_API_INSTANCE_NAME;
  }
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  if (!endpoint) {
    throw new Error('AZURE_OPENAI_ENDPOINT or AZURE_OPENAI_API_INSTANCE_NAME is required');
  }
  return new URL(endpoint).hostname.split('.')[0];
}

function log(step: string, meta?: Record<string, unknown>) {
  const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
  console.log(`[ai-engine:analyzer] ${step}${suffix}`);
}

export async function analyzeDocument(
  text: string, 
  rubric: any, 
  advanceType: string
): Promise<AIAnalysisResult> {
  log('Inicio analyzeDocument', {
    advanceType,
    textLength: text.length,
    deployment:
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME ??
      process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ??
      'gpt-4o',
    instance: azureInstanceName(),
  });

  const llm = new AzureChatOpenAI({
    azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
    azureOpenAIApiInstanceName: azureInstanceName(),
    azureOpenAIApiDeploymentName:
      process.env.AZURE_OPENAI_DEPLOYMENT_NAME ??
      process.env.AZURE_OPENAI_CHAT_DEPLOYMENT ??
      'gpt-4o',
    azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION ?? '2024-08-01-preview',
    temperature: 0.1, 
    maxRetries: 10,
  });

  const structuredLlm = llm.withStructuredOutput(analysisSchema, {
    name: "thesis_analysis",
  });

  const prompt = PromptTemplate.fromTemplate(`
Actúa como un experto revisor de proyectos de tesis, con amplia experiencia en la evaluación de trabajos de investigación en ingeniería de sistemas.
Conoces en profundidad las normas académicas para la aprobación de proyectos de pregrado y posgrado.

Tu misión es revisar el proyecto de tesis y determinar si cumple con la estructura, el contenido y los estándares de calidad establecidos.

CONTEXTO DEL AVANCE:
El usuario entrega un avance de tipo: "{advanceType}"

INSTRUCCIONES DE REVISIÓN:
1. Análisis de estructura y contenido para "{advanceType}".
2. Revisión obligatoria de Referencias (APA 7, actualidad 80%, etc.).
3. Revisión de forma (Fuente Arial Narrow 12, interlineado 1.5).

CRITERIOS DE PUNTUACIÓN (Escala de 0 a 100):
Evalúa cada dimensión de forma independiente y crítica:
- structureScore (Estructura - 30%): Evalúa si cuenta con las secciones requeridas y estructura lógica.
- contentScore (Contenido - 40%): Evalúa el rigor científico, la justificación del problema, objetivos claros y solidez metodológica.
- formScore (Forma - 20%): Cumplimiento de normas de estilo de redacción, citación APA y formato visual.
- originalityScore (Originalidad - 10%): Innovación, aporte del tema al estado del arte y contribución propia.
- overallScore (Similitud/Puntaje Global): Promedio ponderado de los puntajes anteriores según la importancia que le asigne la rúbrica patrón.
- gradeConverted (Nota Convertida): Nota final convertida al sistema de calificación local (escala de 0 a 20).

CALIFICACIÓN:
Sé riguroso y crítico. Evita notas promedio y evalúa de forma diferenciada cada criterio según el texto provisto. No dupliques la misma calificación para todos los ámbitos a menos que realmente tengan el mismo nivel de desempeño.

RÚBRICA PATRÓN:
{rubric}

TEXTO DEL ESTUDIANTE:
{text}
  `);

  const chain = prompt.pipe(structuredLlm);

  log('Invocando Azure OpenAI (structured output)...');
  const invokeStart = Date.now();

  let result: AIAnalysisResult;
  try {
    result = await chain.invoke({
      advanceType,
      rubric: JSON.stringify(rubric, null, 2),
      text: text.substring(0, 50000),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log('Error en invocación Azure', { error: message, elapsedMs: Date.now() - invokeStart });
    throw err;
  }

  log('Respuesta validada por schema Zod', {
    elapsedMs: Date.now() - invokeStart,
    overallScore: result.overallScore,
    findingsCount: result.findings?.length ?? 0,
  });

  return result;
}
