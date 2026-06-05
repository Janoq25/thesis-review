import { Module } from '@nestjs/common';
import { OrcidService } from './orcid.service';
import { OrcidController } from './orcid.controller';

@Module({
  controllers: [OrcidController],
  providers: [OrcidService],
})
export class OrcidModule {}
