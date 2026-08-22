import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';

import { resolveAttachmentLimitBytes } from '../attachments/attachment-file-policy';
import { AuditEvent } from '../audit/audit-event.entity';
import { DiscoveryFollowUpEntity } from '../discovery-follow-ups/discovery-follow-up.entity';
import { InterviewCustomerHandoffModule } from '../interview-customer-handoffs/interview-customer-handoff.module';
import { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { RoundQuestionSnapshotEntity } from '../interviews/round-question-snapshot.entity';
import { Project } from '../projects/project.entity';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { ContactsController } from './contacts.controller';
import { ContactsService } from './contacts.service';
import { EvidenceEntity } from './evidence.entity';
import { GovernedAttachmentEntity } from './governed-attachment.entity';
import { InsightEvidenceEntity } from './insight-evidence.entity';
import { InsightEntity } from './insight.entity';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { ProjectContactEntity } from './project-contact.entity';

@Module({
  imports: [
    InterviewCustomerHandoffModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        limits: {
          fileSize: resolveAttachmentLimitBytes(config.get<string>('ATTACHMENT_MAX_MIB')),
          files: 1,
        },
      }),
    }),
    TypeOrmModule.forFeature([
      Project,
      ProjectContactEntity,
      GovernedAttachmentEntity,
      EvidenceEntity,
      InsightEntity,
      InsightEvidenceEntity,
      DiscoveryFollowUpEntity,
      InterviewRoundEntity,
      RoundQuestionSnapshotEntity,
      AuditEvent,
    ]),
  ],
  controllers: [ContactsController, AttachmentsController, InsightsController],
  providers: [ContactsService, AttachmentsService, InsightsService],
})
export class DiscoveryModule {}
