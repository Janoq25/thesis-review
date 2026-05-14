import {
  Controller, Post, Body, Param,
  Headers, HttpCode, HttpStatus, Logger,
} from '@nestjs/common';
import { PlagiarismService } from '../plagiarism/plagiarism.service';
import * as crypto from 'crypto';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(private plagiarismService: PlagiarismService) {}

  @Post('copyleaks/:status')
  @HttpCode(HttpStatus.OK)
  async copyleaksCallback(
    @Param('status') status: 'completed' | 'error' | 'credits-checking',
    @Body() payload: any,
    @Headers('x-copyleaks-signature') signature?: string,
  ) {
    // Verificar firma HMAC si está configurada
    if (process.env.COPYLEAKS_WEBHOOK_SECRET && signature) {
      const expected = crypto
        .createHmac('sha256', process.env.COPYLEAKS_WEBHOOK_SECRET)
        .update(JSON.stringify(payload))
        .digest('hex');

      if (signature !== expected) {
        this.logger.warn('Copyleaks webhook con firma inválida');
        return { error: 'Invalid signature' };
      }
    }

    const scanId = payload?.scannedDocument?.scanId ?? payload?.scanId;
    if (!scanId) {
      this.logger.warn('Copyleaks webhook sin scanId');
      return { error: 'Missing scanId' };
    }

    this.logger.log(`Copyleaks webhook — status: ${status}, scanId: ${scanId}`);

    if (status === 'completed') {
      await this.plagiarismService.handleCopyleaksWebhook(scanId, payload);
    }

    return { received: true };
  }
}
