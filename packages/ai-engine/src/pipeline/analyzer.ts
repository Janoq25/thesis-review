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

export async function analyzeDocument(
  text: string, 
  rubric: any, 
  advanceType: string
): Promise<AIAnalysisResult> {
  const llm = new AzureChatOpenAI({
    azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
    azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME,
    azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
    temperature: 0.4, 
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

CALIFICACIÓN:
Sé riguroso y crítico. Evita notas promedio.

RÚBRICA PATRÓN:
{rubric}

TEXTO DEL ESTUDIANTE:
{text}
  `);

  const chain = prompt.pipe(structuredLlm);

  const result = await chain.invoke({
    advanceType,
    rubric: JSON.stringify(rubric, null, 2),
    text: text.substring(0, 50000), 
  });

  return result;
}
