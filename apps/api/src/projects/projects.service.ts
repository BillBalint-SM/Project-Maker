import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  CreateMarkdownRevisionInput,
  ProjectStatus,
  ProjectWorkspace,
} from '@project-maker/contracts';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';

import { AuditEvent, type AuditPayload } from '../audit/audit-event.entity';
import { CustomerFollowUpEntity } from '../follow-ups/follow-up.entity';
import { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { MarkdownService } from '../markdown/markdown.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectBasicsDto } from './dto/update-project-basics.dto';
import { UpdateProjectWorkspaceDto } from './dto/update-project-workspace.dto';
import { UpdateProjectPlaybookDto } from './dto/update-project-playbook.dto';
import { Project } from './project.entity';

const archivedStatus: ProjectStatus = 'ARCHIVED';
const draftStatus: ProjectStatus = 'DRAFT';
const projectDeletionConflictMessage =
  'Only a DRAFT without Customer communication or Git handoff history can be deleted. Archive it instead.';
const projectDeletionGuardCodes = new Set(['23001', '23503', '55000']);
const readyForPlanningStatus: ProjectStatus = 'READY_FOR_PLANNING';
const workspaceFields: readonly (keyof UpdateProjectWorkspaceDto)[] = [
  'internalOwnerName',
  'nextActionOwnerRole',
  'nextAction',
  'dueAt',
  'status',
];
const readyForPlanningRevision: CreateMarkdownRevisionInput = {
  reason: 'MILESTONE',
  milestone: readyForPlanningStatus,
};

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly dataSource: DataSource,
    private readonly markdownService: MarkdownService,
  ) {}

  async create(input: CreateProjectDto): Promise<ProjectWorkspace> {
    return this.dataSource.transaction(async (manager) => {
      const creationRequestId = input.creationRequestId ?? null;
      const projectRepository = manager.getRepository(Project);
      if (creationRequestId) {
        await manager.query(
          'SELECT pg_advisory_xact_lock(hashtext($1))',
          [creationRequestId],
        );
        const existingProject = await projectRepository.findOneBy({ creationRequestId });
        if (existingProject) {
          return toWorkspace(existingProject);
        }
      }

      const project = projectRepository.create({
        id: randomUUID(),
        creationRequestId,
        name: requireText(input.name, 'name'),
        customerContactName: requireText(input.customerContactName, 'customerContactName'),
        customerContactEmail: requireText(input.customerContactEmail, 'customerContactEmail'),
        status: draftStatus,
        internalOwnerName: requireText(input.internalOwnerName, 'internalOwnerName'),
        nextActionOwnerRole: input.nextActionOwnerRole ?? null,
        ballOwner: null,
        nextAction: optionalText(input.nextAction, 'nextAction'),
        dueAt: parseDueAt(input.dueAt),
        playbookId: input.playbookId ?? 'general',
        playbookVersion: input.playbookVersion ?? 1,
      });

      synchronizeCompatibilityOwner(project);
      return toWorkspace(await projectRepository.save(project));
    });
  }

  async list(): Promise<readonly ProjectWorkspace[]> {
    const projects = await this.projectRepository.find({
      order: { updatedAt: 'DESC', id: 'ASC' },
    });

    return projects.map(toWorkspace);
  }

  async updateWorkspace(
    projectId: string,
    input: UpdateProjectWorkspaceDto,
  ): Promise<ProjectWorkspace> {
    if (!workspaceFields.some((field) => hasField(input, field))) {
      throw new BadRequestException('Workspace update must include at least one field.');
    }

    return this.dataSource.transaction(async (manager) => {
      const projectRepository = manager.getRepository(Project);
      const project = await findLockedProject(manager, projectId);
      const previousStatus = project.status;

      if (project.status === archivedStatus) {
        throw new ConflictException('Archived projects must be restored before they can be updated.');
      }

      if (hasField(input, 'internalOwnerName')) {
        project.internalOwnerName = optionalText(input.internalOwnerName, 'internalOwnerName');
      }
      if (hasField(input, 'nextActionOwnerRole')) {
        project.nextActionOwnerRole = input.nextActionOwnerRole ?? null;
      }
      if (hasField(input, 'nextAction')) {
        project.nextAction = optionalText(input.nextAction, 'nextAction');
      }
      if (hasField(input, 'dueAt')) {
        project.dueAt = parseDueAt(input.dueAt);
      }
      if (hasField(input, 'status')) {
        if (!input.status || input.status === archivedStatus) {
          throw new BadRequestException(
            'Workspace status must be a non-archived project status; use the archive endpoint for ARCHIVED.',
          );
        }
        project.status = input.status;
      }

      validateNextActionOwner(project);
      synchronizeCompatibilityOwner(project);
      const savedProject = await projectRepository.save(project);
      if (previousStatus !== readyForPlanningStatus && savedProject.status === readyForPlanningStatus) {
        await this.markdownService.createWithinTransaction(
          manager,
          savedProject,
          readyForPlanningRevision,
        );
      }

      return toWorkspace(savedProject);
    });
  }

  async updateBasics(
    projectId: string,
    input: UpdateProjectBasicsDto,
  ): Promise<ProjectWorkspace> {
    return this.dataSource.transaction(async (manager) => {
      const project = await findLockedProject(manager, projectId);
      if (project.status === archivedStatus) {
        throw new ConflictException(
          'Archived projects must be restored before Project basics can be changed.',
        );
      }

      project.name = requireText(input.name, 'name');
      project.customerContactName = requireText(
        input.customerContactName,
        'customerContactName',
      );
      project.customerContactEmail = requireText(
        input.customerContactEmail,
        'customerContactEmail',
      );
      project.internalOwnerName = requireText(
        input.internalOwnerName,
        'internalOwnerName',
      );
      validateNextActionOwner(project);
      synchronizeCompatibilityOwner(project);

      return toWorkspace(await manager.getRepository(Project).save(project));
    });
  }

  async updatePlaybook(
    projectId: string,
    input: UpdateProjectPlaybookDto,
  ): Promise<ProjectWorkspace> {
    return this.dataSource.transaction(async (manager) => {
      const project = await findLockedProject(manager, projectId);
      if (project.status === archivedStatus) {
        throw new ConflictException('Archived projects cannot change playbook.');
      }
      if (await manager.getRepository(InterviewRoundEntity).existsBy({ projectId })) {
        throw new ConflictException('Project playbook is frozen after the first interview round starts.');
      }
      if (project.playbookId === input.playbookId && project.playbookVersion === input.playbookVersion) {
        return toWorkspace(project);
      }
      project.playbookId = input.playbookId;
      project.playbookVersion = input.playbookVersion;
      const saved = await manager.getRepository(Project).save(project);
      await manager.getRepository(AuditEvent).save({
        id: randomUUID(),
        projectId,
        eventType: 'PROJECT_PLAYBOOK_CHANGED',
        payload: { playbookId: saved.playbookId, playbookVersion: String(saved.playbookVersion) },
      });
      return toWorkspace(saved);
    });
  }

  async archive(projectId: string): Promise<ProjectWorkspace> {
    return this.dataSource.transaction(async (manager) => {
      const projectRepository = manager.getRepository(Project);
      const auditEventRepository = manager.getRepository(AuditEvent);
      const project = await findLockedProject(manager, projectId);

      if (project.status === archivedStatus) {
        throw new ConflictException('Project is already archived.');
      }

      const previousStatus = project.status;
      await pauseCustomerFollowUpSchedule(manager, projectId, new Date());
      project.archivedFromStatus = previousStatus;
      project.status = archivedStatus;
      const savedProject = await projectRepository.save(project);
      await auditEventRepository.save({
        id: randomUUID(),
        projectId: savedProject.id,
        eventType: 'PROJECT_ARCHIVED',
        payload: createStatusAuditPayload(previousStatus, archivedStatus),
      });

      return toWorkspace(savedProject);
    });
  }

  async restore(projectId: string): Promise<ProjectWorkspace> {
    return this.dataSource.transaction(async (manager) => {
      const projectRepository = manager.getRepository(Project);
      const auditEventRepository = manager.getRepository(AuditEvent);
      const project = await findLockedProject(manager, projectId);

      if (project.status !== archivedStatus) {
        throw new ConflictException('Only archived projects can be restored.');
      }

      const previousStatus = project.status;
      const restoredStatus = project.archivedFromStatus ?? draftStatus;
      await resumeCustomerFollowUpSchedule(manager, projectId, new Date());
      project.status = restoredStatus;
      project.archivedFromStatus = null;
      const savedProject = await projectRepository.save(project);
      await auditEventRepository.save({
        id: randomUUID(),
        projectId: savedProject.id,
        eventType: 'PROJECT_RESTORED',
        payload: createStatusAuditPayload(previousStatus, restoredStatus),
      });

      return toWorkspace(savedProject);
    });
  }

  async delete(projectId: string): Promise<void> {
    try {
      await this.dataSource.transaction(async (manager) => {
        const project = await findLockedProject(manager, projectId);
        if (project.status !== draftStatus) {
          throw new ConflictException(projectDeletionConflictMessage);
        }
        if (await hasExternalProjectHistory(manager, projectId)) {
          throw new ConflictException(projectDeletionConflictMessage);
        }
        await manager.getRepository(Project).remove(project);
      });
    } catch (error) {
      if (isProjectDeletionReferentialIntegrityViolation(error)) {
        throw new ConflictException(projectDeletionConflictMessage);
      }
      throw error;
    }
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

async function hasExternalProjectHistory(
  manager: EntityManager,
  projectId: string,
): Promise<boolean> {
  const rows = await manager.query<Array<{ hasHistory: boolean }>>(
    `SELECT EXISTS (
       SELECT 1 FROM "interview_customer_handoffs"
       WHERE "project_id" = $1 AND "state" <> 'DRAFT'
       UNION ALL
       SELECT 1 FROM "customer_follow_up_delivery_attempts" WHERE "project_id" = $1
       UNION ALL
       SELECT 1 FROM "customer_outbound_communications" WHERE "project_id" = $1
       UNION ALL
       SELECT 1 FROM "customer_correspondences" WHERE "project_id" = $1
       UNION ALL
       SELECT 1 FROM "customer_inbound_messages" WHERE "project_id" = $1
       UNION ALL
       SELECT 1 FROM "customer_mail_triage" WHERE "project_id" = $1
       UNION ALL
       SELECT 1 FROM "customer_mail_system_events" WHERE "project_id" = $1
       UNION ALL
       SELECT 1 FROM "customer_mail_triage_actions" WHERE "project_id" = $1
       UNION ALL
       SELECT 1 FROM "customer_response_requests" WHERE "project_id" = $1
       UNION ALL
       SELECT 1 FROM "delivery_handoffs" WHERE "project_id" = $1
     ) AS "hasHistory"`,
    [projectId],
  );
  return rows[0]?.hasHistory === true;
}

function isProjectDeletionReferentialIntegrityViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as { readonly code?: unknown };
  return (
    typeof driverError.code === 'string' &&
    projectDeletionGuardCodes.has(driverError.code)
  );
}

