import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { RoundAnswerEntity } from '../interviews/round-answer.entity';
import { RoundQuestionAssessmentOverrideEntity } from '../interviews/round-question-assessment-override.entity';
import { RoundQuestionSnapshotEntity } from '../interviews/round-question-snapshot.entity';
import { Project } from '../projects/project.entity';
import { BaseQuestionEntity } from '../question-bank/base-question.entity';
import { ProjectQuestionSchemaEntity } from '../question-bank/project-question-schema.entity';
import { ProjectSchemaQuestionEntity } from '../question-bank/project-schema-question.entity';
import { ReadinessModule } from '../readiness/readiness.module';
import { DecisionReviewModule } from '../decision-review/decision-review.module';
import { MarkdownController } from './markdown.controller';
import { MarkdownRevisionEntity } from './markdown-revision.entity';
import { MarkdownService } from './markdown.service';
import { MarkdownTemplateController } from './markdown-template.controller';
import { MarkdownTemplateEntity, MarkdownTemplateVersionEntity } from './markdown-template.entity';
import { MarkdownTemplateService } from './markdown-template.service';

@Module({
  imports: [
    ReadinessModule,
    DecisionReviewModule,
    TypeOrmModule.forFeature([
      MarkdownRevisionEntity,
      Project,
      ProjectQuestionSchemaEntity,
      ProjectSchemaQuestionEntity,
      BaseQuestionEntity,
      InterviewRoundEntity,
      RoundQuestionSnapshotEntity,
      RoundAnswerEntity,
      RoundQuestionAssessmentOverrideEntity,
      AuditEvent,
      MarkdownTemplateEntity,
      MarkdownTemplateVersionEntity,
    ]),
  ],
  controllers: [MarkdownController, MarkdownTemplateController],
  providers: [MarkdownService, MarkdownTemplateService],
  exports: [MarkdownService, MarkdownTemplateService],
})
export class MarkdownModule {}
