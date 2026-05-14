import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { CrossRefService } from './references.service';

@Module({
  imports: [PrismaModule],
  providers: [CrossRefService],
  exports: [CrossRefService],
})
export class ReferencesModule {}

