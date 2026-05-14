import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { StatsService } from './stats.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('stats')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StatsController {
  constructor(private statsService: StatsService) {}

  @Get('dashboard')
  @Roles('ADVISOR', 'COORDINATOR', 'ADMIN')
  getDashboard(@Query('programId') programId?: string) {
    return this.statsService.getDashboardKPIs(programId);
  }

  @Get('monthly-trend')
  @Roles('COORDINATOR', 'ADMIN')
  getMonthlyTrend(
    @Query('programId') programId?: string,
    @Query('months') months = '8',
  ) {
    return this.statsService.getMonthlyTrend(programId, Number(months));
  }

  @Get('advisor-workload')
  @Roles('COORDINATOR', 'ADMIN')
  getAdvisorWorkload(@Query('programId') programId?: string) {
    return this.statsService.getAdvisorWorkload(programId);
  }

  @Get('student/:studentId/evolution')
  getStudentEvolution(@Query('studentId') studentId: string) {
    return this.statsService.getStudentEvolution(studentId);
  }

  @Get('grade-distribution')
  @Roles('COORDINATOR', 'ADMIN')
  getGradeDistribution(@Query('programId') programId?: string) {
    return this.statsService.getGradeDistribution(programId);
  }

  @Get('ai-concordance')
  @Roles('COORDINATOR', 'ADMIN')
  getAIConcordance(@Query('programId') programId?: string) {
    return this.statsService['calculateAIConcordance'](programId);
  }
}
