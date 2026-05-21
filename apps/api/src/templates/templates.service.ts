import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { AzureChatOpenAI } from '@langchain/openai';
import { createAzureChatLLM } from '../common/azure-openai.config';
import mammoth from 'mammoth';
import pdfParse from 'pdf-parse';

@Injectable()
export class TemplatesService {
  private llm: AzureChatOpenAI;

  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    @InjectQueue('template-indexing') private templateQueue: Queue,
  ) {
    this.llm = createAzureChatLLM();
  }

  async uploadTemplate(params: {
    programId: string;
    name: string;
    version: string;
    file: Express.Multer.File;
    rubric?: object;
    uploaderId: string;
  }) {
    const { programId, name, version, file, rubric, uploaderId } = params;

    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException('Solo se aceptan PDF o Word (.docx)');
    }

    // Verificar que el programa existe
    await this.prisma.program.findUniqueOrThrow({ where: { id: programId } });

    const fileType = file.mimetype.includes('pdf') ? 'pdf' : 'docx';
    const fileKey = `templates/${programId}/${name.replace(/\s+/g, '-')}-v${version}.${fileType}`;

    // Subir archivo
    await this.storage.upload(fileKey, file.buffer, file.mimetype);

    // Desactivar versión anterior del mismo programa
    await this.prisma.thesisTemplate.updateMany({
      where: { programId, isActive: true },
      data: { isActive: false },
    });

    // Extraer texto para schema
    const text = fileType === 'pdf'
      ? (await pdfParse(file.buffer)).text
      : (await mammoth.extractRawText({ buffer: file.buffer })).value;

    // Extraer estructura con GPT-4o
    const extractedSchema = await this.extractStructure(text);

    const defaultRubric = {
      dimensions: [
        { name: 'structure', weight: 0.3, maxScore: 100 },
        { name: 'content', weight: 0.4, maxScore: 100 },
        { name: 'form', weight: 0.2, maxScore: 100 },
        { name: 'originality', weight: 0.1, maxScore: 100 },
      ],
      maxGrade: Number(process.env.MAX_GRADE ?? 20),
      approvalThreshold: Number(process.env.MAX_GRADE ?? 20) * 0.65,
    };

    const template = await this.prisma.thesisTemplate.create({
      data: {
        programId,
        name,
        version,
        fileKey,
        isActive: true,
        extractedSchema,
        rubric: rubric ?? defaultRubric,
      },
    });

    // Encolar generación de embeddings del template
    await this.templateQueue.add(
      'index-template',
      { templateId: template.id, text: text.substring(0, 30000) },
      { priority: 1, attempts: 2 },
    );

    return template;
  }

  private async extractStructure(text: string): Promise<object> {
    const response = await this.llm.invoke([
      {
        role: 'system',
        content:
          'Analiza este documento patrón de tesis universitaria. ' +
          'Extrae la estructura completa incluyendo: secciones obligatorias, ' +
          'subsecciones, extensión mínima sugerida (páginas), formato de citas, ' +
          'requisitos de lenguaje. ' +
          'Responde SOLO con JSON: ' +
          '{"sections":[{"name":"...","required":bool,"minPages":N,"subsections":["..."],"notes":"..."}],' +
          '"citationFormat":"APA7|IEEE|Chicago",' +
          '"minReferences":N,' +
          '"languageRequirement":"academic_spanish|english",' +
          '"specialRequirements":["..."]}',
      },
      { role: 'user', content: text.substring(0, 8000) },
    ]);

    try {
      return JSON.parse(response.content as string);
    } catch {
      return {
        sections: [],
        citationFormat: 'APA 7',
        minReferences: 15,
        languageRequirement: 'academic_spanish',
        specialRequirements: [],
        extractionError: 'No se pudo parsear la estructura automáticamente',
      };
    }
  }

  async listByProgram(programId: string) {
    return this.prisma.thesisTemplate.findMany({
      where: { programId },
      select: {
        id: true, name: true, version: true, isActive: true,
        createdAt: true,
        _count: { select: { advances: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getOne(id: string) {
    return this.prisma.thesisTemplate.findUniqueOrThrow({
      where: { id },
      include: { program: { select: { name: true } } },
    });
  }

  async updateRubric(id: string, rubric: object) {
    return this.prisma.thesisTemplate.update({
      where: { id },
      data: { rubric },
    });
  }

  async setActive(id: string) {
    const template = await this.prisma.thesisTemplate.findUniqueOrThrow({ where: { id } });
    await this.prisma.thesisTemplate.updateMany({
      where: { programId: template.programId, isActive: true },
      data: { isActive: false },
    });
    return this.prisma.thesisTemplate.update({ where: { id }, data: { isActive: true } });
  }

  async delete(id: string) {
    const template = await this.prisma.thesisTemplate.findUniqueOrThrow({ where: { id } });
    const usedBy = await this.prisma.advance.count({ where: { templateId: id } });
    if (usedBy > 0) {
      throw new BadRequestException(`No se puede eliminar: ${usedBy} avances usan este template`);
    }
    await this.storage.delete(template.fileKey);
    return this.prisma.thesisTemplate.delete({ where: { id } });
  }
}
