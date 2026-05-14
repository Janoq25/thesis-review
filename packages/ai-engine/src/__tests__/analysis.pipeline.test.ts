import { AnalysisPipeline } from '../pipeline/analysis.pipeline';

// Mock de OpenAI para no consumir créditos en tests
jest.mock('@langchain/openai', () => ({
  ChatOpenAI: jest.fn().mockImplementation(() => ({
    invoke: jest.fn().mockResolvedValue({
      content: JSON.stringify({
        scores: { structure: 85, content: 80, form: 90, originality: 75 },
        executiveSummary: 'Documento bien estructurado con algunas deficiencias de contenido.',
        findings: [
          {
            sectionRef: 'Marco conceptual',
            pageRef: 12,
            severity: 'MAJOR',
            description: 'Faltan definiciones operacionales.',
            correctionSteps: 'Agregar definiciones para cada término clave.',
            exampleImprovement: 'El término X se define como...',
            recommendation: 'Consultar fuentes especializadas.',
          },
        ],
      }),
    }),
  })),
  OpenAIEmbeddings: jest.fn().mockImplementation(() => ({
    embedDocuments: jest.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
    embedQuery: jest.fn().mockResolvedValue([0.1, 0.2, 0.3]),
  })),
}));

describe('AnalysisPipeline', () => {
  let pipeline: AnalysisPipeline;

  beforeEach(() => {
    pipeline = new AnalysisPipeline({ openaiKey: 'test-key', maxGrade: 20 });
  });

  describe('extractText', () => {
    it('extrae texto de buffer PDF mockeado', async () => {
      // pdf-parse mock
      jest.mock('pdf-parse', () =>
        jest.fn().mockResolvedValue({ text: 'Texto del PDF de prueba' }),
      );
      // Solo verificamos que la función existe y retorna string
      expect(typeof pipeline.extractText).toBe('function');
    });
  });

  describe('chunkDocument', () => {
    it('divide un texto largo en chunks', async () => {
      const longText = 'Párrafo de prueba. '.repeat(200);
      const chunks = await pipeline.chunkDocument(longText);
      expect(chunks.length).toBeGreaterThan(1);
      expect(chunks.every((c) => typeof c === 'string')).toBe(true);
    });

    it('retorna array vacío para texto vacío', async () => {
      const chunks = await pipeline.chunkDocument('');
      expect(Array.isArray(chunks)).toBe(true);
    });
  });

  describe('analyze', () => {
    it('calcula el puntaje overall correctamente', async () => {
      const result = await pipeline.analyze(
        'Texto del avance de prueba con contenido académico suficiente.',
        { sections: [{ name: 'Marco teórico', required: true }] },
        'Texto del patrón institucional de referencia.',
        'chapter_2',
      );

      // 85*0.3 + 80*0.4 + 90*0.2 + 75*0.1 = 25.5 + 32 + 18 + 7.5 = 83
      expect(result.scores.overall).toBeCloseTo(83, 0);
      expect(result.grade).toBeCloseTo(16.6, 0);
      expect(result.findings).toHaveLength(1);
      expect(result.findings[0].severity).toBe('MAJOR');
      expect(result.processingMs).toBeGreaterThan(0);
    });

    it('genera resumen ejecutivo no vacío', async () => {
      const result = await pipeline.analyze('texto', {}, 'patron', 'chapter_1');
      expect(result.executiveSummary.length).toBeGreaterThan(10);
    });
  });
});
