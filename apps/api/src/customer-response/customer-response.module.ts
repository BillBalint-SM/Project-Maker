import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { DiscoveryFollowUpEntity } from '../discovery-follow-ups/discovery-follow-up.entity';
import { EvidenceEntity } from '../discovery/evidence.entity';
import { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { RoundQuestionSnapshotEntity } from '../interviews/round-question-snapshot.entity';
import { CustomerCorrespondenceEntity } from '../interview-customer-handoffs/customer-correspondence.entity';
import { CustomerOutboundAttemptEntity } from '../interview-customer-handoffs/customer-outbound-attempt.entity';
import { CustomerOutboundCommunicationEntity } from '../interview-customer-handoffs/customer-outbound-communication.entity';
import { NotificationsController } from '../notifications/notifications.controller';
import { NotificationsService } from '../notifications/notifications.service';
import { Project } from '../projects/project.entity';
import { CustomerResponseAnswerEntity } from './customer-response-answer.entity';
import { CustomerResponseInternalController, CustomerResponsePublicController } from './customer-response.controller';
import { CustomerResponsePromptEntity } from './customer-response-prompt.entity';
import { CustomerResponseRequestEntity } from './customer-response-request.entity';
import { CustomerResponseService } from './customer-response.service';
import { CustomerResponseSubmissionEntity } from './customer-response-submission.entity';

@Module({
  imports: [TypeOrmModule.forFeature([
    AuditEvent,
    CustomerCorrespondenceEntity,
    CustomerOutboundAttemptEntity,
    CustomerOutboundCommunicationEntity,
    CustomerResponseAnswerEntity,
    CustomerResponsePromptEntity,
    CustomerResponseRequestEntity,
    CustomerResponseSubmissionEntity,
    DiscoveryFollowUpEntity,
    EvidenceEntity,
    InterviewRoundEntity,
    Project,
    RoundQuestionSnapshotEntity,
  ])],
  controllers: [
    CustomerResponseInternalController,
    CustomerResponsePublicController,
    NotificationsController,
  ],
  providers: [CustomerResponseService, NotificationsService],
  exports: [CustomerResponseService, NotificationsService],
})
export class CustomerResponseModule {}
