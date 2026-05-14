import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAI } from 'openai';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

@Injectable()
export class FineTuningService {
  private openai: OpenAI;

  constructor(private prisma: PrismaService) {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  // Llamado cuando un asesor acepta, edita o descarta un hallazgo
  async recordFeedback(params: {
    findingId: string;
    reviewerId: string;
    outcome: 'ACCEPTED' | 'ACCEPTED_WITH_EDIT' | 'DISCARDED' | 'SEVERITY_CHANGED';
    humanComment?: string;
    adjustedSeverity?: string;
    adjustedDescription?: string;
  }) {
    const finding = await this.prisma.aIFinding.findUniqueOrThrow({
      where: { id: params.findingId },
      include: {
        analysis: {
          include: {
            advance: {
              include: { program: true },
            },
          },
        },
      },
    });

    // Construir par de entrenamiento
    const originalOutput = {
      sectionRef: finding.sectionRef,
      severity: finding.severity,
      description: finding.description,
      correctionSteps: finding.correctionSteps,
      exampleImprovement: finding.exampleImprovement,
      recommendation: finding.recommendation,
    };

    const humanCorrection = {
      ...originalOutput,
      ...(params.adjustedDescription && { description: params.adjustedDescription }),
      ...(params.adjustedSeverity && { severity: params.adjustedSeverity }),
      humanComment: params.humanComment ?? null,
      outcome: params.outcome,
    };

    // Actualizar hallazgo
    await this.prisma.aIFinding.update({
      where: { id: params.findingId },
      data: {
        humanAccepted: params.outcome !== 'DISCARDED',
        humanComment: params.humanComment,
      },
    });

    // Crear par de fine-tuning
    const pair = await this.prisma.fineTuningPair.create({
      data: {
        findingId: params.findingId,
        originalOutput,
        humanCorrection,
        outcomeType: params.outcome,
        reviewerId: params.reviewerId,
        advanceType: finding.analysis.advance.advanceType,
        programId: finding.analysis.advance.programId,
      },
    });

    // Verificar si alcanzamos el umbral para fine-tuning automático
    await this.checkAndTriggerFineTuning();

    return pair;
  }

  async checkAndTriggerFineTuning() {
    const pairCount = await this.prisma.fineTuningPair.count({
      where: { datasetId: null },
    });

    if (pairCount >= (Number(process.env.FT_MIN_PAIRS) || 500)) {
      await this.launchFineTuning();
    }
  }

  async launchFineTuning(): Promise<void> {
    // 1. Obtener pares sin asignar a dataset
    const pairs = await this.prisma.fineTuningPair.findMany({
      where: { datasetId: null },
      take: 2000,
    });

    // 2. Crear dataset en BD
    const dataset = await this.prisma.fineTuningDataset.create({
      data: {
        name: `ft-dataset-${new Date().toISOString().slice(0, 10)}`,
        description: `Auto-generado con ${pairs.length} pares de feedback`,
        status: 'TRAINING',
        pairCount: pairs.length,
        pairs: { connect: pairs.map((p) => ({ id: p.id })) },
      },
    });

    // 3. Generar archivo JSONL para OpenAI fine-tuning
    const jsonlLines = pairs.map((pair) => {
      const original = pair.originalOutput as any;
      const correction = pair.humanCorrection as any;

      return JSON.stringify({
        messages: [
          {
            role: 'system',
            content:
              'Eres un evaluador académico experto en tesis universitarias. ' +
              'Analiza hallazgos de revisión y genera retroalimentación precisa y accionable. ' +
              'Responde siempre con JSON válido.',
          },
          {
            role: 'user',
            content: `Evalúa este hallazgo en un avance de tesis (tipo: ${pair.advanceType}):\n` +
              `Sección: ${original.sectionRef}\n` +
              `Severidad inicial: ${original.severity}\n` +
              `Descripción: ${original.description}`,
          },
          {
            role: 'assistant',
            content: JSON.stringify({
              sectionRef: correction.sectionRef,
              severity: correction.severity,
              description: correction.description,
              correctionSteps: correction.correctionSteps,
              exampleImprovement: correction.exampleImprovement,
              recommendation: correction.recommendation,
            }),
          },
        ],
      });
    });

    // 4. Escribir archivo JSONL temporal
    const tmpFile = path.join(os.tmpdir(), `ft-${dataset.id}.jsonl`);
    await fs.writeFile(tmpFile, jsonlLines.join('\n'));

    // 5. Subir a OpenAI y crear job
    const fileStream = await fs.readFile(tmpFile);
    const uploadedFile = await this.openai.files.create({
      file: new File([fileStream], `ft-${dataset.id}.jsonl`, { type: 'application/jsonl' }),
      purpose: 'fine-tune',
    });

    const job = await this.openai.fineTuning.jobs.create({
      training_file: uploadedFile.id,
      model: 'gpt-4o-mini-2024-07-18',
      hyperparameters: { n_epochs: 3 },
      suffix: `thesis-v${Date.now()}`,
    });

    // 6. Actualizar BD con job ID
    await this.prisma.fineTuningDataset.update({
      where: { id: dataset.id },
      data: { jobId: job.id },
    });

    // 7. Encolar polling del job en BullMQ
    // ftStatusQueue.add('poll-job', { jobId: job.id, datasetId: dataset.id });

    await fs.unlink(tmpFile).catch(() => {});
  }

  async pollFineTuningJob(jobId: string, datasetId: string) {
    const job = await this.openai.fineTuning.jobs.retrieve(jobId);

    if (job.status === 'succeeded') {
      await this.prisma.fineTuningDataset.update({
        where: { id: datasetId },
        data: {
          status: 'COMPLETED',
          modelId: job.fine_tuned_model,
          completedAt: new Date(),
        },
      });
      // Actualizar variable de entorno activa en runtime
      process.env.ACTIVE_FT_MODEL = job.fine_tuned_model!;
    } else if (job.status === 'failed') {
      await this.prisma.fineTuningDataset.update({
        where: { id: datasetId },
        data: { status: 'FAILED' },
      });
    }

    return job.status;
  }

  async getDatasetStats() {
    const [totalPairs, byOutcome, byProgram] = await Promise.all([
      this.prisma.fineTuningPair.count(),
      this.prisma.fineTuningPair.groupBy({
        by: ['outcomeType'],
        _count: { _all: true },
      }),
      this.prisma.fineTuningPair.groupBy({
        by: ['programId'],
        _count: { _all: true },
      }),
    ]);

    return { totalPairs, byOutcome, byProgram };
  }
}
