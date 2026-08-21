import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { DiscoveryFollowUpEntity } from '../discovery-follow-ups/discovery-follow-up.entity';
import { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { RoundQuestionSnapshotEntity } from '../interviews/round-question-snapshot.entity';
import { Project } from '../projects/project.entity';
import { BaseQuestionEntity } from '../question-bank/base-question.entity';
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
  imports: [TypeOrmModule.forFeature([
    Project,
    ProjectContactEntity,
    GovernedAttachmentEntity,
    EvidenceEntity,
    InsightEntity,
    InsightEvidenceEntity,
    BaseQuestionEntity,
    DiscoveryFollowUpEntity,
    InterviewRoundEntity,
    RoundQuestionSnapshotEntity,
    AuditEvent,
  ])],
  controllers: [ContactsController, AttachmentsController, InsightsController],
  providers: [ContactsService, AttachmentsService, InsightsService],
})
export class DiscoveryModule {}
