import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { StorageModule } from '../storage/storage.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdvancesService } from './advances.service';
import { AdvancesController } from './advances.controller';

@Module({
  imports: [
    StorageModule,
    NotificationsModule,
    BullModule.registerQueue(
      { name: 'ai-analysis' },
      { name: 'plagiarism-analysis' },
      { name: 'reference-check' },
    ),
  ],
  controllers: [AdvancesController],
  providers: [AdvancesService],
})
export class AdvancesModule {}
