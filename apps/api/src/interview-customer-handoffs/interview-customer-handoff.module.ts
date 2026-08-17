import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { Project } from '../projects/project.entity';
import { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { RoundAnswerEntity } from '../interviews/round-answer.entity';
import { RoundQuestionAssessmentOverrideEntity } from '../interviews/round-question-assessment-override.entity';
import { RoundQuestionSnapshotEntity } from '../interviews/round-question-snapshot.entity';
import { InterviewCustomerHandoffController } from './interview-customer-handoff.controller';
import { InterviewCustomerHandoffEntity } from './interview-customer-handoff.entity';
import { InterviewCustomerHandoffService } from './interview-customer-handoff.service';
import { CustomerCorrespondenceEntity } from './customer-correspondence.entity';
import { CustomerOutboundAttemptEntity } from './customer-outbound-attempt.entity';
import { CustomerOutboundCommunicationEntity } from './customer-outbound-communication.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AuditEvent,
      CustomerCorrespondenceEntity,
      CustomerOutboundAttemptEntity,
      CustomerOutboundCommunicationEntity,
      InterviewCustomerHandoffEntity,
      InterviewRoundEntity,
      Project,
      RoundAnswerEntity,
      RoundQuestionAssessmentOverrideEntity,
      RoundQuestionSnapshotEntity,
    ]),
  ],
  controllers: [InterviewCustomerHandoffController],
  providers: [InterviewCustomerHandoffService],
  exports: [InterviewCustomerHandoffService],
})
export class InterviewCustomerHandoffModule {}
