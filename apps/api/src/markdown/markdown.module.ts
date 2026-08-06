import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { RoundAnswerEntity } from '../interviews/round-answer.entity';
import { RoundQuestionSnapshotEntity } from '../interviews/round-question-snapshot.entity';
import { Project } from '../projects/project.entity';
import { BaseQuestionEntity } from '../question-bank/base-question.entity';
import { ProjectQuestionSchemaEntity } from '../question-bank/project-question-schema.entity';
import { ProjectSchemaQuestionEntity } from '../question-bank/project-schema-question.entity';
import { MarkdownController } from './markdown.controller';
import { MarkdownRevisionEntity } from './markdown-revision.entity';
import { MarkdownService } from './markdown.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MarkdownRevisionEntity,
      Project,
      ProjectQuestionSchemaEntity,
      ProjectSchemaQuestionEntity,
      BaseQuestionEntity,
      InterviewRoundEntity,
      RoundQuestionSnapshotEntity,
      RoundAnswerEntity,
      AuditEvent,
    ]),
  ],
  controllers: [MarkdownController],
  providers: [MarkdownService],
  exports: [MarkdownService],
})
export class MarkdownModule {}