function hasField(
  input: UpdateProjectWorkspaceDto,
  field: keyof UpdateProjectWorkspaceDto,
): boolean {
  return input[field] !== undefined;
}

function requireText(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new BadRequestException(`${field} must not be blank.`);
  }
  return normalized;
}

function optionalText(value: string | null | undefined, field: string): string | null {
  if (value === null || value === undefined) {
    return null;
  }
  return requireText(value, field);
}

function parseDueAt(value: string | null | undefined): Date | null {
  if (value === null || value === undefined) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || !value.endsWith('Z')) {
    throw new BadRequestException('dueAt must be a valid UTC ISO date.');
  }
  return parsed;
}

export function toWorkspace(project: Project): ProjectWorkspace {
  return {
    id: project.id,
    name: project.name,
    customerContactName: project.customerContactName,
    customerContactEmail: project.customerContactEmail,
    status: project.status,
    internalOwnerName: project.internalOwnerName,
    nextActionOwnerRole: project.nextActionOwnerRole,
    nextActionOwner: toNextActionOwner(project),
    nextAction: project.nextAction,
    dueAt: toIsoOrNull(project.dueAt),
    playbook: {
      id: project.playbookId,
      version: project.playbookVersion,
      name: playbookName(project.playbookId, project.playbookVersion),
    },
    initiativeId: project.initiativeId,
    createdAt: toIso(project.createdAt, 'createdAt'),
    updatedAt: toIso(project.updatedAt, 'updatedAt'),
  };
}

