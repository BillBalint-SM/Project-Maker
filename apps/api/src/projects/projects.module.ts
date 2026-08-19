import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { DiscoveryFollowUpEntity } from '../discovery-follow-ups/discovery-follow-up.entity';
import { MarkdownModule } from '../markdown/markdown.module';
import { ProjectPreparationModule } from '../project-preparation/project-preparation.module';
import { ActiveProjectQueueController } from './active-project-queue.controller';
import {
  ActiveProjectQueueService,
  activeProjectQueueClockToken,
} from './active-project-queue.service';
import { Project } from './project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, AuditEvent, DiscoveryFollowUpEntity]),
    MarkdownModule,
    ProjectPreparationModule,
  ],
  controllers: [ActiveProjectQueueController, ProjectsController],
  providers: [
    ProjectsService,
    ActiveProjectQueueService,
    { provide: activeProjectQueueClockToken, useValue: { now: () => new Date() } },
  ],
})
export class ProjectsModule {}
