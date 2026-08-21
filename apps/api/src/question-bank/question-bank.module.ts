import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { Project } from '../projects/project.entity';
import { BaseQuestionEntity } from './base-question.entity';
import { BaseQuestionsController } from './base-questions.controller';
import { ProjectQuestionSchemaController } from './project-question-schema.controller';
import { ProjectQuestionSchemaEntity } from './project-question-schema.entity';
import { ProjectSchemaQuestionEntity } from './project-schema-question.entity';
import { QuestionBankService } from './question-bank.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BaseQuestionEntity,
      ProjectQuestionSchemaEntity,
      ProjectSchemaQuestionEntity,
      Project,
      AuditEvent,
    ]),
  ],
  controllers: [BaseQuestionsController, ProjectQuestionSchemaController],
  providers: [QuestionBankService],
  exports: [QuestionBankService],
})
export class QuestionBankModule {}
