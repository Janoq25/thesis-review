import { Module } from '@nestjs/common';
import { NotificationService } from './notifications.service';
import { PushTokensController } from './push-tokens.controller';

@Module({
  controllers: [PushTokensController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationsModule {}
