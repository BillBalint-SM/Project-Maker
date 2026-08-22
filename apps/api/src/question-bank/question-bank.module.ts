import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { TypeOrmModule } from '@nestjs/typeorm';

import { resolveAttachmentLimitBytes } from '../attachments/attachment-file-policy';
import { AuditEvent } from '../audit/audit-event.entity';
import { Project } from '../projects/project.entity';
import { BaseQuestionEntity } from './base-question.entity';
import { BaseQuestionsController } from './base-questions.controller';
import { ProjectQuestionSchemaController } from './project-question-schema.controller';
import { ProjectQuestionSchemaEntity } from './project-question-schema.entity';
import { ProjectSchemaQuestionEntity } from './project-schema-question.entity';
import { QuestionReferenceFileContentEntity } from './question-reference-file-content.entity';
import { QuestionReferenceFileEntity } from './question-reference-file.entity';
import { QuestionBankService } from './question-bank.service';

@Module({
  imports: [
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
      BaseQuestionEntity,
      ProjectQuestionSchemaEntity,
      ProjectSchemaQuestionEntity,
      Project,
      AuditEvent,
      QuestionReferenceFileContentEntity,
      QuestionReferenceFileEntity,
    ]),
  ],
  controllers: [BaseQuestionsController, ProjectQuestionSchemaController],
  providers: [QuestionBankService],
  exports: [QuestionBankService],
})
export class QuestionBankModule {}
