import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

interface AnnotationDto {
  pageNumber: number;
  paragraph?: string;
  text: string;
  type: 'comment' | 'correction' | 'suggestion';
}

@Injectable()
export class ReviewsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationService,
    private events: EventEmitter2,
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
      include: { references: { where: { status: { not: 'VERIFIED' } } } },
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

    return review;
  }

  async addAnnotation(params: {
    advanceId: string;
    reviewerId: string;
    annotation: AnnotationDto;
  }) {
    return this.prisma.reviewAnnotation.create({
      data: {
        advanceId: params.advanceId,
        reviewerId: params.reviewerId,
        pageNumber: params.annotation.pageNumber,
        paragraph: params.annotation.paragraph,
        text: params.annotation.text,
        type: params.annotation.type,
      },
    });
  }

  async getAnnotations(advanceId: string) {
    return this.prisma.reviewAnnotation.findMany({
      where: { advanceId },
      include: { reviewer: { select: { name: true } } },
      orderBy: [{ pageNumber: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async deleteAnnotation(id: string, reviewerId: string) {
    const ann = await this.prisma.reviewAnnotation.findUniqueOrThrow({ where: { id } });
    if (ann.reviewerId !== reviewerId) {
      throw new BadRequestException('Solo el autor puede eliminar esta anotación');
    }
    return this.prisma.reviewAnnotation.delete({ where: { id } });
  }
}
