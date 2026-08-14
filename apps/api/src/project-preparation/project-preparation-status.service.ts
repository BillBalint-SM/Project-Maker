import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ProjectPreparationAction,
  ProjectPreparationStatus,
} from '@project-maker/contracts';
import { DataSource } from 'typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { DecisionReviewService } from '../decision-review/decision-review.service';
import { findCurrentInitialIntakeSource } from '../interviews/current-initial-intake-source';
import { Project } from '../projects/project.entity';
import { ProjectQuestionSchemaEntity } from '../question-bank/project-question-schema.entity';

const interviewAction: ProjectPreparationAction = {
  label: 'Felmérés megnyitása',
  target: 'INTERVIEW',
};
const readinessAction: ProjectPreparationAction = {
  label: 'Felkészültség megnyitása',
  target: 'READINESS',
};
const decisionReviewAction: ProjectPreparationAction = {
  label: 'Döntési értékelés megnyitása',
  target: 'DECISION_REVIEW',
};

@Injectable()
export class ProjectPreparationStatusService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly decisionReviewService: DecisionReviewService,
  ) {}

  async getStatus(projectId: string): Promise<ProjectPreparationStatus> {
    const [project, hasSchema, latestRestoration] = await Promise.all([
      this.dataSource.getRepository(Project).findOneBy({ id: projectId }),
      this.dataSource.getRepository(ProjectQuestionSchemaEntity).existsBy({ projectId }),
      this.dataSource.getRepository(AuditEvent).findOne({
        where: { projectId, eventType: 'PROJECT_RESTORED' },
        order: { createdAt: 'DESC', id: 'DESC' },
      }),
    ]);
    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    if (!hasSchema) {
      return status(projectId, 'SCHEMA_REQUIRED', 'Kérdésséma szükséges', interviewAction);
    }

    const sourceRound = await findCurrentInitialIntakeSource(this.dataSource.manager, projectId);
    if (
      latestRestoration &&
      (!sourceRound || sourceRound.createdAt <= latestRestoration.createdAt)
    ) {
      return status(projectId, 'SCHEMA_REQUIRED', 'Kérdésséma szükséges', interviewAction);
    }
    if (!sourceRound || sourceRound.status === 'OPEN') {
      return status(projectId, 'INTAKE_IN_PROGRESS', 'Felmérés folyamatban', interviewAction);
    }

    const review = await this.decisionReviewService.getReview(projectId);
    if (!review.available) {
      if (review.unavailableReasons.includes('UNSUPPORTED_SCHEMA')) {
        return status(projectId, 'CLARIFICATION_REQUIRED', 'Tisztázás szükséges', readinessAction);
      }
      return status(
        projectId,
        'DECISION_REVIEW_REQUIRED',
        'Döntési értékelés szükséges',
        decisionReviewAction,
      );
    }

    switch (review.recommendation) {
      case 'CLARIFICATION_REQUIRED':
        return status(projectId, 'CLARIFICATION_REQUIRED', 'Tisztázás szükséges', readinessAction);
      case 'ESTIMATE_PREPARATION_POSSIBLE':
        return status(
          projectId,
          'ESTIMATE_PREPARABLE',
          'Becslés előkészíthető',
          decisionReviewAction,
        );
      case 'ESTIMATE_READY':
        return status(projectId, 'ESTIMATE_READY', 'Becslésre kész', decisionReviewAction);
    }
  }
}

function status(
  projectId: string,
  state: ProjectPreparationStatus['state'],
  label: string,
  primaryAction: ProjectPreparationAction,
): ProjectPreparationStatus {
  return { projectId, state, label, primaryAction };
}
