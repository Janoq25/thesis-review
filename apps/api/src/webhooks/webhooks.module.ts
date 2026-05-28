import { Module } from '@nestjs/common';
import { PlagiarismModule } from '../plagiarism/plagiarism.module';
import { WebhooksController } from './webhooks.controller';

@Module({
  imports: [PlagiarismModule],
  controllers: [WebhooksController],
})
export class WebhooksModule {}
