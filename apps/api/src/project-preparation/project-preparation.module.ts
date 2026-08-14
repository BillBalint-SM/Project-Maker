import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DecisionReviewModule } from '../decision-review/decision-review.module';
import { Project } from '../projects/project.entity';
import { ProjectQuestionSchemaEntity } from '../question-bank/project-question-schema.entity';
import { ProjectPreparationStatusController } from './project-preparation-status.controller';
import { ProjectPreparationStatusService } from './project-preparation-status.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Project, ProjectQuestionSchemaEntity]),
    DecisionReviewModule,
  ],
  controllers: [ProjectPreparationStatusController],
  providers: [ProjectPreparationStatusService],
})
export class ProjectPreparationModule {}
