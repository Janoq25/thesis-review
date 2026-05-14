import { Module } from '@nestjs/common';
import { PdfReportService } from './pdf-report.service';
import { EmailService } from './email.service';
import { ReportsController } from './reports.controller';

@Module({
  controllers: [ReportsController],
  providers: [PdfReportService, EmailService],
})
export class ReportsModule {}
