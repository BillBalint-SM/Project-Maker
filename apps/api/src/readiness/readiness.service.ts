import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  GeneralPlaybook,
  ProjectReadiness,
  RoundQuestionSnapshot,
} from '@project-maker/contracts';
import { loadGeneralPlaybookV1 } from '@project-maker/contracts/general-playbook-runtime';
import { DataSource, EntityManager, In } from 'typeorm';

import { DiscoveryFollowUpEntity } from '../discovery-follow-ups/discovery-follow-up.entity';
import { findCurrentInitialIntakeSources } from '../interviews/current-initial-intake-source';
import type { InterviewRoundEntity } from '../interviews/interview-round.entity';
import {
  loadRoundQuestionAssessmentPolicy,
  toEffectiveRoundQuestionSnapshot,
} from '../interviews/round-question-assessment';
import { RoundAnswerEntity } from '../interviews/round-answer.entity';
import { RoundQuestionAssessmentOverrideEntity } from '../interviews/round-question-assessment-override.entity';
import { RoundQuestionSnapshotEntity } from '../interviews/round-question-snapshot.entity';
import { Project } from '../projects/project.entity';
import { calculateProjectReadiness } from './readiness-calculator';
import type { ReadinessSnapshotInput } from './readiness.types';

@Injectable()
export class ReadinessService {
  constructor(private readonly dataSource: DataSource) {}

  async getReadiness(projectId: string): Promise<ProjectReadiness> {
    return this.getReadinessWithManager(this.dataSource.manager, projectId);
  }

  async getReadinessWithManager(
    manager: EntityManager,
    projectId: string,
  ): Promise<ProjectReadiness> {
    const project = await manager.getRepository(Project).findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    const sourceRounds = await findCurrentInitialIntakeSources(manager, [projectId]);
    const readiness = (await this.getReadinessForProjectsWithManager(
      manager,
      [project],
      sourceRounds,
    )).get(projectId);
    if (!readiness) {
      throw new TypeError(`Missing readiness result for Project ${projectId}.`);
    }
    return readiness;
  }

  async getReadinessForProjectsWithManager(
    manager: EntityManager,
    projects: readonly Project[],
    sourceRoundsByProjectId: ReadonlyMap<string, InterviewRoundEntity>,
  ): Promise<ReadonlyMap<string, ProjectReadiness>> {
    const unavailable = new Map<string, ProjectReadiness>();
    const projectsWithRounds = projects.flatMap((project) => {
      const sourceRound = sourceRoundsByProjectId.get(project.id);
      if (!sourceRound) {
        unavailable.set(project.id, {
          available: false,
          projectId: project.id,
          reason: 'NO_INITIAL_INTAKE',
        });
        return [];
      }
      return [{ project, sourceRound }];
    });
    if (projectsWithRounds.length === 0) {
      return unavailable;
    }

    const roundIds = projectsWithRounds.map(({ sourceRound }) => sourceRound.id);
    const projectIds = projectsWithRounds.map(({ project }) => project.id);
    const [policy, snapshots, answers, overrides, followUps, assessmentPolicy] = await Promise.all([
      loadGeneralPlaybookV1(),
      manager.getRepository(RoundQuestionSnapshotEntity).find({
        where: { roundId: In(roundIds) },
        order: { roundId: 'ASC', order: 'ASC', id: 'ASC' },
      }),
      manager.getRepository(RoundAnswerEntity).find({
        where: { roundId: In(roundIds) },
        order: { roundId: 'ASC', snapshotId: 'ASC', id: 'ASC' },
      }),
      manager.getRepository(RoundQuestionAssessmentOverrideEntity).find({
        where: { roundId: In(roundIds) },
        order: { roundId: 'ASC', snapshotId: 'ASC', id: 'ASC' },
      }),
      manager.getRepository(DiscoveryFollowUpEntity).find({
        where: { projectId: In(projectIds) },
        order: { projectId: 'ASC', dueDate: 'ASC', createdAt: 'ASC', id: 'ASC' },
      }),
      loadRoundQuestionAssessmentPolicy(),
    ]);

    const result = new Map(unavailable);
    for (const { project, sourceRound } of projectsWithRounds) {
      const roundSnapshots = snapshots.filter((snapshot) => snapshot.roundId === sourceRound.id);
      if (!hasCanonicalGeneralStableKeys(roundSnapshots, policy)) {
        result.set(project.id, {
          available: false,
          projectId: project.id,
          reason: 'UNSUPPORTED_SCHEMA',
        });
        continue;
      }
      const answersBySnapshotId = new Map(
        answers
          .filter((answer) => answer.roundId === sourceRound.id)
          .map((answer) => [answer.snapshotId, answer]),
      );
      const overridesBySnapshotId = new Map(
        overrides
          .filter((override) => override.roundId === sourceRound.id)
          .map((override) => [override.snapshotId, override]),
      );
      const effectiveSnapshots = roundSnapshots.map((snapshot) =>
        toEffectiveRoundQuestionSnapshot(
          snapshot,
          answersBySnapshotId.get(snapshot.id) ?? null,
          overridesBySnapshotId.get(snapshot.id) ?? null,
          assessmentPolicy,
        ),
      );
      result.set(
        project.id,
        calculateProjectReadiness({
          project: {
            id: project.id,
            name: project.name,
            customerContactName: project.customerContactName,
            customerContactEmail: project.customerContactEmail,
            ballOwner: project.ballOwner,
          },
          sourceRound: { id: sourceRound.id, status: sourceRound.status },
          snapshots: effectiveSnapshots.map(toReadinessSnapshotInput),
          followUps: followUps
            .filter((followUp) => followUp.projectId === project.id)
            .map((followUp) => ({
              id: followUp.id,
              status: followUp.status,
              dueDate: followUp.dueDate,
              createdAt: followUp.createdAt.toISOString(),
            })),
          policy,
        }),
      );
    }
    return result;
  }
}

function hasCanonicalGeneralStableKeys(
  snapshots: readonly RoundQuestionSnapshotEntity[],
  policy: GeneralPlaybook,
): boolean {
  const expectedStableKeys = policy.items.map(
    (item) => `${policy.id}-${String(item.id).padStart(3, '0')}`,
  );
  if (snapshots.length !== expectedStableKeys.length) {
    return false;
  }
  const sourceStableKeys = new Set(snapshots.map((snapshot) => snapshot.stableKey));
  return (
    sourceStableKeys.size === expectedStableKeys.length &&
    expectedStableKeys.every((stableKey) => sourceStableKeys.has(stableKey))
  );
}

function toReadinessSnapshotInput(
  snapshot: RoundQuestionSnapshot,
): ReadinessSnapshotInput {
  return {
    id: snapshot.id,
    stableKey: snapshot.stableKey,
    required: snapshot.required,
    blocking: snapshot.blocking,
    order: snapshot.order,
    checklistStatus: snapshot.checklistStatus,
  };
}
