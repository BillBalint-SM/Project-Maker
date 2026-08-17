import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { Project } from '../projects/project.entity';
import { InterviewCustomerHandoffModule } from '../interview-customer-handoffs/interview-customer-handoff.module';
import { BaseQuestionEntity } from '../question-bank/base-question.entity';
import { ProjectQuestionSchemaEntity } from '../question-bank/project-question-schema.entity';
import { ProjectSchemaQuestionEntity } from '../question-bank/project-schema-question.entity';
import { InterviewRoundEntity } from './interview-round.entity';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';
import { RoundAnswerEntity } from './round-answer.entity';
import { RoundQuestionAssessmentOverrideEntity } from './round-question-assessment-override.entity';
import { RoundQuestionSnapshotEntity } from './round-question-snapshot.entity';

@Module({
  imports: [
    InterviewCustomerHandoffModule,
    TypeOrmModule.forFeature([
      InterviewRoundEntity,
      RoundQuestionSnapshotEntity,
      RoundAnswerEntity,
      RoundQuestionAssessmentOverrideEntity,
      ProjectQuestionSchemaEntity,
      ProjectSchemaQuestionEntity,
      BaseQuestionEntity,
      Project,
      AuditEvent,
    ]),
  ],
  controllers: [InterviewsController],
  providers: [InterviewsService],
})
export class InterviewsModule {}
