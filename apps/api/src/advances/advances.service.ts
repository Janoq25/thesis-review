import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationService } from '../notifications/notifications.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

const ALLOWED_TYPES = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

@Injectable()
export class AdvancesService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
    private notifications: NotificationService,
    private events: EventEmitter2,
    @InjectQueue('ai-analysis') private aiQueue: Queue,
    @InjectQueue('plagiarism-analysis') private plagiarismQueue: Queue,
    @InjectQueue('reference-check') private refQueue: Queue,
  ) {}

  async upload(params: {
    studentId: string;
    programId: string;
    templateId: string;
    advanceType: string;
    file: Express.Multer.File;
  }) {
    const { studentId, programId, templateId, advanceType, file } = params;

    // Validaciones
    if (!ALLOWED_TYPES.includes(file.mimetype)) {
      throw new BadRequestException('Solo se aceptan archivos PDF o Word (.docx)');
    }
    if (file.size > MAX_SIZE_BYTES) {
      throw new BadRequestException('El archivo supera el límite de 50 MB');
    }

    // Verificar que el programa y template existen
    const template = await this.prisma.thesisTemplate.findFirst({
      where: { id: templateId, programId, isActive: true },
    });
    if (!template) throw new NotFoundException('Template no encontrado para este programa');

    // Calcular número de versión
    const lastVersion = await this.prisma.advance.findFirst({
      where: { studentId, programId, advanceType },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (lastVersion?.version ?? 0) + 1;

    // Subir archivo a MinIO/S3
    const fileType = file.mimetype.includes('pdf') ? 'pdf' : 'docx';
    const fileKey = `advances/${programId}/${studentId}/${advanceType}/v${version}.${fileType}`;
    await this.storage.upload(fileKey, file.buffer, file.mimetype);

    // Crear registro en BD
    const advance = await this.prisma.advance.create({
      data: {
        studentId,
        programId,
        templateId,
        advanceType,
        version,
        fileKey,
        fileType,
        fileSizeBytes: file.size,
        title: `${advanceType} v${version}`,
        status: 'PENDING',
      },
    });

    // Encolar jobs en paralelo
    await Promise.all([
      this.aiQueue.add('analyze', { advanceId: advance.id }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
      }),
      this.plagiarismQueue.add('analyze', {
        advanceId: advance.id,
        method: 'embeddings',
      }, { delay: 10_000 }), // esperar a que AI termine primero
      this.refQueue.add('check', { advanceId: advance.id }, { delay: 15_000 }),
    ]);

    // Emitir evento para audit log
    this.events.emit('advance.created', { advanceId: advance.id, studentId });

    return advance;
  }

  async getAdvanceDetail(advanceId: string, requesterId: string, requesterRole: string) {
    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
      include: {
        student: { select: { id: true, name: true, email: true } },
        program: { select: { id: true, name: true } },
        template: { select: { id: true, name: true, version: true } },
        aiAnalysis: {
          include: {
            findings: { orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }] },
          },
        },
        review: { include: { reviewer: { select: { id: true, name: true } } } },
      },
    });

    // Estudiantes solo ven sus propios avances
    if (requesterRole === 'STUDENT' && advance.studentId !== requesterId) {
      throw new NotFoundException('Avance no encontrado');
    }

    return advance;
  }

  async listForStudent(studentId: string) {
    return this.prisma.advance.findMany({
      where: { studentId },
      include: {
        aiAnalysis: {
          select: {
            overallScore: true,
            gradeConverted: true,
            _count: { select: { findings: true } },
          },
        },
        program: { select: { name: true } },
      },
      orderBy: [{ advanceType: 'asc' }, { version: 'desc' }],
    });
  }

  async listForAdvisor(advisorId: string, filters: {
    status?: string;
    programId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { status, programId, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;

    const where: any = {
      student: { advisorId },
      ...(status && { status }),
      ...(programId && { programId }),
    };

    const [advances, total] = await Promise.all([
      this.prisma.advance.findMany({
        where,
        include: {
          student: { select: { id: true, name: true } },
          program: { select: { name: true } },
          aiAnalysis: { select: { overallScore: true, gradeConverted: true } },
          review: { select: { status: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.advance.count({ where }),
    ]);

    return { advances, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  async updateStatus(
    advanceId: string,
    status: string,
    reviewerId: string,
    comment?: string,
    finalGrade?: number,
  ) {
    const advance = await this.prisma.advance.findUniqueOrThrow({ where: { id: advanceId } });

    await this.prisma.$transaction([
      this.prisma.advance.update({ where: { id: advanceId }, data: { status: status as any } }),
      this.prisma.review.upsert({
        where: { advanceId },
        create: {
          advanceId,
          reviewerId,
          status: status as any,
          humanComment: comment,
          finalGrade,
          reviewedAt: new Date(),
          rubricAnswers: {},
        },
        update: {
          status: status as any,
          humanComment: comment,
          finalGrade,
          reviewedAt: new Date(),
        },
      }),
    ]);

    // Notificar al estudiante
    await this.notifications.notifyReviewComplete(advanceId);

    // Audit log
    this.events.emit('advance.reviewed', { advanceId, reviewerId, status });

    return { advanceId, status };
  }

  async downloadFile(advanceId: string): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
      select: { fileKey: true, fileType: true, title: true },
    });

    const buffer = await this.storage.download(advance.fileKey);
    const contentType = advance.fileType === 'pdf'
      ? 'application/pdf'
      : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    return {
      buffer,
      contentType,
      filename: `${advance.title}.${advance.fileType}`,
    };
  }

    async listAll(filters: {
    status?: string;
    programId?: string;
    page?: number;
    pageSize?: number;
  }) {
    const { status, programId, page = 1, pageSize = 20 } = filters;
    const skip = (page - 1) * pageSize;
    const where: any = {
      ...(status && { status }),
      ...(programId && { programId }),
    };

    const [advances, total] = await Promise.all([
      this.prisma.advance.findMany({
        where,
        include: {
          student: { select: { id: true, name: true } },
          program: { select: { name: true } },
          aiAnalysis: { select: { overallScore: true, gradeConverted: true } },
          review: { select: { status: true, finalGrade: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.advance.count({ where }),
    ]);

    return { advances, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

}
