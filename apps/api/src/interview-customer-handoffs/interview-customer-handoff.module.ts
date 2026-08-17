import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { MailDeliveryModule } from '../mail-delivery/mail-delivery.module';
import { Project } from '../projects/project.entity';
import { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { RoundAnswerEntity } from '../interviews/round-answer.entity';
import { RoundQuestionAssessmentOverrideEntity } from '../interviews/round-question-assessment-override.entity';
import { RoundQuestionSnapshotEntity } from '../interviews/round-question-snapshot.entity';
import { InterviewCustomerHandoffController } from './interview-customer-handoff.controller';
import { InterviewCustomerHandoffEntity } from './interview-customer-handoff.entity';
import { InterviewCustomerHandoffService } from './interview-customer-handoff.service';

@Module({
  imports: [
    MailDeliveryModule,
    TypeOrmModule.forFeature([
      AuditEvent,
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
