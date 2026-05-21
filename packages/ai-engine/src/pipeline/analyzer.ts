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
    temperature: 0.2,
  });

  const structuredLlm = llm.withStructuredOutput(analysisSchema, {
    name: "thesis_analysis",
  });

  const prompt = PromptTemplate.fromTemplate(`
Eres un evaluador experto de tesis universitarias. 
Tu tarea es evaluar el siguiente documento en base a la rúbrica proporcionada.

CONTEXTO IMPORTANTE:
El usuario está entregando un avance de tipo: "{advanceType}".
- Si el tipo es "chapter_1", enfócate principalmente en evaluar el CAPITULO I: INTRODUCCIÓN.
- Si el tipo es "chapter_2", enfócate principalmente en evaluar el CAPITULO II: MÉTODO.
- Si el tipo es "chapter_3", enfócate principalmente en evaluar el CAPITULO III: ASPECTOS ADMINISTRATIVOS.
- Si el tipo es "full", evalúa el documento completo.

REGLA DE REFERENCIAS (OBLIGATORIA):
Sin importar el tipo de avance, SIEMPRE debes evaluar la sección de "Referencias Bibliográficas" o "Bibliografía" si está presente en el documento. 
- Verifica que las fuentes citadas en el texto aparezcan en la lista de referencias.
- Valida que el formato (ej. APA, IEEE) sea el correcto según la rúbrica.
- Si no hay referencias en un avance de capítulo, menciónalo como una observación menor o sugerencia, a menos que el avance sea muy preliminar.

IMPORTANTE: No califiques como "ausente" secciones de CONTENIDO que no corresponden al tipo de avance "{advanceType}". 
Sin embargo, la calidad de la redacción, el formato y las REFERENCIAS deben ser evaluados en cualquier entrega.

RÚBRICA DE EVALUACIÓN (Estructura completa de referencia):
{rubric}

TEXTO DEL DOCUMENTO DEL ESTUDIANTE:
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
