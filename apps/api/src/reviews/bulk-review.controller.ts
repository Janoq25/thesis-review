import {
  Controller, Post, Body, Sse, Param,
  UseGuards, Request, MessageEvent,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';

// Mapa de subjects SSE por sesión de lote
const batchSessions = new Map<string, Subject<any>>();

@Controller('bulk-review')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BulkReviewController {
  constructor(
    private prisma: PrismaService,
    private events: EventEmitter2,
    @InjectQueue('ai-analysis') private aiQueue: Queue,
  ) {}

  @Post('start')
  @Roles('COORDINATOR', 'ADMIN')
  async startBatch(
    @Body() body: {
      advanceIds?: string[];
      filters?: {
        programId?: string;
        status?: string;
        advisorId?: string;
      };
    },
    @Request() req: any,
  ) {
    let advanceIds = body.advanceIds ?? [];

    // Si no se dan IDs explícitos, usar filtros
    if (advanceIds.length === 0 && body.filters) {
      const { programId, status, advisorId } = body.filters;
      const advances = await this.prisma.advance.findMany({
        where: {
          ...(programId && { programId }),
          ...(status && { status: status as any }),
          ...(advisorId && { student: { advisorId } }),
        },
        select: { id: true },
      });
      advanceIds = advances.map((a) => a.id);
    }

    if (advanceIds.length === 0) {
      return { batchId: null, count: 0, message: 'Sin avances seleccionados' };
    }

    const batchId = `batch-${req.user.id}-${Date.now()}`;

    // Crear subject para SSE de este lote
    const subject = new Subject<any>();
    batchSessions.set(batchId, subject);

    // Encolar todos los jobs
    await Promise.all(
      advanceIds.map((advanceId, i) =>
        this.aiQueue.add(
          'analyze',
          { advanceId, batchId },
          {
            attempts: 3,
            backoff: { type: 'exponential', delay: 3000 },
            delay: i * 500, // escalonar para no saturar
          },
        ),
      ),
    );

    // Auto-cerrar el subject después de 30 min
    setTimeout(() => {
      subject.complete();
      batchSessions.delete(batchId);
    }, 30 * 60_000);

    return { batchId, count: advanceIds.length };
  }

  @Sse('progress/:batchId')
  @Roles('COORDINATOR', 'ADMIN')
  progress(@Param('batchId') batchId: string): Observable<MessageEvent> {
    const subject = batchSessions.get(batchId) ?? new Subject<any>();
    return subject.pipe(
      map((data) => ({ data: JSON.stringify(data) } as MessageEvent)),
    );
  }

  @Post('apply-status')
  @Roles('COORDINATOR', 'ADMIN')
  async applyBulkStatus(
    @Body() body: {
      advanceIds: string[];
      status: string;
      comment?: string;
    },
    @Request() req: any,
  ) {
    const { advanceIds, status, comment } = body;
    const allowed = ['OBSERVED', 'APPROVED', 'REJECTED'];
    if (!allowed.includes(status)) {
      return { error: 'Estado no válido' };
    }

    const results = await this.prisma.$transaction(
      advanceIds.map((id) =>
        this.prisma.advance.update({
          where: { id },
          data: {
            status: status as any,
            review: {
              upsert: {
                create: {
                  reviewerId: req.user.id,
                  status: status as any,
                  humanComment: comment,
                  rubricAnswers: {},
                  reviewedAt: new Date(),
                },
                update: {
                  status: status as any,
                  humanComment: comment,
                  reviewedAt: new Date(),
                },
              },
            },
          },
        }),
      ),
    );

    return { updated: results.length };
  }

  // Escuchar eventos del worker para retransmitir vía SSE
  @OnEvent('ai.analysis.progress')
  handleAnalysisProgress(payload: { advanceId: string; batchId?: string; status: string; score?: number }) {
    if (!payload.batchId) return;
    const subject = batchSessions.get(payload.batchId);
    subject?.next(payload);
  }

  @OnEvent('ai.analysis.complete')
  handleAnalysisComplete(payload: { advanceId: string; batchId?: string; score: number }) {
    if (!payload.batchId) return;
    const subject = batchSessions.get(payload.batchId);
    subject?.next({ ...payload, done: true });
  }
}
