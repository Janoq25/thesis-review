import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ChatOpenAI } from '@langchain/openai';

interface ExtractedReference {
  rawText: string;
  authors: string | null;
  year: number | null;
  title: string | null;
  journal: string | null;
  volume: string | null;
  issue: string | null;
  doi: string | null;
  url: string | null;
}

interface CrossRefWork {
  DOI?: string;
  title?: string[];
  author?: Array<{ family: string; given: string }>;
  issued?: { 'date-parts': number[][] };
  'container-title'?: string[];
  volume?: string;
  issue?: string;
  score?: number;
}

@Injectable()
export class CrossRefService {
  private readonly logger = new Logger(CrossRefService.name);
  private llm: ChatOpenAI;
  private readonly CROSSREF_BASE = 'https://api.crossref.org/works';
  private readonly SIMILARITY_THRESHOLD = 0.75;

  constructor(private prisma: PrismaService) {
    this.llm = new ChatOpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
      temperature: 0,
      modelKwargs: { response_format: { type: 'json_object' } },
    });
  }

  async analyzeReferences(advanceId: string, documentText: string): Promise<void> {
    // 1. Extraer referencias con IA
    const extracted = await this.extractReferencesWithAI(documentText);

    // 2. Crear análisis base
    const analysis = await this.prisma.referenceAnalysis.create({
      data: { advanceId },
    });

    // 3. Verificar cada referencia contra CrossRef
    const results = await Promise.allSettled(
      extracted.map((ref) => this.verifyReference(ref)),
    );

    const references = results.map((result, i) => {
      if (result.status === 'fulfilled') return result.value;
      // En caso de error de red, marcar como no verificada
      return {
        ...extracted[i],
        status: 'NOT_FOUND' as const,
        errorType: 'network_error',
        suggestion: 'No se pudo verificar por error de conexión',
        crossrefData: null,
      };
    });

    // 4. Guardar referencias individuales
    const verifiedCount = references.filter((r) => r.status === 'VERIFIED').length;
    const errorCount = references.filter(
      (r) => r.status !== 'VERIFIED',
    ).length;

    await this.prisma.reference.createMany({
      data: references.map((ref) => ({
        analysisId: analysis.id,
        rawText: ref.rawText,
        authors: ref.authors ?? null,
        year: ref.year ?? null,
        title: ref.title ?? null,
        doi: ref.doi ?? null,
        verified: ref.status === 'VERIFIED',
        crossrefData: ref.crossrefData ?? undefined,
        issues: ref.errorType ? [ref.errorType] : [],
      })),
    });

    this.logger.log(
      `Referencias verificadas — avance ${advanceId}: ${verifiedCount}/${extracted.length} OK, ${errorCount} errores`,
    );
  }

  private async extractReferencesWithAI(text: string): Promise<ExtractedReference[]> {
    // Buscar la sección de bibliografía en el texto
    const bibIndex = text.search(
      /referencias\s+bibliográficas?|bibliografía|references/i,
    );
    const bibSection = bibIndex !== -1
      ? text.slice(bibIndex, bibIndex + 6000)
      : text.slice(-4000); // fallback: últimas 4000 chars

    // MOCK: En lugar de usar la API de OpenAI, devolvemos referencias de prueba
    this.logger.log('Utilizando MOCK para extracción de referencias');
    
    // Simular latencia de red
    await new Promise((resolve) => setTimeout(resolve, 1500));

    return [
      {
        rawText: "Goodfellow, I., Bengio, Y., & Courville, A. (2016). Deep Learning. MIT Press.",
        authors: "Goodfellow, I., Bengio, Y., & Courville, A.",
        year: 2016,
        title: "Deep Learning",
        journal: null,
        volume: null,
        issue: null,
        doi: null,
        url: "http://www.deeplearningbook.org"
      },
      {
        rawText: "Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., ... & Polosukhin, I. (2017). Attention is all you need. Advances in neural information processing systems, 30.",
        authors: "Vaswani, A., Shazeer, N., Parmar, N., Uszkoreit, J., Jones, L., Gomez, A. N., ... & Polosukhin, I.",
        year: 2017,
        title: "Attention is all you need",
        journal: "Advances in neural information processing systems",
        volume: "30",
        issue: null,
        doi: "10.48550/arXiv.1706.03762",
        url: "https://arxiv.org/abs/1706.03762"
      }
    ];
  }

  private async verifyReference(ref: ExtractedReference): Promise<
    ExtractedReference & {
      status: string;
      errorType?: string;
      suggestion?: string;
      crossrefData?: any;
    }
  > {
    // Si tiene DOI, verificar directamente
    if (ref.doi) {
      return this.verifyByDOI(ref);
    }
    // Si no tiene DOI, buscar por título + autor
    if (ref.title) {
      return this.verifyByQuery(ref);
    }
    return { ...ref, status: 'DOI_MISSING', errorType: 'no_doi', suggestion: 'Busque el DOI en https://doi.org' };
  }

  private async verifyByDOI(ref: ExtractedReference) {
    const cleanDoi = ref.doi!.replace(/^https?:\/\/doi\.org\//i, '');

    const res = await fetch(`${this.CROSSREF_BASE}/${encodeURIComponent(cleanDoi)}`, {
      headers: { 'User-Agent': 'ThesisReviewSystem/1.0 (mailto:admin@university.edu)' },
    });

    if (res.status === 404) {
      // DOI no existe — buscar por título para sugerir DOI correcto
      const suggestion = await this.findCorrectDOI(ref);
      return {
        ...ref,
        status: 'DOI_INCORRECT' as const,
        errorType: 'doi_not_found',
        suggestion,
        crossrefData: null,
      };
    }

    const data: { message: CrossRefWork } = await res.json();
    const work = data.message;

    // Verificar que el año y título coincidan razonablemente
    const workYear = work.issued?.['date-parts']?.[0]?.[0];
    if (ref.year && workYear && Math.abs(workYear - ref.year) > 1) {
      return {
        ...ref,
        status: 'DOI_INCORRECT' as const,
        errorType: 'wrong_year',
        suggestion: `El DOI corresponde al año ${workYear}, no ${ref.year}. Verificar edición correcta.`,
        crossrefData: work,
      };
    }

    return { ...ref, status: 'VERIFIED' as const, crossrefData: work };
  }

  private async verifyByQuery(ref: ExtractedReference) {
    const query = [ref.title, ref.authors].filter(Boolean).join(' ').substring(0, 120);

    const res = await fetch(
      `${this.CROSSREF_BASE}?query=${encodeURIComponent(query)}&rows=3&select=DOI,title,author,issued,container-title,score`,
      { headers: { 'User-Agent': 'ThesisReviewSystem/1.0 (mailto:admin@university.edu)' } },
    );

    if (!res.ok) {
      return { ...ref, status: 'NOT_FOUND' as const, errorType: 'api_error', crossrefData: null };
    }

    const data: { message: { items: CrossRefWork[] } } = await res.json();
    const best = data.message.items[0];

    if (!best || (best.score ?? 0) < 50) {
      return {
        ...ref,
        status: 'POSSIBLE_HALLUCINATION' as const,
        errorType: 'not_found_in_crossref',
        suggestion:
          'Esta referencia no fue encontrada en CrossRef. Verifique que el título y autores sean exactos, o que la fuente exista realmente.',
        crossrefData: null,
      };
    }

    // Verificar similitud de título
    const crossrefTitle = best.title?.[0] ?? '';
    const titleSimilarity = this.cosineSimilaritySimple(
      ref.title ?? '',
      crossrefTitle,
    );

    if (titleSimilarity < this.SIMILARITY_THRESHOLD) {
      return {
        ...ref,
        status: 'NOT_FOUND' as const,
        errorType: 'low_title_match',
        suggestion: `Título más parecido en CrossRef: "${crossrefTitle}" (DOI: ${best.DOI})`,
        crossrefData: best,
      };
    }

    // Verificar si el journal está indexado (tiene DOI = sí lo está)
    if (!best.DOI) {
      return { ...ref, status: 'UNINDEXED' as const, errorType: 'unindexed_journal', crossrefData: best };
    }

    return {
      ...ref,
      doi: best.DOI,
      status: 'VERIFIED' as const,
      suggestion: `DOI encontrado: ${best.DOI}`,
      crossrefData: best,
    };
  }

  private async findCorrectDOI(ref: ExtractedReference): Promise<string> {
    if (!ref.title) return 'Busque el DOI en https://doi.org';
    const query = [ref.title, ref.authors].filter(Boolean).join(' ').substring(0, 100);
    const res = await fetch(
      `${this.CROSSREF_BASE}?query=${encodeURIComponent(query)}&rows=1&select=DOI,title`,
    );
    if (!res.ok) return 'Error al buscar DOI alternativo';
    const data: { message: { items: CrossRefWork[] } } = await res.json();
    const item = data.message.items[0];
    return item?.DOI
      ? `DOI sugerido: ${item.DOI} — Título: "${item.title?.[0]}"`
      : 'No se encontró DOI alternativo. Verifique manualmente.';
  }

  // Similitud simple por jaccard de palabras (sin embeddings para ahorrar costo)
  private cosineSimilaritySimple(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
    const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
    const intersection = [...wordsA].filter((w) => wordsB.has(w)).length;
    const union = new Set([...wordsA, ...wordsB]).size;
    return union === 0 ? 0 : intersection / union;
  }
}
