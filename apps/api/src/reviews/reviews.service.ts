import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notifications.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

interface AnnotationDto {
  pageNumber: number;
  paragraph?: string;
  text: string;
  type: 'comment' | 'correction' | 'suggestion';
}

@Injectable()
export class ReviewsService {
  private readonly logger = new Logger(ReviewsService.name);

  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
    private events: EventEmitter2,
    @InjectQueue('email') private emailQueue: Queue,
  ) {}

  async getReviewPanel(advanceId: string) {
    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
      include: {
        aiAnalysis: {
          include: { findings: { orderBy: [{ severity: 'asc' }, { createdAt: 'asc' }] } },
        },
        review: { include: { reviewer: { select: { id: true, name: true } } } },
        template: { select: { rubric: true } },
      },
    });

    const plagiarism = await this.prisma.plagiarismReport.findFirst({
      where: { advanceId },
      include: { alerts: { orderBy: { similarity: 'desc' }, take: 10 } },
      orderBy: { createdAt: 'desc' },
    });

    const references = await this.prisma.referenceAnalysis.findUnique({
      where: { advanceId },
      include: { references: { where: { verified: false } } },
    });

    return { advance, plagiarism, references };
  }

  async saveHumanReview(params: {
    advanceId: string;
    reviewerId: string;
    finalGrade: number;
    humanComment: string;
    rubricAnswers: Record<string, boolean>;
    status: 'OBSERVED' | 'APPROVED' | 'REJECTED';
  }) {
    const { advanceId, reviewerId, finalGrade, humanComment, rubricAnswers, status } = params;

    const advance = await this.prisma.advance.findUniqueOrThrow({
      where: { id: advanceId },
    });

    if (['APPROVED', 'REJECTED'].includes(advance.status)) {
      throw new BadRequestException('El avance ya fue procesado definitivamente');
    }

    const review = await this.prisma.$transaction(async (tx) => {
      const r = await tx.review.upsert({
        where: { advanceId },
        create: {
          advanceId,
          reviewerId,
          finalGrade,
          humanComment,
          rubricAnswers,
          status: status as any,
          reviewedAt: new Date(),
        },
        update: {
          finalGrade,
          humanComment,
          rubricAnswers,
          status: status as any,
          reviewedAt: new Date(),
        },
      });

      await tx.advance.update({
        where: { id: advanceId },
        data: { status: status as any },
      });

      return r;
    });

    await this.notifications.notifyReviewComplete(advanceId);
    this.events.emit('advance.reviewed', { advanceId, reviewerId, status });

    // Encolar envío de correo con reporte
    const customMessage = `Estimado(a) estudiante, tu avance ha sido revisado con el estado: ${
      status === 'APPROVED' ? 'APROBADO' : status === 'REJECTED' ? 'RECHAZADO' : 'OBSERVADO'
    }.\n\nNota: ${finalGrade}/20\n\nComentarios del revisor:\n${humanComment || 'Sin comentarios adicionales.'}`;

    await this.emailQueue.add('send', {
      type: 'advance_report',
      data: {
        advanceId,
        customMessage,
      },
    }).catch((err) => this.logger.error(`Error encolando correo para avance ${advanceId}: ${err.message}`));

    return review;
  }

  async addAnnotation(params: {
    advanceId: string;
    reviewerId: string;
    annotation: AnnotationDto;
  }) {
    // Get or create the review for this advance
    const review = await this.prisma.review.findFirst({
      where: { advanceId: params.advanceId },
    });
    if (!review) {
      throw new BadRequestException('No existe una revisión para este avance');
    }
    return this.prisma.reviewAnnotation.create({
      data: {
        reviewId: review.id,
        content: params.annotation.text,
        pageNumber: params.annotation.pageNumber,
      },
    });
  }

  async getAnnotations(advanceId: string) {
    return this.prisma.reviewAnnotation.findMany({
      where: { review: { advanceId } },
      include: { review: { include: { reviewer: { select: { name: true } } } } },
      orderBy: [{ pageNumber: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async deleteAnnotation(id: string, reviewerId: string) {
    const ann = await this.prisma.reviewAnnotation.findUniqueOrThrow({ where: { id }, include: { review: true } });
    if (ann.review.reviewerId !== reviewerId) {
      throw new BadRequestException('Solo el autor puede eliminar esta anotación');
    }
    return this.prisma.reviewAnnotation.delete({ where: { id } });
  }
}
