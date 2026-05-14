import {
  Controller, Get, Post, Param, Body,
  UseGuards, Request, Query,
} from '@nestjs/common';
import { PlagiarismService } from './plagiarism.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('plagiarism')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlagiarismController {
  constructor(private plagiarismService: PlagiarismService) {}

  @Post('analyze/:advanceId')
  @Roles('ADVISOR', 'COORDINATOR', 'ADMIN')
  async analyze(
    @Param('advanceId') advanceId: string,
    @Body() body: { method?: 'embeddings' | 'copyleaks' },
  ) {
    const method = body.method ?? 'embeddings';
    if (method === 'embeddings') {
      // Disparar en background — no await
      this.plagiarismService.analyzeByEmbeddings(advanceId).catch(console.error);
      return { message: 'Análisis de plagio iniciado', method };
    }
    return { message: 'Use el endpoint con archivo para Copyleaks' };
  }

  @Get('report/:advanceId')
  @Roles('ADVISOR', 'COORDINATOR', 'ADMIN')
  getReport(@Param('advanceId') advanceId: string) {
    return this.plagiarismService['prisma'].plagiarismReport.findFirst({
      where: { advanceId },
      include: {
        alerts: {
          orderBy: { similarity: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  @Get('matrix')
  @Roles('COORDINATOR', 'ADMIN')
  getSimilarityMatrix(@Query('programId') programId: string) {
    return this.plagiarismService.getSimilarityMatrix(programId);
  }

  @Get('alerts/program/:programId')
  @Roles('COORDINATOR', 'ADMIN')
  getProgramAlerts(@Param('programId') programId: string) {
    return this.plagiarismService['prisma'].plagiarismAlert.findMany({
      where: {
        similarity: { gte: 0.70 },
        report: { advance: { programId } },
      },
      include: {
        report: {
          include: {
            advance: { select: { title: true, student: { select: { name: true } } } },
          },
        },
      },
      orderBy: { similarity: 'desc' },
      take: 50,
    });
  }
}
