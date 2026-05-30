import { Controller, Get, Post, Patch, Delete, Param, Body, UseGuards, Request } from '@nestjs/common';
import { AssignmentsService } from './assignments.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Assignments')
@ApiBearerAuth()
@Controller('assignments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AssignmentsController {
  constructor(private readonly assignmentsService: AssignmentsService) {}

  @Post()
  @Roles('ADVISOR')
  create(
    @Request() req: any,
    @Body() body: {
      title: string;
      description?: string;
      startDate?: string;
      deadlineDate?: string;
      templateId?: string;
      advanceType?: string;
    }
  ) {
    return this.assignmentsService.create(req.user.id, body);
  }

  @Get('advisor')
  @Roles('ADVISOR')
  findByAdvisor(@Request() req: any) {
    return this.assignmentsService.findByAdvisor(req.user.id);
  }

  @Get('student')
  @Roles('STUDENT')
  findForStudent(@Request() req: any) {
    return this.assignmentsService.findForStudent(req.user.id);
  }

  @Get(':id')
  findOne(@Request() req: any, @Param('id') id: string) {
    return this.assignmentsService.findOne(id, req.user);
  }

  @Patch(':id')
  @Roles('ADVISOR')
  update(
    @Param('id') id: string,
    @Body() body: {
      title?: string;
      description?: string;
      startDate?: string | null;
      deadlineDate?: string | null;
      templateId?: string | null;
      advanceType?: string;
      isActive?: boolean;
    },
  ) {
    return this.assignmentsService.update(id, body);
  }

  @Delete(':id')
  @Roles('ADVISOR')
  remove(@Param('id') id: string) {
    return this.assignmentsService.remove(id);
  }
}
