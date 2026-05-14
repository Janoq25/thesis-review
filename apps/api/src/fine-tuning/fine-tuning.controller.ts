import {
  Controller, Get, Post, Param, Body,
  UseGuards, Request,
} from '@nestjs/common';
import { FineTuningService } from './fine-tuning.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('fine-tuning')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FineTuningController {
  constructor(private fineTuningService: FineTuningService) {}

  @Get('stats')
  @Roles('COORDINATOR', 'ADMIN')
  getStats() {
    return this.fineTuningService.getDatasetStats();
  }

  @Get('datasets')
  @Roles('COORDINATOR', 'ADMIN')
  getDatasets() {
    return this.fineTuningService['prisma'].fineTuningDataset.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  @Post('launch')
  @Roles('ADMIN')
  async launchManual() {
    await this.fineTuningService.launchFineTuning();
    return { message: 'Fine-tuning iniciado' };
  }

  @Post('findings/:findingId/feedback')
  @Roles('ADVISOR', 'COORDINATOR')
  async recordFeedback(
    @Param('findingId') findingId: string,
    @Body()
    body: {
      outcome: 'ACCEPTED' | 'ACCEPTED_WITH_EDIT' | 'DISCARDED' | 'SEVERITY_CHANGED';
      humanComment?: string;
      adjustedSeverity?: string;
      adjustedDescription?: string;
    },
    @Request() req: any,
  ) {
    return this.fineTuningService.recordFeedback({
      findingId,
      reviewerId: req.user.id,
      ...body,
    });
  }

  @Get('pairs')
  @Roles('ADMIN')
  getPairs() {
    return this.fineTuningService['prisma'].fineTuningPair.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' },
      include: { finding: { select: { sectionRef: true, severity: true } } },
    });
  }
}
