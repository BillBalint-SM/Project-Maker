import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import type {
  CreateDiscoveryFollowUpInput,
  DiscoveryFollowUp,
  DiscoveryFollowUpSourceOption,
  DiscoveryFollowUpSourceReference,
  OpenDiscoveryFollowUpQueueItem,
  ResolveDiscoveryFollowUpInput,
  SetDiscoveryFollowUpSourceLinkInput,
  UpdateDiscoveryFollowUpInput,
} from '@project-maker/contracts';
import { loadGeneralPlaybookV1 } from '@project-maker/contracts/general-playbook-runtime';
import { DataSource, EntityManager, In } from 'typeorm';

import { AuditEvent, type AuditPayload } from '../audit/audit-event.entity';
import { findCurrentInitialIntakeSource } from '../interviews/current-initial-intake-source';
import { RoundQuestionSnapshotEntity } from '../interviews/round-question-snapshot.entity';
import { Project } from '../projects/project.entity';
import { DiscoveryFollowUpEntity } from './discovery-follow-up.entity';

const editableDiscoveryFollowUpFields = [
  'category',
  'question',
  'owner',
  'dueDate',
  'nextStep',
] as const;

type EditableDiscoveryFollowUpField =
  (typeof editableDiscoveryFollowUpFields)[number];

type DiscoveryFollowUpSourceAuditReference = Pick<
  DiscoveryFollowUpSourceReference,
  'order' | 'topic' | 'controlPoint'
>;

@Injectable()
export class DiscoveryFollowUpsService {
  constructor(private readonly dataSource: DataSource) {}

  async listOpen(): Promise<readonly OpenDiscoveryFollowUpQueueItem[]> {
    const openStatus = await initialDiscoveryFollowUpStatus();
    const rows = await this.dataSource
      .getRepository(DiscoveryFollowUpEntity)
      .createQueryBuilder('followUp')
      .innerJoin(Project, 'project', 'project.id = followUp.projectId')
      .select('followUp.id', 'id')
      .addSelect('followUp.projectId', 'projectId')
      .addSelect('project.name', 'projectName')
      .addSelect('followUp.category', 'category')
      .addSelect('followUp.question', 'question')
      .addSelect('followUp.owner', 'owner')
      .addSelect("to_char(followUp.dueDate, 'YYYY-MM-DD')", 'dueDate')
      .addSelect('followUp.nextStep', 'nextStep')
      .where('followUp.status = :openStatus', { openStatus })
      .andWhere('project.status <> :archivedStatus', {
        archivedStatus: 'ARCHIVED',
      })
      .orderBy('followUp.dueDate', 'ASC')
      .addOrderBy('followUp.createdAt', 'ASC')
      .addOrderBy('followUp.id', 'ASC')
      .getRawMany<OpenDiscoveryFollowUpQueueItem>();

    return rows;
  }

  async list(projectId: string): Promise<readonly DiscoveryFollowUp[]> {
    await findProject(this.dataSource, projectId);
    const rows = await this.dataSource.getRepository(DiscoveryFollowUpEntity).find({
      where: { projectId },
      order: { dueDate: 'ASC', createdAt: 'ASC', id: 'ASC' },
    });
    const sourceSnapshots = await loadSourceSnapshotsByFollowUp(this.dataSource.manager, rows);
    return rows.map((row) =>
      toDiscoveryFollowUp(row, requireSourceSnapshot(row, sourceSnapshots)),
    );
  }

  async listSourceOptions(
    projectId: string,
  ): Promise<readonly DiscoveryFollowUpSourceOption[]> {
    await findProject(this.dataSource, projectId);
    const sourceRound = await findCurrentInitialIntakeSource(
      this.dataSource.manager,
      projectId,
    );
    if (!sourceRound) {
      return [];
    }
    const snapshots = await this.dataSource
      .getRepository(RoundQuestionSnapshotEntity)
      .find({
        where: { roundId: sourceRound.id },
        order: { order: 'ASC', id: 'ASC' },
      });
    return snapshots.map((snapshot) => ({
      snapshotId: snapshot.id,
      order: snapshot.order,
      topic: snapshot.topic,
      controlPoint: snapshot.controlPoint,
      text: snapshot.text,
    }));
  }

