import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DiscoveryFollowUpEntity } from '../discovery-follow-ups/discovery-follow-up.entity';
import { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { RoundAnswerEntity } from '../interviews/round-answer.entity';
import { RoundQuestionAssessmentOverrideEntity } from '../interviews/round-question-assessment-override.entity';
import { RoundQuestionSnapshotEntity } from '../interviews/round-question-snapshot.entity';
import { Project } from '../projects/project.entity';
import { ReadinessController } from './readiness.controller';
import { ReadinessService } from './readiness.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Project,
      InterviewRoundEntity,
      RoundQuestionSnapshotEntity,
      RoundAnswerEntity,
      RoundQuestionAssessmentOverrideEntity,
      DiscoveryFollowUpEntity,
    ]),
  ],
  controllers: [ReadinessController],
  providers: [ReadinessService],
  exports: [ReadinessService],
})
export class ReadinessModule {}
