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
import { DiscoveryFollowUpEntity } from '../discovery-follow-ups/discovery-follow-up.entity';
import { CustomerFollowUpEntity } from '../follow-ups/follow-up.entity';
import { InterviewRoundEntity } from '../interviews/interview-round.entity';
import { MarkdownRevisionEntity } from '../markdown/markdown-revision.entity';
import { ProjectQuestionSchemaEntity } from '../question-bank/project-question-schema.entity';
import { MarkdownService } from '../markdown/markdown.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectBasicsDto } from './dto/update-project-basics.dto';
import { UpdateProjectWorkspaceDto } from './dto/update-project-workspace.dto';
import { Project } from './project.entity';

const archivedStatus: ProjectStatus = 'ARCHIVED';
const draftStatus: ProjectStatus = 'DRAFT';
const projectDeletionConflictMessage =
  'This project has persisted activity and cannot be deleted. Archive it instead.';
const projectDeletionReferentialIntegrityCodes = new Set(['23001', '23503']);
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
      if (
        project.status === archivedStatus ||
        await manager.getRepository(ProjectQuestionSchemaEntity).existsBy({ projectId })
      ) {
        throw new ConflictException(
          'Project basics can only be changed before the first question schema is accepted and while the project is active.',
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

  async archive(projectId: string): Promise<ProjectWorkspace> {
    return this.dataSource.transaction(async (manager) => {
      const projectRepository = manager.getRepository(Project);
      const auditEventRepository = manager.getRepository(AuditEvent);
      const project = await findLockedProject(manager, projectId);

      if (project.status === archivedStatus) {
        throw new ConflictException('Project is already archived.');
      }

      const previousStatus = project.status;
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
      project.status = draftStatus;
      const savedProject = await projectRepository.save(project);
      await auditEventRepository.save({
        id: randomUUID(),
        projectId: savedProject.id,
        eventType: 'PROJECT_RESTORED',
        payload: createStatusAuditPayload(previousStatus, draftStatus),
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
        if (await hasPersistedProjectActivity(manager, projectId)) {
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

async function hasPersistedProjectActivity(
  manager: EntityManager,
  projectId: string,
): Promise<boolean> {
  const project = await manager.getRepository(Project).findOneByOrFail({ id: projectId });
  if (
    project.businessValueRating !== null ||
    project.strategicAlignmentRating !== null ||
    project.urgencyRating !== null ||
    project.confidenceRating !== null ||
    project.complexityRating !== null ||
    project.riskRating !== null
  ) {
    return true;
  }
  if (await manager.getRepository(AuditEvent).existsBy({ projectId })) {
    return true;
  }
  if (await manager.getRepository(ProjectQuestionSchemaEntity).existsBy({ projectId })) {
    return true;
  }
  if (await manager.getRepository(InterviewRoundEntity).existsBy({ projectId })) {
    return true;
  }
  if (await manager.getRepository(MarkdownRevisionEntity).existsBy({ projectId })) {
    return true;
  }
  if (await manager.getRepository(DiscoveryFollowUpEntity).existsBy({ projectId })) {
    return true;
  }
  return manager.getRepository(CustomerFollowUpEntity).existsBy({ projectId });
}

function isProjectDeletionReferentialIntegrityViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as { readonly code?: unknown };
  return (
    typeof driverError.code === 'string' &&
    projectDeletionReferentialIntegrityCodes.has(driverError.code)
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
    createdAt: toIso(project.createdAt, 'createdAt'),
    updatedAt: toIso(project.updatedAt, 'updatedAt'),
  };
}

function validateNextActionOwner(project: Project): void {
  if (project.nextActionOwnerRole === 'INTERNAL_OWNER' && !project.internalOwnerName) {
    throw new BadRequestException('The internal owner name is required when the next action belongs to the internal owner.');
  }
  if (project.nextActionOwnerRole === 'CUSTOMER_CONTACT' && !project.customerContactName.trim()) {
    throw new BadRequestException('The customer contact name is required when the next action belongs to the customer contact.');
  }
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