  async create(
    projectId: string,
    input: CreateDiscoveryFollowUpInput,
  ): Promise<DiscoveryFollowUp> {
    return this.dataSource.transaction(async (manager) => {
      const project = await findLockedProject(manager, projectId);
      rejectArchivedProject(project);
      const sourceSnapshot =
        input.sourceSnapshotId === undefined
          ? null
          : await requireCurrentSourceSnapshot(manager, projectId, input.sourceSnapshotId);
      const saved = await manager.getRepository(DiscoveryFollowUpEntity).save({
        id: randomUUID(),
        projectId,
        category: input.category,
        question: normalizeRequiredText(input.question, 'question must not be blank.'),
        owner: normalizeRequiredText(input.owner, 'owner must not be blank.'),
        dueDate: parseDueDate(input.dueDate),
        status: await initialDiscoveryFollowUpStatus(),
        decisionOrAnswer: null,
        nextStep: normalizeRequiredText(input.nextStep, 'nextStep must not be blank.'),
        sourceSnapshotId: sourceSnapshot?.id ?? null,
      });
      const followUp = toDiscoveryFollowUp(saved, sourceSnapshot);
      await saveDiscoveryFollowUpAuditEvent(manager, followUp);
      return followUp;
    });
  }

  async update(
    projectId: string,
    followUpId: string,
    input: UpdateDiscoveryFollowUpInput,
  ): Promise<DiscoveryFollowUp> {
    return this.dataSource.transaction(async (manager) => {
      const project = await findLockedProject(manager, projectId);
      rejectArchivedProjectForEditing(project);

      const entity = await findLockedDiscoveryFollowUp(
        manager,
        projectId,
        followUpId,
      );
      const openStatus = await initialDiscoveryFollowUpStatus();
      if (entity.status !== openStatus) {
        throw new ConflictException('Discovery follow-up is not open.');
      }
      if (entity.version !== input.expectedVersion) {
        throw new ConflictException('Discovery follow-up has changed.');
      }

      const normalized = {
        category: input.category,
        question: normalizeRequiredText(input.question, 'question must not be blank.'),
        owner: normalizeRequiredText(input.owner, 'owner must not be blank.'),
        dueDate: parseDueDate(input.dueDate),
        nextStep: normalizeRequiredText(input.nextStep, 'nextStep must not be blank.'),
      };
      const changedFields = editableDiscoveryFollowUpFields.filter(
        (field) => entity[field] !== normalized[field],
      );
      if (changedFields.length === 0) {
        return toDiscoveryFollowUp(
          entity,
          await loadSourceSnapshotForFollowUp(manager, entity),
        );
      }

      entity.category = normalized.category;
      entity.question = normalized.question;
      entity.owner = normalized.owner;
      entity.dueDate = normalized.dueDate;
      entity.nextStep = normalized.nextStep;

      const saved = await manager.getRepository(DiscoveryFollowUpEntity).save(entity);
      const followUp = toDiscoveryFollowUp(
        saved,
        await loadSourceSnapshotForFollowUp(manager, saved),
      );
      await saveDiscoveryFollowUpUpdateAuditEvent(manager, followUp, changedFields);
      return followUp;
    });
  }

