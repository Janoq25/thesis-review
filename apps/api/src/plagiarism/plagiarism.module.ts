import { Module } from '@nestjs/common';
import { PlagiarismService } from './plagiarism.service';
import { PlagiarismController } from './plagiarism.controller';

@Module({
  controllers: [PlagiarismController],
  providers: [PlagiarismService],
  exports: [PlagiarismService],
})
export class PlagiarismModule {}
