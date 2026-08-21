import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { DecisionReviewModule } from '../decision-review/decision-review.module';
import { InsightEntity } from '../discovery/insight.entity';
import { MarkdownRevisionEntity } from '../markdown/markdown-revision.entity';
import { Project } from '../projects/project.entity';
import { ProjectsModule } from '../projects/projects.module';
import { BusinessGoalEntity } from './business-goal.entity';
import { DecisionStatusController } from './decision-status.controller';
import { DecisionStatusService } from './decision-status.service';
import { FormalDecisionEntity } from './formal-decision.entity';
import { InitiativeEntity } from './initiative.entity';
import { PortfolioController } from './portfolio.controller';
import { PortfolioService } from './portfolio.service';
import { ProjectStatusUpdateEntity } from './project-status-update.entity';
import { RoadmapController } from './roadmap.controller';
import { RoadmapService } from './roadmap.service';

@Module({
  imports: [
    ProjectsModule,
    DecisionReviewModule,
    TypeOrmModule.forFeature([
      Project,
      AuditEvent,
      InsightEntity,
      MarkdownRevisionEntity,
      BusinessGoalEntity,
      InitiativeEntity,
      FormalDecisionEntity,
      ProjectStatusUpdateEntity,
    ]),
  ],
  controllers: [DecisionStatusController, RoadmapController, PortfolioController],
  providers: [DecisionStatusService, RoadmapService, PortfolioService],
})
export class DecisionPortfolioModule {}
