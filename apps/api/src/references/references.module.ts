import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StorageModule } from '../storage/storage.module';
import { CrossRefService } from './references.service';
import { ReferencesController } from './references.controller';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [ReferencesController],
  providers: [CrossRefService],
  exports: [CrossRefService],
})
export class ReferencesModule {}

