import { Worker, Job } from 'bullmq';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { AzureOpenAIEmbeddings } from '@langchain/openai';
import { createAzureEmbeddings } from '../common/azure-openai.config';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { getRedisConnection } from '../common/redis-connection';
import { jobLog, jobError } from '../common/job-logger';

const SCOPE = 'template-indexing';

let prisma: PrismaService;
let embeddings: AzureOpenAIEmbeddings;
let splitter: RecursiveCharacterTextSplitter;

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  prisma = app.get(PrismaService);
  embeddings = createAzureEmbeddings();
  splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 150 });
  jobLog(SCOPE, 'Worker inicializado');
})();

export const indexTemplateWorker = new Worker(
  'template-indexing',
  async (job: Job) => {
    if (job.name !== 'index-template') {
      return;
    }

    const { templateId, text } = job.data as { templateId: string; text: string };
    jobLog(SCOPE, 'Job recibido', { jobId: job.id, templateId, textLength: text?.length ?? 0 });

    try {
      const chunks = await splitter.splitText(text);
      jobLog(SCOPE, 'Chunks generados', { templateId, chunkCount: chunks.length });

      jobLog(SCOPE, 'Generando embeddings en Azure', {
        templateId,
        deployment:
          process.env.AZURE_OPENAI_EMBEDDINGS_DEPLOYMENT ??
          process.env.AZURE_OPENAI_EMBEDDING_DEPLOYMENT ??
          'text-embedding-3-large',
      });

      const vecs = await embeddings.embedDocuments(chunks);
      jobLog(SCOPE, 'Embeddings generados', { templateId, vectorCount: vecs.length });

      await prisma.templateChunk.deleteMany({ where: { templateId } });

      for (let i = 0; i < chunks.length; i++) {
        await prisma.$executeRaw`
          INSERT INTO "TemplateChunk" (id, "templateId", "sectionName", content, embedding, "chunkIndex")
          VALUES (gen_random_uuid(), ${templateId}, 'auto', ${chunks[i]},
                  ${vecs[i]}::vector, ${i})
        `;
      }

      jobLog(SCOPE, 'Indexación completada', { templateId, chunksIndexed: chunks.length });
      return { templateId, chunksIndexed: chunks.length };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      jobError(SCOPE, 'Error en indexación', { jobId: job.id, templateId, error: message });
      throw err;
    }
  },
  { connection: getRedisConnection(), concurrency: 1 },
);

indexTemplateWorker.on('failed', (job, err) => {
  jobError(SCOPE, 'Job fallido', { jobId: job?.id, error: err?.message });
});

jobLog(SCOPE, 'Worker registrado en cola template-indexing');
