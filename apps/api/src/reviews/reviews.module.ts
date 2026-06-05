import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReviewsService } from './reviews.service';
import { ReviewsController } from './reviews.controller';
import { BulkReviewController } from './bulk-review.controller';

@Module({
  imports: [
    NotificationsModule,
    BullModule.registerQueue({ name: 'ai-analysis' }),
    BullModule.registerQueue({ name: 'email' }),
  ],
  controllers: [ReviewsController, BulkReviewController],
  providers: [ReviewsService],
})
export class ReviewsModule {}
