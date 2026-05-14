import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { CrossRefService } from './crossref.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('references')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReferencesController {
  constructor(private crossRefService: CrossRefService) {}

  @Post('analyze/:advanceId')
  @Roles('ADVISOR', 'COORDINATOR', 'ADMIN')
  async analyze(@Param('advanceId') advanceId: string) {
    const advance = await this.crossRefService['prisma'].advance.findUniqueOrThrow({
      where: { id: advanceId },
    });

    // Obtener chunk de texto del avance de la BD
    const chunks = await this.crossRefService['prisma'].advanceChunk.findMany({
      where: { advanceId },
      select: { content: true },
    });
    const fullText = chunks.map((c) => c.content).join('\n\n');

    // Disparar en background
    this.crossRefService.analyzeReferences(advanceId, fullText).catch(console.error);
    return { message: 'Análisis de referencias iniciado' };
  }

  @Get('report/:advanceId')
  @Roles('ADVISOR', 'COORDINATOR', 'ADMIN', 'STUDENT')
  getReport(@Param('advanceId') advanceId: string) {
    return this.crossRefService['prisma'].referenceAnalysis.findUnique({
      where: { advanceId },
      include: {
        references: { orderBy: { status: 'asc' } },
      },
    });
  }

  @Get('summary/program/:programId')
  @Roles('COORDINATOR', 'ADMIN')
  async getProgramSummary(@Param('programId') programId: string) {
    const data = await this.crossRefService['prisma'].reference.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: {
        analysis: { advance: { programId } },
      },
    });

    const total = data.reduce((sum, d) => sum + d._count._all, 0);

    return {
      total,
      breakdown: data.map((d) => ({
        status: d.status,
        count: d._count._all,
        percentage: Math.round((d._count._all / total) * 100),
      })),
    };
  }
}
