import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, UploadedFile, UseInterceptors,
  UseGuards, Request, HttpCode, HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TemplatesService } from './templates.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ApiTags, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Templates')
@ApiBearerAuth()
@Controller('templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TemplatesController {
  constructor(private templatesService: TemplatesService) {}

  @Post()
  @Roles('COORDINATOR', 'ADMIN')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { programId: string; name: string; version: string; rubric?: string },
    @Request() req: any,
  ) {
    return this.templatesService.uploadTemplate({
      ...body,
      rubric: body.rubric ? JSON.parse(body.rubric) : undefined,
      file,
      uploaderId: req.user.id,
    });
  }

  @Get('program/:programId')
  @Roles('STUDENT', 'ADVISOR', 'COORDINATOR', 'ADMIN')
  listByProgram(@Param('programId') programId: string) {
    return this.templatesService.listByProgram(programId);
  }

  @Get(':id')
  @Roles('STUDENT', 'ADVISOR', 'COORDINATOR', 'ADMIN')
  getOne(@Param('id') id: string) {
    return this.templatesService.getOne(id);
  }

  @Patch(':id/rubric')
  @Roles('COORDINATOR', 'ADMIN')
  updateRubric(@Param('id') id: string, @Body() body: { rubric: object }) {
    return this.templatesService.updateRubric(id, body.rubric);
  }

  @Patch(':id/activate')
  @Roles('COORDINATOR', 'ADMIN')
  activate(@Param('id') id: string) {
    return this.templatesService.setActive(id);
  }

  @Delete(':id')
  @Roles('ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.templatesService.delete(id);
  }
}
