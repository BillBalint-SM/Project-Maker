import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { DiscoveryFollowUpEntity } from '../discovery-follow-ups/discovery-follow-up.entity';
import { MarkdownModule } from '../markdown/markdown.module';
import { ProjectPreparationModule } from '../project-preparation/project-preparation.module';
import { ActiveProjectQueueController } from './active-project-queue.controller';
import { ActiveProjectQueueCursorCodec } from './active-project-queue-cursor';
import {
  ActiveProjectQueueService,
  activeProjectQueueClockToken,
} from './active-project-queue.service';
import { Project } from './project.entity';
import { QuestionTemplateEntity, QuestionTemplateVersionEntity } from '../question-bank/question-template.entity';
import { ProjectWorkStateController } from './project-work-state.controller';
import { ProjectWorkStateReadModel } from './project-work-state-read-model';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';
import { PlaybooksController } from './playbooks.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      AuditEvent,
      DiscoveryFollowUpEntity,
      QuestionTemplateEntity,
      QuestionTemplateVersionEntity,
    ]),
    MarkdownModule,
    ProjectPreparationModule,
  ],
  controllers: [ActiveProjectQueueController, ProjectWorkStateController, ProjectsController, PlaybooksController],
  providers: [
    ProjectsService,
    ActiveProjectQueueService,
    ProjectWorkStateReadModel,
    ActiveProjectQueueCursorCodec,
    { provide: activeProjectQueueClockToken, useValue: { now: () => new Date() } },
  ],
  exports: [ActiveProjectQueueService, ProjectsService],
})
export class ProjectsModule {}
