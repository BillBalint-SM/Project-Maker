import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { Project } from '../projects/project.entity';
import { BaseQuestionEntity } from '../question-bank/base-question.entity';
import { ProjectQuestionSchemaEntity } from '../question-bank/project-question-schema.entity';
import { ProjectSchemaQuestionEntity } from '../question-bank/project-schema-question.entity';
import { InterviewRoundEntity } from './interview-round.entity';
import { InterviewsController } from './interviews.controller';
import { InterviewsService } from './interviews.service';
import { RoundAnswerEntity } from './round-answer.entity';
import { RoundQuestionSnapshotEntity } from './round-question-snapshot.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InterviewRoundEntity,
      RoundQuestionSnapshotEntity,
      RoundAnswerEntity,
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
