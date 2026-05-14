import {
  Controller, Get, Post, Param, Body, Query,
  UseGuards, Res, StreamableFile, HttpCode, HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { PdfReportService } from './pdf-report.service';
import { EmailService } from './email.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private pdfService: PdfReportService,
    private emailService: EmailService,
  ) {}

  @Get('advance/:advanceId')
  async downloadAdvanceReport(
    @Param('advanceId') advanceId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdf = await this.pdfService.generateAdvanceReport(advanceId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte-${advanceId}.pdf"`,
      'Content-Length': pdf.length,
    });
    return new StreamableFile(pdf);
  }

  @Get('advance/:advanceId/versions')
  async downloadVersionsReport(
    @Param('advanceId') advanceId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdf = await this.pdfService.generateVersionsComparison(advanceId);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="versiones-${advanceId}.pdf"`,
    });
    return new StreamableFile(pdf);
  }

  @Get('program/:programId/batch')
  @Roles('COORDINATOR', 'ADMIN')
  async downloadBatchReport(
    @Param('programId') programId: string,
    @Query('period') period: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdf = await this.pdfService.generateBatchReport(programId, period);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte-batch-${period}.pdf"`,
    });
    return new StreamableFile(pdf);
  }

  @Post('advance/:advanceId/send-email')
  @Roles('ADVISOR', 'COORDINATOR', 'ADMIN')
  @HttpCode(HttpStatus.NO_CONTENT)
  async sendReportByEmail(
    @Param('advanceId') advanceId: string,
    @Body() body: { recipients?: string[]; message?: string },
  ) {
    await this.emailService.sendAdvanceReport(advanceId, {
      recipients: body.recipients,
      customMessage: body.message,
    });
  }

  @Get('stats/csv')
  @Roles('COORDINATOR', 'ADMIN')
  async exportStatsCsv(
    @Query('programId') programId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const csv = await this.pdfService.generateStatsCsv(programId);
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="estadisticas.csv"',
    });
    return new StreamableFile(Buffer.from('\uFEFF' + csv, 'utf-8'));
  }
}
