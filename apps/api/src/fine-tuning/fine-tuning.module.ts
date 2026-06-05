import { Module } from '@nestjs/common';
import { FineTuningService } from './fine-tuning.service';
import { FineTuningController } from './fine-tuning.controller';

@Module({
  controllers: [FineTuningController],
  providers: [FineTuningService],
})
export class FineTuningModule {}
