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
  ResolveDiscoveryFollowUpInput,
  UpdateDiscoveryFollowUpInput,
} from '@project-maker/contracts';
import { loadGeneralPlaybookV1 } from '@project-maker/contracts/general-playbook-runtime';
import { DataSource, EntityManager } from 'typeorm';

import { AuditEvent, type AuditPayload } from '../audit/audit-event.entity';
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

@Injectable()
export class DiscoveryFollowUpsService {
  constructor(private readonly dataSource: DataSource) {}

  async list(projectId: string): Promise<readonly DiscoveryFollowUp[]> {
    await findProject(this.dataSource, projectId);
    const rows = await this.dataSource.getRepository(DiscoveryFollowUpEntity).find({
      where: { projectId },
      order: { dueDate: 'ASC', createdAt: 'ASC', id: 'ASC' },
    });
    return rows.map(toDiscoveryFollowUp);
  }

  async create(
    projectId: string,
    input: CreateDiscoveryFollowUpInput,
  ): Promise<DiscoveryFollowUp> {
    return this.dataSource.transaction(async (manager) => {
      const project = await findLockedProject(manager, projectId);
      rejectArchivedProject(project);
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
      });
      const followUp = toDiscoveryFollowUp(saved);
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
        return toDiscoveryFollowUp(entity);
      }

      entity.category = normalized.category;
      entity.question = normalized.question;
      entity.owner = normalized.owner;
      entity.dueDate = normalized.dueDate;
      entity.nextStep = normalized.nextStep;

      const saved = await manager.getRepository(DiscoveryFollowUpEntity).save(entity);
      const followUp = toDiscoveryFollowUp(saved);
      await saveDiscoveryFollowUpUpdateAuditEvent(manager, followUp, changedFields);
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
      const followUp = toDiscoveryFollowUp(saved);
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

function toDiscoveryFollowUp(value: DiscoveryFollowUpEntity): DiscoveryFollowUp {
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
  };
}
