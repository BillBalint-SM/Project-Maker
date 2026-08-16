import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  GeneralPlaybook,
  ProjectReadiness,
  RoundQuestionSnapshot,
} from '@project-maker/contracts';
import { loadGeneralPlaybookV1 } from '@project-maker/contracts/general-playbook-runtime';
import { DataSource, EntityManager } from 'typeorm';

import { DiscoveryFollowUpEntity } from '../discovery-follow-ups/discovery-follow-up.entity';
import { findCurrentInitialIntakeSource } from '../interviews/current-initial-intake-source';
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

    const sourceRound = await findCurrentInitialIntakeSource(
      manager,
      projectId,
    );
    if (!sourceRound) {
      return { available: false, projectId, reason: 'NO_INITIAL_INTAKE' };
    }

    const policy = await loadGeneralPlaybookV1();
    const snapshots = await manager.getRepository(RoundQuestionSnapshotEntity).find({
      where: { roundId: sourceRound.id },
      order: { order: 'ASC', id: 'ASC' },
    });
    if (!hasCanonicalGeneralStableKeys(snapshots, policy)) {
      return { available: false, projectId, reason: 'UNSUPPORTED_SCHEMA' };
    }

    const [answers, overrides, followUps, assessmentPolicy] = await Promise.all([
      manager.getRepository(RoundAnswerEntity).find({
        where: { roundId: sourceRound.id },
        order: { snapshotId: 'ASC', id: 'ASC' },
      }),
      manager.getRepository(RoundQuestionAssessmentOverrideEntity).find({
        where: { roundId: sourceRound.id },
        order: { snapshotId: 'ASC', id: 'ASC' },
      }),
      manager.getRepository(DiscoveryFollowUpEntity).find({
        where: { projectId },
        order: { dueDate: 'ASC', createdAt: 'ASC', id: 'ASC' },
      }),
      loadRoundQuestionAssessmentPolicy(),
    ]);
    const answersBySnapshotId = new Map(answers.map((answer) => [answer.snapshotId, answer]));
    const overridesBySnapshotId = new Map(
      overrides.map((override) => [override.snapshotId, override]),
    );
    const effectiveSnapshots = snapshots.map((snapshot) =>
      toEffectiveRoundQuestionSnapshot(
        snapshot,
        answersBySnapshotId.get(snapshot.id) ?? null,
        overridesBySnapshotId.get(snapshot.id) ?? null,
        assessmentPolicy,
      ),
    );

    return calculateProjectReadiness({
      project: {
        id: project.id,
        name: project.name,
        customerContactName: project.customerContactName,
        customerContactEmail: project.customerContactEmail,
        ballOwner: project.ballOwner,
      },
      sourceRound: { id: sourceRound.id, status: sourceRound.status },
      snapshots: effectiveSnapshots.map(toReadinessSnapshotInput),
      followUps: followUps.map((followUp) => ({
        id: followUp.id,
        status: followUp.status,
        dueDate: followUp.dueDate,
        createdAt: followUp.createdAt.toISOString(),
      })),
      policy,
    });
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
