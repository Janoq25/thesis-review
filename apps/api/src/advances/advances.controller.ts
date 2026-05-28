import {
  Controller, Get, Post, Patch, Param, Body,
  UploadedFile, UploadedFiles, UseInterceptors, UseGuards,
  Request, Query, Res, HttpCode, HttpStatus,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AdvancesService } from './advances.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';

@ApiTags('Advances')
@ApiBearerAuth()
@Controller('advances')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdvancesController {
  constructor(private advancesService: AdvancesService) {}

  @Post()
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 52_428_800 } }))
  @ApiConsumes('multipart/form-data')
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: {
      programId: string;
      templateId: string;
      advanceType: string;
    },
    @Request() req: any,
  ) {
    const studentId = req.user.role === 'STUDENT'
      ? req.user.id
      : (body as any).studentId ?? req.user.id;

    return this.advancesService.upload({
      studentId,
      programId: body.programId,
      templateId: body.templateId,
      advanceType: body.advanceType,
      file,
    });
  }

  @Post('bulk')
  @UseInterceptors(FilesInterceptor('files', 20, { limits: { fileSize: 52_428_800 } }))
  @ApiConsumes('multipart/form-data')
  async uploadBulk(
    @UploadedFiles() files: Array<Express.Multer.File>,
    @Body() body: {
      programId: string;
      templateId: string;
      advanceType: string;
      studentId?: string;
    },
    @Request() req: any,
  ) {
    const results: any[] = [];
    for (const file of files) {
      try {
        const studentId = req.user.role === 'STUDENT'
          ? req.user.id
          : body.studentId;

        const advance = await this.advancesService.uploadBulkFile({
          uploader: req.user,
          programId: body.programId,
          templateId: body.templateId,
          advanceType: body.advanceType,
          studentId,
          file,
        });
        results.push({ filename: file.originalname, success: true, advanceId: advance.id });
      } catch (error) {
        results.push({ filename: file.originalname, success: false, error: error.message });
      }
    }
    return results;
  }

  @Get('mine')
  @Roles('STUDENT')
  listMine(@Request() req: any) {
    return this.advancesService.listForStudent(req.user.id);
  }

  @Get()
  @Roles('ADVISOR', 'COORDINATOR', 'ADMIN')
  list(
    @Request() req: any,
    @Query('status') status?: string,
    @Query('programId') programId?: string,
    @Query('page') page = '1',
    @Query('pageSize') pageSize = '20',
  ) {
    // Asesores solo ven los avances de sus estudiantes
    if (req.user.role === 'ADVISOR') {
      return this.advancesService.listForAdvisor(req.user.id, {
        status,
        programId,
        page: Number(page),
        pageSize: Number(pageSize),
      });
    }
    return this.advancesService.listAll({
      status,
      programId,
      page: Number(page),
      pageSize: Number(pageSize),
    });
  }

  @Get(':id')
  getOne(@Param('id') id: string, @Request() req: any) {
    return this.advancesService.getAdvanceDetail(id, req.user.id, req.user.role);
  }

  @Post(':id/retry-ai')
  @Roles('ADVISOR', 'COORDINATOR', 'ADMIN', 'STUDENT')
  @HttpCode(HttpStatus.ACCEPTED)
  retryAi(@Param('id') id: string) {
    return this.advancesService.retryAiAnalysis(id);
  }

  @Patch(':id/status')
  @Roles('ADVISOR', 'COORDINATOR', 'ADMIN')
  updateStatus(
    @Param('id') id: string,
    @Body() body: {
      status: string;
      comment?: string;
      finalGrade?: number;
    },
    @Request() req: any,
  ) {
    return this.advancesService.updateStatus(
      id, body.status, req.user.id, body.comment, body.finalGrade,
    );
  }

  @Get(':id/download')
  async download(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, contentType, filename } =
      await this.advancesService.downloadFile(id);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': buffer.length,
    });

    return new StreamableFile(buffer);
  }

  @Get(':id/view')
  async view(
    @Param('id') id: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { buffer, contentType, filename } =
      await this.advancesService.downloadFile(id);

    res.set({
      'Content-Type': contentType,
      'Content-Disposition': `inline; filename="${encodeURIComponent(filename)}"`,
      'Content-Length': buffer.length,
    });

    return new StreamableFile(buffer);
  }

  @Get(':id/preview-url')
  async previewUrl(@Param('id') id: string) {
    const advance = await this.advancesService['prisma'].advance.findUniqueOrThrow({
      where: { id },
      select: { fileKey: true },
    });
    const url = await this.advancesService['storage'].getPresignedUrl(
      advance.fileKey, 900,
    );
    return { url };
  }
}
