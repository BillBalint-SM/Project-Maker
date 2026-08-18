import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  ProjectPreparationAction,
  ProjectPreparationStatus,
} from '@project-maker/contracts';
import { DataSource, In } from 'typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { DecisionReviewService } from '../decision-review/decision-review.service';
import { findCurrentInitialIntakeSources } from '../interviews/current-initial-intake-source';
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
    const project = await this.dataSource.getRepository(Project).findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    const preparationStatus = (await this.getStatuses([project])).get(projectId);
    if (!preparationStatus) {
      throw new TypeError(`Missing preparation status for Project ${projectId}.`);
    }
    return preparationStatus;
  }

  async getStatuses(
    projects: readonly Project[],
  ): Promise<ReadonlyMap<string, ProjectPreparationStatus>> {
    if (projects.length === 0) {
      return new Map();
    }
    const projectIds = projects.map((project) => project.id);
    const [schemas, restorations, sourceRoundsByProjectId] = await Promise.all([
      this.dataSource.getRepository(ProjectQuestionSchemaEntity).find({
        where: { projectId: In(projectIds) },
        order: { projectId: 'ASC' },
      }),
      this.dataSource.getRepository(AuditEvent).find({
        where: { projectId: In(projectIds), eventType: 'PROJECT_RESTORED' },
        order: { projectId: 'ASC', createdAt: 'DESC', id: 'DESC' },
      }),
      findCurrentInitialIntakeSources(this.dataSource.manager, projectIds),
    ]);
    const schemaProjectIds = new Set(schemas.map((schema) => schema.projectId));
    const latestRestorationByProjectId = new Map<string, AuditEvent>();
    for (const restoration of restorations) {
      if (!latestRestorationByProjectId.has(restoration.projectId)) {
        latestRestorationByProjectId.set(restoration.projectId, restoration);
      }
    }

    const reviewProjects = projects.filter((project) => {
      if (!schemaProjectIds.has(project.id)) {
        return false;
      }
      const sourceRound = sourceRoundsByProjectId.get(project.id);
      const latestRestoration = latestRestorationByProjectId.get(project.id);
      return Boolean(
        sourceRound?.status === 'ENDED' &&
          (!latestRestoration || sourceRound.createdAt > latestRestoration.createdAt),
      );
    });
    const reviewsByProjectId = await this.decisionReviewService.getReviewsForProjectsWithManager(
      this.dataSource.manager,
      reviewProjects,
      sourceRoundsByProjectId,
    );

    return new Map(
      projects.map((project) => {
        if (!schemaProjectIds.has(project.id)) {
          return [
            project.id,
            status(project.id, 'SCHEMA_REQUIRED', 'Kérdésséma szükséges', interviewAction),
          ] as const;
        }
        const sourceRound = sourceRoundsByProjectId.get(project.id);
        const latestRestoration = latestRestorationByProjectId.get(project.id);
        if (latestRestoration && (!sourceRound || sourceRound.createdAt <= latestRestoration.createdAt)) {
          return [
            project.id,
            status(project.id, 'SCHEMA_REQUIRED', 'Kérdésséma szükséges', interviewAction),
          ] as const;
        }
        if (!sourceRound || sourceRound.status === 'OPEN') {
          return [
            project.id,
            status(project.id, 'INTAKE_IN_PROGRESS', 'Felmérés folyamatban', interviewAction),
          ] as const;
        }
        const review = reviewsByProjectId.get(project.id);
        if (!review) {
          throw new TypeError(`Missing Decision Review for Project ${project.id}.`);
        }
        if (!review.available) {
          return review.unavailableReasons.includes('UNSUPPORTED_SCHEMA')
            ? [
                project.id,
                status(project.id, 'CLARIFICATION_REQUIRED', 'Tisztázás szükséges', readinessAction),
              ] as const
            : [
                project.id,
                status(
                  project.id,
                  'DECISION_REVIEW_REQUIRED',
                  'Döntési értékelés szükséges',
                  decisionReviewAction,
                ),
              ] as const;
        }
        switch (review.recommendation) {
          case 'CLARIFICATION_REQUIRED':
            return [
              project.id,
              status(project.id, 'CLARIFICATION_REQUIRED', 'Tisztázás szükséges', readinessAction),
            ] as const;
          case 'ESTIMATE_PREPARATION_POSSIBLE':
            return [
              project.id,
              status(
                project.id,
                'ESTIMATE_PREPARABLE',
                'Becslés előkészíthető',
                decisionReviewAction,
              ),
            ] as const;
          case 'ESTIMATE_READY':
            return [
              project.id,
              status(project.id, 'ESTIMATE_READY', 'Becslésre kész', decisionReviewAction),
            ] as const;
        }
      }),
    );
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
