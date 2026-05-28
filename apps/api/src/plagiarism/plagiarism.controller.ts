import {
  Controller, Get, Post, Param, Body,
  UseGuards, Request, Query, Res,
  ForbiddenException, NotFoundException,
} from '@nestjs/common';
import { PlagiarismService } from './plagiarism.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Response } from 'express';

@Controller('plagiarism')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PlagiarismController {
  constructor(private plagiarismService: PlagiarismService) {}

  @Post('analyze/:advanceId')
  @Roles('ADVISOR', 'COORDINATOR', 'ADMIN')
  async analyze(
    @Param('advanceId') advanceId: string,
    @Body() body: { method?: 'copyleaks' },
  ) {
    const method = body.method ?? 'copyleaks';
    if (method === 'copyleaks') {
      this.plagiarismService.analyzeWithCopyleaks(advanceId).catch(console.error);
      return { message: 'Análisis de plagio e IA con Copyleaks iniciado', method };
    }
    return { message: 'Método no soportado' };
  }

  @Get('report/:advanceId/view')
  async viewPdfReport(
    @Param('advanceId') advanceId: string,
    @Request() req: any,
    @Res() res: any,
  ) {
    const advance = await this.plagiarismService['prisma'].advance.findUniqueOrThrow({
      where: { id: advanceId },
    });

    if (req.user.role === 'STUDENT' && advance.studentId !== req.user.id) {
      throw new ForbiddenException('No tiene permisos para ver este reporte');
    }

    const report = await this.plagiarismService['prisma'].plagiarismReport.findFirst({
      where: { advanceId },
    });

    if (!report || !report.copyleaksReportKey) {
      throw new NotFoundException('Reporte PDF no encontrado o aún en procesamiento');
    }

    const buffer = await this.plagiarismService['storage'].download(report.copyleaksReportKey);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="reporte-plagio-${advanceId}.pdf"`);
    res.send(buffer);
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