  async setSourceLink(
    projectId: string,
    followUpId: string,
    input: SetDiscoveryFollowUpSourceLinkInput,
  ): Promise<DiscoveryFollowUp> {
    return this.dataSource.transaction(async (manager) => {
      const project = await findLockedProject(manager, projectId);
      rejectArchivedProjectForSourceLinking(project);

      const entity = await findLockedDiscoveryFollowUp(
        manager,
        projectId,
        followUpId,
      );
      if (entity.status !== (await initialDiscoveryFollowUpStatus())) {
        throw new ConflictException('Discovery follow-up is not open.');
      }
      if (entity.version !== input.expectedVersion) {
        throw new ConflictException('Discovery follow-up has changed.');
      }

      const previousSnapshot = await requireStoredSourceSnapshot(
        manager,
        entity.sourceSnapshotId,
      );
      if (entity.sourceSnapshotId === input.sourceSnapshotId) {
        return toDiscoveryFollowUp(entity, previousSnapshot);
      }

      const nextSnapshot =
        input.sourceSnapshotId === null
          ? null
          : await requireCurrentSourceSnapshot(
              manager,
              projectId,
              input.sourceSnapshotId,
            );
      entity.sourceSnapshotId = nextSnapshot?.id ?? null;
      const saved = await manager.getRepository(DiscoveryFollowUpEntity).save(entity);
      const followUp = toDiscoveryFollowUp(saved, nextSnapshot);
      await saveDiscoveryFollowUpSourceLinkAuditEvent(
        manager,
        followUp.projectId,
        followUp.id,
        previousSnapshot ? toSourceAuditReference(previousSnapshot) : null,
        nextSnapshot ? toSourceAuditReference(nextSnapshot) : null,
      );
      return followUp;
    });
  }

  async resolve(
    projectId: string,
    followUpId: string,
    input: ResolveDiscoveryFollowUpInput,
  ): Promise<DiscoveryFollowUp> {
    return this.dataSource.transaction(async (manager) => {
      const project = await findLockedProject(manager, projectId);
      rejectArchivedProjectForResolution(project);

      const entity = await findLockedDiscoveryFollowUp(manager, projectId, followUpId);
      const resolvedStatuses = await loadResolvedDiscoveryFollowUpStatuses();
      if (resolvedStatuses.includes(entity.status)) {
        throw new ConflictException('Discovery follow-up is already resolved.');
      }

      entity.status = requireResolvedDiscoveryFollowUpStatus(input.status, resolvedStatuses);
      entity.decisionOrAnswer = normalizeRequiredText(
        input.decisionOrAnswer,
        'decisionOrAnswer must not be blank.',
      );

      const saved = await manager.getRepository(DiscoveryFollowUpEntity).save(entity);
      const followUp = toDiscoveryFollowUp(
        saved,
        await loadSourceSnapshotForFollowUp(manager, saved),
      );
      await saveDiscoveryFollowUpResolutionAuditEvent(manager, followUp);
      return followUp;
    });
  }
}

async function findProject(
  dataSource: DataSource,
  projectId: string,
): Promise<Project> {
  const project = await dataSource.getRepository(Project).findOneBy({ id: projectId });
  if (!project) {
    throw new NotFoundException('Project not found.');
  }
  return project;
}

