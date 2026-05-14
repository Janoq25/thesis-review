import { Worker, Job } from 'bullmq';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { PrismaService } from '../prisma/prisma.service';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

let prisma: PrismaService;
let embeddings: OpenAIEmbeddings;
let splitter: RecursiveCharacterTextSplitter;

(async () => {
  const app = await NestFactory.createApplicationContext(AppModule);
  prisma = app.get(PrismaService);
  embeddings = new OpenAIEmbeddings({
    apiKey: process.env.OPENAI_API_KEY,
    model: 'text-embedding-3-large',
  });
  splitter = new RecursiveCharacterTextSplitter({ chunkSize: 1000, chunkOverlap: 150 });
})();

export const indexTemplateWorker = new Worker(
  'ai-analysis', // mismo queue, discriminar por nombre del job
  async (job: Job) => {
    if (job.name !== 'index-template') return;

    const { templateId, text } = job.data as { templateId: string; text: string };

    const chunks = await splitter.splitText(text);
    const vecs = await embeddings.embedDocuments(chunks);

    await prisma.templateChunk.deleteMany({ where: { templateId } });

    for (let i = 0; i < chunks.length; i++) {
      await prisma.$executeRaw`
        INSERT INTO "TemplateChunk" (id, "templateId", "sectionName", content, embedding, "chunkIndex")
        VALUES (gen_random_uuid(), ${templateId}, 'auto', ${chunks[i]},
                ${vecs[i]}::vector, ${i})
      `;
    }

    return { templateId, chunksIndexed: chunks.length };
  },
  { connection: { host: process.env.REDIS_HOST, port: 6379 }, concurrency: 2 },
);
