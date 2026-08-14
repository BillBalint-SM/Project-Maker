import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { Project } from '../projects/project.entity';
import { ReadinessModule } from '../readiness/readiness.module';
import { DecisionReviewController } from './decision-review.controller';
import { DecisionReviewService } from './decision-review.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project, AuditEvent]), ReadinessModule],
  controllers: [DecisionReviewController],
  providers: [DecisionReviewService],
})
export class DecisionReviewModule {}
