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
  ProjectCockpit,
  ProjectStatus,
  ProjectWorkspace,
} from '@project-maker/contracts';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { AuditEvent, type AuditPayload } from '../audit/audit-event.entity';
import { MarkdownService } from '../markdown/markdown.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectWorkspaceDto } from './dto/update-project-workspace.dto';
import { Project } from './project.entity';

const archivedStatus: ProjectStatus = 'ARCHIVED';
const draftStatus: ProjectStatus = 'DRAFT';
const readyForPlanningStatus: ProjectStatus = 'READY_FOR_PLANNING';
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
    const project = this.projectRepository.create({
      id: randomUUID(),
      name: requireText(input.name, 'name'),
      customerContactName: requireText(input.customerContactName, 'customerContactName'),
      customerContactEmail: requireText(input.customerContactEmail, 'customerContactEmail'),
      status: draftStatus,
      ballOwner: optionalText(input.ballOwner, 'ballOwner'),
      nextAction: optionalText(input.nextAction, 'nextAction'),
      dueAt: parseDueAt(input.dueAt),
    });

    return toWorkspace(await this.projectRepository.save(project));
  }

  async list(): Promise<readonly ProjectWorkspace[]> {
    const projects = await this.projectRepository.find({
      order: { updatedAt: 'DESC', id: 'ASC' },
    });

    return projects.map(toWorkspace);
  }

  async cockpit(projectId: string): Promise<ProjectCockpit> {
    const project = await this.findProject(projectId);
    return {
      projectId: project.id,
      status: project.status,
      ballOwner: project.ballOwner,
      nextAction: project.nextAction,
      dueAt: toIsoOrNull(project.dueAt),
    };
  }

  async updateWorkspace(
    projectId: string,
    input: UpdateProjectWorkspaceDto,
  ): Promise<ProjectWorkspace> {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('Workspace update must include at least one field.');
    }

    return this.dataSource.transaction(async (manager) => {
      const projectRepository = manager.getRepository(Project);
      const project = await findLockedProject(manager, projectId);
      const previousStatus = project.status;

      if (project.status === archivedStatus) {
        throw new ConflictException('Archived projects must be restored before they can be updated.');
      }

      if (hasField(input, 'ballOwner')) {
        project.ballOwner = optionalText(input.ballOwner, 'ballOwner');
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

  private async findProject(projectId: string): Promise<Project> {
    const project = await this.projectRepository.findOneBy({ id: projectId });
    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    return project;
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

function hasField(
  input: UpdateProjectWorkspaceDto,
  field: keyof UpdateProjectWorkspaceDto,
): boolean {
  return Object.prototype.hasOwnProperty.call(input, field);
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

function toWorkspace(project: Project): ProjectWorkspace {
  return {
    id: project.id,
    name: project.name,
    customerContactName: project.customerContactName,
    customerContactEmail: project.customerContactEmail,
    status: project.status,
    ballOwner: project.ballOwner,
    nextAction: project.nextAction,
    dueAt: toIsoOrNull(project.dueAt),
    createdAt: toIso(project.createdAt, 'createdAt'),
    updatedAt: toIso(project.updatedAt, 'updatedAt'),
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
