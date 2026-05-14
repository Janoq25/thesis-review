import { ChatOpenAI, OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

export interface AnalysisResult {
  scores: { structure: number; content: number; form: number; originality: number; overall: number };
  grade: number;
  executiveSummary: string;
  findings: FindingOutput[];
  processingMs: number;
}

export interface FindingOutput {
  sectionRef: string;
  pageRef?: number;
  severity: 'CRITICAL' | 'MAJOR' | 'MINOR' | 'SUGGESTION';
  description: string;
  correctionSteps: string;
  exampleImprovement: string;
  recommendation: string;
}

const SYSTEM_PROMPT = `Eres un evaluador académico experto en tesis universitarias de posgrado. 
Tu tarea es analizar un avance de tesis comparándolo con un documento patrón institucional.

INSTRUCCIONES DE EVALUACIÓN:
1. Analiza la ESTRUCTURA: presencia y orden de todas las secciones obligatorias del patrón.
2. Analiza el CONTENIDO: profundidad, coherencia entre secciones, argumentación y citas.
3. Analiza la FORMA: extensión por sección, formato APA/IEEE según corresponda, redacción académica.
4. Analiza la ORIGINALIDAD y calidad del lenguaje académico.

PESOS DE CALIFICACIÓN:
- Estructura: 30%
- Contenido: 40%  
- Forma: 20%
- Originalidad/Calidad: 10%

FORMATO DE RESPUESTA: Responde ÚNICAMENTE con JSON válido siguiendo el schema proporcionado.
No incluyas markdown, backticks ni texto fuera del JSON.

CRITERIO DE SEVERIDAD:
- CRITICAL: Sección obligatoria completamente ausente o objetivo principal incomprensible.
- MAJOR: Sección presente pero con deficiencias sustanciales que afectan la comprensión.
- MINOR: Errores de forma corregibles sin reescritura mayor.
- SUGGESTION: Recomendaciones de mejora académica opcionales.`;

export class AnalysisPipeline {
  private llm: ChatOpenAI;
  private embeddings: OpenAIEmbeddings;
  private splitter: RecursiveCharacterTextSplitter;

  constructor(private config: { openaiKey: string; maxGrade: number }) {
    this.llm = new ChatOpenAI({
      apiKey: config.openaiKey,
      model: 'gpt-4o',
      temperature: 0.1,
      responseFormat: { type: 'json_object' },
    });
    this.embeddings = new OpenAIEmbeddings({
      apiKey: config.openaiKey,
      model: 'text-embedding-3-large',
    });
    this.splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1500,
      chunkOverlap: 200,
      separators: ['\n\n', '\n', '. ', ' '],
    });
  }

  async extractText(fileBuffer: Buffer, fileType: 'pdf' | 'docx'): Promise<string> {
    if (fileType === 'docx') {
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value;
    }
    const data = await pdfParse(fileBuffer);
    return data.text;
  }

  async chunkDocument(text: string): Promise<string[]> {
    return this.splitter.splitText(text);
  }

  async generateEmbeddings(chunks: string[]): Promise<number[][]> {
    return this.embeddings.embedDocuments(chunks);
  }

  async analyze(
    advanceText: string,
    templateSchema: object,
    templateText: string,
    advanceType: string,
  ): Promise<AnalysisResult> {
    const startMs = Date.now();

    const userPrompt = `
DOCUMENTO PATRÓN — ESTRUCTURA ESPERADA:
${JSON.stringify(templateSchema, null, 2)}

FRAGMENTO DEL PATRÓN (referencia de estilo y profundidad):
${templateText.substring(0, 3000)}

TIPO DE AVANCE A EVALUAR: ${advanceType}

AVANCE DEL ESTUDIANTE:
${advanceText.substring(0, 8000)}

Responde con este JSON exacto:
{
  "scores": {
    "structure": <0-100>,
    "content": <0-100>,
    "form": <0-100>,
    "originality": <0-100>
  },
  "executiveSummary": "<párrafo de 4-6 oraciones: fortalezas, debilidades, prioridad de corrección>",
  "findings": [
    {
      "sectionRef": "<nombre de sección>",
      "pageRef": <número aproximado o null>,
      "severity": "CRITICAL|MAJOR|MINOR|SUGGESTION",
      "description": "<qué se encontró o qué falta, específico>",
      "correctionSteps": "<instrucciones paso a paso para corregir>",
      "exampleImprovement": "<ejemplo concreto de cómo debería redactarse>",
      "recommendation": "<consejo académico adicional>"
    }
  ]
}`;

    const response = await this.llm.invoke([
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ]);

    const parsed = JSON.parse(response.content as string);
    const s = parsed.scores;
    const overall = s.structure * 0.3 + s.content * 0.4 + s.form * 0.2 + s.originality * 0.1;
    const grade = (overall / 100) * this.config.maxGrade;

    return {
      scores: { ...s, overall: Math.round(overall * 10) / 10 },
      grade: Math.round(grade * 10) / 10,
      executiveSummary: parsed.executiveSummary,
      findings: parsed.findings,
      processingMs: Date.now() - startMs,
    };
  }
}
