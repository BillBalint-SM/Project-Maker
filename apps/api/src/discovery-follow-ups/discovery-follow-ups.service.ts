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
} from '@project-maker/contracts';
import { loadGeneralPlaybookV1 } from '@project-maker/contracts/general-playbook-runtime';
import { DataSource, EntityManager } from 'typeorm';

import { AuditEvent, type AuditPayload } from '../audit/audit-event.entity';
import { Project } from '../projects/project.entity';
import { DiscoveryFollowUpEntity } from './discovery-follow-up.entity';

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
        nextStep: normalizeRequiredText(input.nextStep, 'nextStep must not be blank.'),
      });
      const followUp = toDiscoveryFollowUp(saved);
      await saveDiscoveryFollowUpAuditEvent(manager, followUp);
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

function toDiscoveryFollowUp(value: DiscoveryFollowUpEntity): DiscoveryFollowUp {
  return {
    id: value.id,
    projectId: value.projectId,
    category: value.category,
    question: value.question,
    owner: value.owner,
    dueDate: value.dueDate,
    status: value.status,
    nextStep: value.nextStep,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
  };
}
