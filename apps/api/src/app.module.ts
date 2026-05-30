import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';

import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ProgramsModule } from './programs/programs.module';
import { TemplatesModule } from './templates/templates.module';
import { AdvancesModule } from './advances/advances.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AIAnalysisModule } from './ai-analysis/ai-analysis.module';
import { FineTuningModule } from './fine-tuning/fine-tuning.module';
import { PlagiarismModule } from './plagiarism/plagiarism.module';
import { ReferencesModule } from './references/references.module';
import { OrcidModule } from './orcid/orcid.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReportsModule } from './reports/reports.module';
import { StatsModule } from './stats/stats.module';
import { StorageModule } from './storage/storage.module';
import { AuditModule } from './audit/audit.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AssignmentsModule } from './assignments/assignments.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'long', ttl: 60_000, limit: 200 },
    ]),

    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST ?? 'localhost',
        port: Number(process.env.REDIS_PORT ?? 6379),
      },
    }),

    BullModule.registerQueue(
      { name: 'ai-analysis' },
      { name: 'template-indexing' },
      { name: 'plagiarism-analysis' },
      { name: 'reference-check' },
      { name: 'fine-tuning-status' },
      { name: 'email' },
      { name: 'pdf-generation' },
    ),

    EventEmitterModule.forRoot(),

    PrismaModule,
    AuthModule,
    UsersModule,
    ProgramsModule,
    TemplatesModule,
    AdvancesModule,
    ReviewsModule,
    AIAnalysisModule,
    FineTuningModule,
    PlagiarismModule,
    ReferencesModule,
    OrcidModule,
    NotificationsModule,
    ReportsModule,
    StatsModule,
    StorageModule,
    AuditModule,
    WebhooksModule,
    AssignmentsModule,
  ],
})
export class AppModule {}
