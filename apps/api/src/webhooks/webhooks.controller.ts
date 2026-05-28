import {
  Controller, Post, Body, Param, Req,
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

  @Post('copyleaks/export/:scanId/results/:resultId')
  @HttpCode(HttpStatus.OK)
  async copyleaksExportResults(
    @Param('scanId') scanId: string,
    @Param('resultId') resultId: string,
    @Body() payload: any,
  ) {
    this.logger.log(`Copyleaks export results callback — scanId: ${scanId}, resultId: ${resultId}`);
    await this.plagiarismService.saveCopyleaksPlagiarismResult(scanId, resultId, payload);
    return { received: true };
  }

  @Post('copyleaks/export/:scanId/pdf')
  @HttpCode(HttpStatus.OK)
  async copyleaksExportPdf(
    @Param('scanId') scanId: string,
    @Req() req: any,
  ) {
    this.logger.log(`Copyleaks export PDF callback — scanId: ${scanId}`);
    let buffer = req.rawBody || req.body;

    if (!buffer || (Buffer.isBuffer(buffer) && buffer.length === 0)) {
      this.logger.log(`Attempting to read raw stream body manually for scanId: ${scanId}`);
      try {
        buffer = await new Promise<Buffer>((resolve, reject) => {
          const chunks: Buffer[] = [];
          req.on('data', (chunk: any) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          req.on('end', () => resolve(Buffer.concat(chunks)));
          req.on('error', (err: any) => reject(err));
        });
      } catch (err) {
        this.logger.error(`Failed to read raw stream body for scanId ${scanId}:`, err);
      }
    }

    if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
      this.logger.error(`No raw body buffer found in PDF export for scanId ${scanId}`);
      return { error: 'No raw body buffer' };
    }

    this.logger.log(`PDF buffer successfully captured. Size: ${buffer.length} bytes.`);
    await this.plagiarismService.saveCopyleaksPdfReport(scanId, buffer);
    return { received: true };
  }

  @Post('copyleaks/export/completion')
  @HttpCode(HttpStatus.OK)
  async copyleaksExportCompletion() {
    this.logger.log('Copyleaks export session completed successfully');
    return { received: true };
  }
}
