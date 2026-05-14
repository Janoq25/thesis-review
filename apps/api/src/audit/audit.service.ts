// apps/api/src/audit/audit.service.ts

import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async log(params: {
    userId: string;
    action: string;
    entity: string;
    entityId: string;
    metadata?: Record<string, any>;
  }) {
    return this.prisma.auditLog.create({ data: params });
  }

  @OnEvent('advance.created')
  async onAdvanceCreated(payload: { advanceId: string; studentId: string }) {
    await this.log({
      userId: payload.studentId,
      action: 'CREATE',
      entity: 'Advance',
      entityId: payload.advanceId,
    });
  }

  @OnEvent('advance.reviewed')
  async onAdvanceReviewed(payload: {
    advanceId: string;
    reviewerId: string;
    status: string;
  }) {
    await this.log({
      userId: payload.reviewerId,
      action: `REVIEW_${payload.status}`,
      entity: 'Advance',
      entityId: payload.advanceId,
      metadata: { status: payload.status },
    });
  }

  async getEntityHistory(entity: string, entityId: string) {
    return this.prisma.auditLog.findMany({
      where: { entity, entityId },
      include: { user: { select: { id: true, name: true, role: true } } } as any,
      orderBy: { createdAt: 'desc' },
    });
  }
}
