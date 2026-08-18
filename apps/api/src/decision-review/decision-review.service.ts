import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  DecisionReviewInputs,
  DecisionReviewInputKey,
  ProjectDecisionReview,
  UpdateDecisionReviewInput,
} from '@project-maker/contracts';
import { loadGeneralPlaybookV1 } from '@project-maker/contracts/general-playbook-runtime';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { findCurrentInitialIntakeSources } from '../interviews/current-initial-intake-source';
import type { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { Project } from '../projects/project.entity';
import { ReadinessService } from '../readiness/readiness.service';
import {
  calculateDecisionReview,
  decisionReviewDimensions,
  hasCompleteDecisionReviewInputs,
} from './decision-review-calculator';

const archivedStatus = 'ARCHIVED';
const decisionInputFields = [
  'businessValue',
  'strategicAlignment',
  'urgency',
  'confidence',
  'complexity',
  'risk',
] as const satisfies readonly DecisionReviewInputKey[];

type DecisionInputField = DecisionReviewInputKey;

@Injectable()
export class DecisionReviewService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly dataSource: DataSource,
    private readonly readinessService: ReadinessService,
  ) {}

  async getReview(projectId: string): Promise<ProjectDecisionReview> {
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    const sourceRounds = await findCurrentInitialIntakeSources(this.dataSource.manager, [projectId]);
    const review = (await this.getReviewsForProjectsWithManager(
      this.dataSource.manager,
      [project],
      sourceRounds,
    )).get(projectId);
    if (!review) {
      throw new TypeError(`Missing Decision Review for Project ${projectId}.`);
    }
    return review;
  }

  async getReviewWithManager(
    manager: EntityManager,
    projectId: string,
  ): Promise<ProjectDecisionReview> {
    const project = await manager.getRepository(Project).findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    const sourceRounds = await findCurrentInitialIntakeSources(manager, [projectId]);
    const review = (await this.getReviewsForProjectsWithManager(
      manager,
      [project],
      sourceRounds,
    )).get(projectId);
    if (!review) {
      throw new TypeError(`Missing Decision Review for Project ${projectId}.`);
    }
    return review;
  }

  async getReviewsForProjectsWithManager(
    manager: EntityManager,
    projects: readonly Project[],
    sourceRoundsByProjectId: ReadonlyMap<string, InterviewRoundEntity>,
  ): Promise<ReadonlyMap<string, ProjectDecisionReview>> {
    const [policy, readinessByProjectId] = await Promise.all([
      loadGeneralPlaybookV1(),
      this.readinessService.getReadinessForProjectsWithManager(
        manager,
        projects,
        sourceRoundsByProjectId,
      ),
    ]);
    const reviews = new Map<string, ProjectDecisionReview>();
    for (const project of projects) {
        const inputs = toInputs(project);
        const readiness = readinessByProjectId.get(project.id);
        if (!readiness) {
          throw new TypeError(`Missing readiness result for Project ${project.id}.`);
        }
        if (!hasCompleteDecisionReviewInputs(inputs) || !readiness.available) {
          reviews.set(project.id, {
              projectId: project.id,
              inputs,
              dimensions: decisionReviewDimensions(policy),
              ratingScale: {
                minimum: policy.scoring.decision.scale.minimum,
                maximum: policy.scoring.decision.scale.maximum,
              },
              editable: project.status !== archivedStatus,
              available: false,
              unavailableReasons: [
                ...(hasCompleteDecisionReviewInputs(inputs) ? [] : ['INCOMPLETE_INPUT' as const]),
                ...(readiness.available ? [] : [readiness.reason]),
              ],
            });
          continue;
        }
        reviews.set(
          project.id,
          calculateDecisionReview(
            project.id,
            inputs,
            project.status !== archivedStatus,
            readiness,
            policy,
          ),
        );
    }
    return reviews;
  }

  async updateReview(
    projectId: string,
    input: UpdateDecisionReviewInput,
  ): Promise<ProjectDecisionReview> {
    await this.dataSource.transaction(async (manager) => {
      const project = await findLockedProject(manager, projectId);
      if (project.status === archivedStatus) {
        throw new ConflictException('Archived projects must be restored before Decision Review inputs can be updated.');
      }

      const changedDimensions = decisionInputFields.filter(
        (field) => projectRating(project, field) !== input[field],
      );
      if (changedDimensions.length === 0) {
        return;
      }

      assignInputs(project, input);
      await manager.getRepository(Project).save(project);
      await manager.getRepository(AuditEvent).save({
        id: randomUUID(),
        projectId,
        eventType: 'PROJECT_DECISION_INPUTS_UPDATED',
        payload: { changedDimensions: changedDimensions.join(',') },
      });
    });
    return this.getReview(projectId);
  }

}

async function findLockedProject(manager: EntityManager, projectId: string): Promise<Project> {
  const project = await manager.getRepository(Project).findOne({
    where: { id: projectId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!project) {
    throw new NotFoundException('Project not found.');
  }
  return project;
}

function toInputs(project: Project): DecisionReviewInputs {
  return {
    businessValue: project.businessValueRating,
    strategicAlignment: project.strategicAlignmentRating,
    urgency: project.urgencyRating,
    confidence: project.confidenceRating,
    complexity: project.complexityRating,
    risk: project.riskRating,
  };
}

function assignInputs(project: Project, input: UpdateDecisionReviewInput): void {
  project.businessValueRating = input.businessValue;
  project.strategicAlignmentRating = input.strategicAlignment;
  project.urgencyRating = input.urgency;
  project.confidenceRating = input.confidence;
  project.complexityRating = input.complexity;
  project.riskRating = input.risk;
}

function projectRating(project: Project, field: DecisionInputField): number | null {
  const inputs = toInputs(project);
  return inputs[field];
}