function playbookName(id: string, version: number): string {
  const names: Readonly<Record<string, string>> = {
    'general:1': 'General project discovery',
    'system-integration:1': 'System integration',
    'data-migration:1': 'Data migration',
  };
  return names[`${id}:${version}`] ?? `${id} v${version}`;
}

function validateNextActionOwner(project: Project): void {
  if (project.nextActionOwnerRole === 'INTERNAL_OWNER' && !project.internalOwnerName) {
    throw new BadRequestException('The internal owner name is required when the next action belongs to the internal owner.');
  }
  if (project.nextActionOwnerRole === 'CUSTOMER_CONTACT' && !project.customerContactName.trim()) {
    throw new BadRequestException('The customer contact name is required when the next action belongs to the customer contact.');
  }
}

const minuteMilliseconds = 60_000;

async function pauseCustomerFollowUpSchedule(
  manager: EntityManager,
  projectId: string,
  archivedAt: Date,
): Promise<void> {
  const repository = manager.getRepository(CustomerFollowUpEntity);
  const state = await repository.findOne({
    where: { projectId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!state) return;

  if (state.enabled && state.nextPingAt) {
    const remainingMilliseconds = state.nextPingAt.getTime() - archivedAt.getTime();
    state.pausedRemainingMilliseconds = remainingMilliseconds > 0
      ? remainingMilliseconds
      : state.intervalMinutes * minuteMilliseconds;
    state.nextPingAt = null;
  } else {
    state.pausedRemainingMilliseconds = null;
  }
  await repository.save(state);
}

async function resumeCustomerFollowUpSchedule(
  manager: EntityManager,
  projectId: string,
  restoredAt: Date,
): Promise<void> {
  const repository = manager.getRepository(CustomerFollowUpEntity);
  const state = await repository.findOne({
    where: { projectId },
    lock: { mode: 'pessimistic_write' },
  });
  if (!state || state.pausedRemainingMilliseconds === null) return;

  const nextPingAt = new Date(
    restoredAt.getTime() + state.pausedRemainingMilliseconds,
  );
  state.pausedRemainingMilliseconds = null;
  if (!state.enabled || (state.expiresAt && state.expiresAt <= nextPingAt)) {
    state.enabled = false;
    state.nextPingAt = null;
  } else {
    state.nextPingAt = nextPingAt;
  }
  await repository.save(state);
}

function synchronizeCompatibilityOwner(project: Project): void {
  if (project.nextActionOwnerRole === 'INTERNAL_OWNER') {
    project.ballOwner = project.internalOwnerName;
  } else if (project.nextActionOwnerRole === 'CUSTOMER_CONTACT') {
    project.ballOwner = project.customerContactName;
  } else {
    project.ballOwner = null;
  }
}

export function toNextActionOwner(project: Project): ProjectWorkspace['nextActionOwner'] {
  const displayName = project.nextActionOwnerRole === 'INTERNAL_OWNER'
    ? project.internalOwnerName
    : project.nextActionOwnerRole === 'CUSTOMER_CONTACT'
      ? project.customerContactName
      : null;
  return {
    role: project.nextActionOwnerRole,
    displayName,
    complete: project.nextActionOwnerRole !== null && displayName !== null,
  };
}

function toIsoOrNull(value: Date | null): string | null {
  return value === null ? null : toIso(value, 'dueAt');
}

function toIso(value: Date, field: string): string {
  const timestamp = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new InternalServerErrorException(`Stored project ${field} is invalid.`);
  }
  return timestamp.toISOString();
}

function createStatusAuditPayload(
  fromStatus: ProjectStatus,
  toStatus: ProjectStatus,
): AuditPayload {
  return { fromStatus, toStatus };
}
