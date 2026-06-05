import { Controller, Get, Post, Param, Body, UseGuards } from '@nestjs/common';
import { DeadlinesService } from './deadlines.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('deadlines')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DeadlinesController {
  constructor(private readonly deadlinesService: DeadlinesService) {}

  @Get('program/:programId')
  getDeadlines(@Param('programId') programId: string) {
    return this.deadlinesService.getDeadlinesForProgram(programId);
  }

  @Post()
  @Roles('COORDINATOR', 'ADMIN')
  updateDeadlines(
    @Body() body: { programId: string; deadlines: Record<string, string> },
  ) {
    return this.deadlinesService.updateDeadlines(body.programId, body.deadlines);
  }
}