async function findLockedProject(
  manager: EntityManager,
  projectId: string,
): Promise<Project> {
  const project = await manager.getRepository(Project).findOne({
    where: { id: projectId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!project) {
    throw new NotFoundException('Project not found.');
  }
  return project;
}

function rejectArchivedProject(project: Project): void {
  if (project.status === 'ARCHIVED') {
    throw new ConflictException('Archived projects cannot create discovery follow-ups.');
  }
}

function rejectArchivedProjectForResolution(project: Project): void {
  if (project.status === 'ARCHIVED') {
    throw new ConflictException('Archived projects cannot resolve discovery follow-ups.');
  }
}

function rejectArchivedProjectForEditing(project: Project): void {
  if (project.status === 'ARCHIVED') {
    throw new ConflictException('Archived projects cannot edit discovery follow-ups.');
  }
}

async function findLockedDiscoveryFollowUp(
  manager: EntityManager,
  projectId: string,
  followUpId: string,
): Promise<DiscoveryFollowUpEntity> {
  const followUp = await manager.getRepository(DiscoveryFollowUpEntity).findOne({
    where: { id: followUpId, projectId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!followUp) {
    throw new NotFoundException('Discovery follow-up not found.');
  }
  return followUp;
}

function rejectArchivedProjectForSourceLinking(project: Project): void {
  if (project.status === 'ARCHIVED') {
    throw new ConflictException(
      'Archived projects cannot change discovery follow-up sources.',
    );
  }
}

async function requireCurrentSourceSnapshot(
  manager: EntityManager,
  projectId: string,
  sourceSnapshotId: string,
): Promise<RoundQuestionSnapshotEntity> {
  const sourceRound = await findCurrentInitialIntakeSource(manager, projectId);
  if (!sourceRound) {
    throw new ConflictException('No current Initial Intake source is available.');
  }
  const snapshot = await manager.getRepository(RoundQuestionSnapshotEntity).findOneBy({
    id: sourceSnapshotId,
    roundId: sourceRound.id,
  });
  if (!snapshot) {
    throw new ConflictException(
      'Selected source is not part of the current Initial Intake.',
    );
  }
  return snapshot;
}

async function requireStoredSourceSnapshot(
  manager: EntityManager,
  sourceSnapshotId: string | null,
): Promise<RoundQuestionSnapshotEntity | null> {
  if (sourceSnapshotId === null) {
    return null;
  }
  const snapshot = await manager
    .getRepository(RoundQuestionSnapshotEntity)
    .findOneBy({ id: sourceSnapshotId });
  if (!snapshot) {
    throw new InternalServerErrorException(
      'Stored discovery follow-up source is missing.',
    );
  }
  return snapshot;
}

async function loadSourceSnapshotForFollowUp(
  manager: EntityManager,
  followUp: DiscoveryFollowUpEntity,
): Promise<RoundQuestionSnapshotEntity | null> {
  const sourceSnapshots = await loadSourceSnapshotsByFollowUp(manager, [followUp]);
  return requireSourceSnapshot(followUp, sourceSnapshots);
}

async function loadSourceSnapshotsByFollowUp(
  manager: EntityManager,
  followUps: readonly DiscoveryFollowUpEntity[],
): Promise<ReadonlyMap<string, RoundQuestionSnapshotEntity>> {
  const ids = followUps
    .map((followUp) => followUp.sourceSnapshotId)
    .filter((id): id is string => id !== null);
  if (ids.length === 0) {
    return new Map();
  }
  const snapshots = await manager.getRepository(RoundQuestionSnapshotEntity).findBy({
    id: In(ids),
  });
  return new Map(snapshots.map((snapshot) => [snapshot.id, snapshot]));
}

function requireSourceSnapshot(
  followUp: DiscoveryFollowUpEntity,
  sourceSnapshots: ReadonlyMap<string, RoundQuestionSnapshotEntity>,
): RoundQuestionSnapshotEntity | null {
  if (followUp.sourceSnapshotId === null) {
    return null;
  }
  const snapshot = sourceSnapshots.get(followUp.sourceSnapshotId);
  if (!snapshot) {
    throw new InternalServerErrorException('Stored discovery follow-up source is missing.');
  }
  return snapshot;
}

function normalizeRequiredText(value: string, errorMessage: string): string {
  const normalized = value.trim();
  if (!normalized) {
    throw new BadRequestException(errorMessage);
  }
  return normalized;
}

function parseDueDate(value: string): string {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException('dueDate must be a real calendar date.');
  }
  return value;
}

async function initialDiscoveryFollowUpStatus(): Promise<string> {
  const generalPlaybookV1 = await loadGeneralPlaybookV1();
  const status = generalPlaybookV1.statuses.followUp[0];
  if (!status || !generalPlaybookV1.statuses.followUp.includes(status)) {
    throw new InternalServerErrorException(
      'Canonical follow-up status configuration is invalid.',
    );
  }
  return status;
}

async function loadResolvedDiscoveryFollowUpStatuses(): Promise<readonly string[]> {
  const generalPlaybookV1 = await loadGeneralPlaybookV1();
  const statuses = generalPlaybookV1.scoring.readiness.resolvedFollowUpStatuses;
  if (
    statuses.length === 0 ||
    statuses.some((status) => !generalPlaybookV1.statuses.followUp.includes(status))
  ) {
    throw new InternalServerErrorException(
      'Canonical resolved follow-up status configuration is invalid.',
    );
  }
  return statuses;
}

function requireResolvedDiscoveryFollowUpStatus(
  value: string,
  allowedStatuses: readonly string[],
): string {
  if (!allowedStatuses.includes(value)) {
    throw new BadRequestException(
      'status must be a canonical resolved follow-up status.',
    );
  }
  return value;
}

async function saveDiscoveryFollowUpAuditEvent(
  manager: EntityManager,
  followUp: DiscoveryFollowUp,
): Promise<void> {
  const payload: AuditPayload = {
    followUpId: followUp.id,
    category: followUp.category,
    dueDate: followUp.dueDate,
    status: followUp.status,
    ...(followUp.source
      ? {
          sourceOrder: String(followUp.source.order),
          sourceTopic: followUp.source.topic,
          sourceControlPoint: followUp.source.controlPoint,
        }
      : {}),
  };
  await manager.getRepository(AuditEvent).save({
    id: randomUUID(),
    projectId: followUp.projectId,
    eventType: 'DISCOVERY_FOLLOW_UP_CREATED',
    payload,
  });
}

async function saveDiscoveryFollowUpResolutionAuditEvent(
  manager: EntityManager,
  followUp: DiscoveryFollowUp,
): Promise<void> {
  const payload: AuditPayload = {
    followUpId: followUp.id,
    status: followUp.status,
  };
  await manager.getRepository(AuditEvent).save({
    id: randomUUID(),
    projectId: followUp.projectId,
    eventType: 'DISCOVERY_FOLLOW_UP_RESOLVED',
    payload,
  });
}

async function saveDiscoveryFollowUpUpdateAuditEvent(
  manager: EntityManager,
  followUp: DiscoveryFollowUp,
  changedFields: readonly EditableDiscoveryFollowUpField[],
): Promise<void> {
  const payload: AuditPayload = {
    followUpId: followUp.id,
    changedFields: changedFields.join(','),
  };
  await manager.getRepository(AuditEvent).save({
    id: randomUUID(),
    projectId: followUp.projectId,
    eventType: 'DISCOVERY_FOLLOW_UP_UPDATED',
    payload,
  });
}

async function saveDiscoveryFollowUpSourceLinkAuditEvent(
  manager: EntityManager,
  projectId: string,
  followUpId: string,
  previousSource: DiscoveryFollowUpSourceAuditReference | null,
  source: DiscoveryFollowUpSourceAuditReference | null,
): Promise<void> {
  const sourceAction =
    previousSource === null
      ? 'ADDED'
      : source === null
        ? 'REMOVED'
        : 'REPLACED';
  const payload: AuditPayload = {
    followUpId,
    sourceAction,
    ...(previousSource
      ? {
          previousSourceOrder: String(previousSource.order),
          previousSourceTopic: previousSource.topic,
          previousSourceControlPoint: previousSource.controlPoint,
        }
      : {}),
    ...(source
      ? {
          sourceOrder: String(source.order),
          sourceTopic: source.topic,
          sourceControlPoint: source.controlPoint,
        }
      : {}),
  };
  await manager.getRepository(AuditEvent).save({
    id: randomUUID(),
    projectId,
    eventType: 'DISCOVERY_FOLLOW_UP_SOURCE_LINK_CHANGED',
    payload,
  });
}

function toSourceAuditReference(
  snapshot: RoundQuestionSnapshotEntity,
): DiscoveryFollowUpSourceAuditReference {
  return {
    order: snapshot.order,
    topic: snapshot.topic,
    controlPoint: snapshot.controlPoint,
  };
}

function toSourceReference(
  snapshot: RoundQuestionSnapshotEntity,
): DiscoveryFollowUpSourceReference {
  return {
    snapshotId: snapshot.id,
    order: snapshot.order,
    topic: snapshot.topic,
    controlPoint: snapshot.controlPoint,
  };
}

function toDiscoveryFollowUp(
  value: DiscoveryFollowUpEntity,
  sourceSnapshot: RoundQuestionSnapshotEntity | null,
): DiscoveryFollowUp {
  return {
    id: value.id,
    projectId: value.projectId,
    category: value.category,
    question: value.question,
    owner: value.owner,
    dueDate: value.dueDate,
    status: value.status,
    decisionOrAnswer: value.decisionOrAnswer,
    nextStep: value.nextStep,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
    version: value.version,
    source: sourceSnapshot ? toSourceReference(sourceSnapshot) : null,
  };
}
