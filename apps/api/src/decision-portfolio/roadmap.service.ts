import { randomUUID } from 'node:crypto';

import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { BusinessGoal, BusinessRoadmap, Initiative, ProjectWorkspace } from '@project-maker/contracts';
import { DataSource, In, QueryFailedError, type EntityManager } from 'typeorm';

import { currentAuditActorId } from '../audit/audit-actor';
import { AuditEvent } from '../audit/audit-event.entity';
import { Project } from '../projects/project.entity';
import { toWorkspace } from '../projects/projects.service';
import { AssignProjectInitiativeDto } from './dto/assign-project-initiative.dto';
import { SaveRoadmapGroupDto } from './dto/save-roadmap-group.dto';
import { BusinessGoalEntity } from './business-goal.entity';
import { FormalDecisionEntity } from './formal-decision.entity';
import { InitiativeEntity } from './initiative.entity';
import { ProjectStatusUpdateEntity } from './project-status-update.entity';

@Injectable()
export class RoadmapService {
  constructor(private readonly dataSource: DataSource) {}

  async get(includeArchived = false): Promise<BusinessRoadmap> {
    const manager = this.dataSource.manager;
    const [goals, initiatives, projects, statuses, decisions] = await Promise.all([
      manager.getRepository(BusinessGoalEntity).find({ order: { name: 'ASC', id: 'ASC' } }),
      manager.getRepository(InitiativeEntity).find({ order: { name: 'ASC', id: 'ASC' } }),
      manager.getRepository(Project).find({ order: { name: 'ASC', id: 'ASC' } }),
      manager.getRepository(ProjectStatusUpdateEntity).find({ order: { version: 'DESC' } }),
      manager.getRepository(FormalDecisionEntity).find({ order: { version: 'DESC' } }),
    ]);
    const visibleProjects = projects.filter((project) => includeArchived || project.status !== 'ARCHIVED');
    const latestHealth = firstByProject(statuses).map;
    const latestDecision = firstByProject(decisions).map;
    const toProject = (project: Project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      latestHealth: latestHealth.get(project.id)?.health ?? null,
      latestDecision: latestDecision.get(project.id)?.outcome ?? null,
    });
    return {
      goals: goals.map((goal) => ({
        ...toGoal(goal),
        initiatives: initiatives.filter((initiative) => initiative.goalId === goal.id).map((initiative) => ({
          ...toInitiative(initiative),
          projects: visibleProjects.filter((project) => project.initiativeId === initiative.id).map(toProject),
        })),
      })),
      unassignedProjects: visibleProjects.filter((project) => project.initiativeId === null).map(toProject),
    };
  }

  async createGoal(input: SaveRoadmapGroupDto): Promise<BusinessGoal> {
    return this.saveUnique(async () => {
      const actorId = currentAuditActorId();
      const goal = this.dataSource.manager.getRepository(BusinessGoalEntity).create({
        id: randomUUID(),
        name: input.name.trim(),
        description: optional(input.description),
        createdBy: actorId,
        updatedBy: actorId,
      });
      return toGoal(await this.dataSource.manager.getRepository(BusinessGoalEntity).save(goal));
    });
  }

  async updateGoal(goalId: string, input: SaveRoadmapGroupDto): Promise<BusinessGoal> {
    return this.saveUnique(async () => {
      const goal = await this.dataSource.manager.getRepository(BusinessGoalEntity).findOneBy({ id: goalId });
      if (!goal) throw new NotFoundException('Business goal not found.');
      goal.name = input.name.trim();
      goal.description = optional(input.description);
      goal.updatedBy = currentAuditActorId();
      return toGoal(await this.dataSource.manager.getRepository(BusinessGoalEntity).save(goal));
    });
  }

  async deleteGoal(goalId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const goal = await manager.getRepository(BusinessGoalEntity).findOneBy({ id: goalId });
      if (!goal) throw new NotFoundException('Business goal not found.');
      const initiatives = await manager.getRepository(InitiativeEntity).findBy({ goalId });
      if (initiatives.length > 0) {
        await manager.getRepository(Project).update(
          { initiativeId: In(initiatives.map((initiative) => initiative.id)) },
          { initiativeId: null },
        );
      }
      await manager.getRepository(BusinessGoalEntity).remove(goal);
    });
  }

  async createInitiative(goalId: string, input: SaveRoadmapGroupDto): Promise<Initiative> {
    return this.saveUnique(async () => {
      if (!await this.dataSource.manager.getRepository(BusinessGoalEntity).existsBy({ id: goalId })) {
        throw new NotFoundException('Business goal not found.');
      }
      const actorId = currentAuditActorId();
      const initiative = this.dataSource.manager.getRepository(InitiativeEntity).create({
        id: randomUUID(),
        goalId,
        name: input.name.trim(),
        description: optional(input.description),
        createdBy: actorId,
        updatedBy: actorId,
      });
      return toInitiative(await this.dataSource.manager.getRepository(InitiativeEntity).save(initiative));
    });
  }

  async updateInitiative(initiativeId: string, input: SaveRoadmapGroupDto): Promise<Initiative> {
    return this.saveUnique(async () => {
      const initiative = await this.dataSource.manager.getRepository(InitiativeEntity).findOneBy({ id: initiativeId });
      if (!initiative) throw new NotFoundException('Initiative not found.');
      initiative.name = input.name.trim();
      initiative.description = optional(input.description);
      initiative.updatedBy = currentAuditActorId();
      return toInitiative(await this.dataSource.manager.getRepository(InitiativeEntity).save(initiative));
    });
  }

  async deleteInitiative(initiativeId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const initiative = await manager.getRepository(InitiativeEntity).findOneBy({ id: initiativeId });
      if (!initiative) throw new NotFoundException('Initiative not found.');
      await manager.getRepository(Project).update({ initiativeId }, { initiativeId: null });
      await manager.getRepository(InitiativeEntity).remove(initiative);
    });
  }

  async assignProject(
    projectId: string,
    input: AssignProjectInitiativeDto,
  ): Promise<ProjectWorkspace> {
    return this.dataSource.transaction(async (manager) => {
      const project = await manager.getRepository(Project).findOne({
        where: { id: projectId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!project) throw new NotFoundException('Project not found.');
      if (project.status === 'ARCHIVED') throw new ConflictException('Archived Projects cannot change roadmap grouping.');
      if (input.initiativeId && !await manager.getRepository(InitiativeEntity).existsBy({ id: input.initiativeId })) {
        throw new NotFoundException('Initiative not found.');
      }
      project.initiativeId = input.initiativeId ?? null;
      const saved = await manager.getRepository(Project).save(project);
      await manager.getRepository(AuditEvent).save({
        id: randomUUID(),
        projectId,
        eventType: 'PROJECT_INITIATIVE_ASSIGNED',
        payload: { initiativeId: saved.initiativeId ?? '' },
      });
      return toWorkspace(saved);
    });
  }

  private async saveUnique<T>(action: () => Promise<T>): Promise<T> {
    try {
      return await action();
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505') {
        throw new ConflictException('A roadmap group with this name already exists.');
      }
      throw error;
    }
  }
}

function firstByProject<T extends { projectId: string }>(items: readonly T[]): { map: Map<string, T> } {
  const map = new Map<string, T>();
  for (const item of items) if (!map.has(item.projectId)) map.set(item.projectId, item);
  return { map };
}

function toGoal(goal: BusinessGoalEntity): BusinessGoal {
  return { id: goal.id, name: goal.name, description: goal.description, createdAt: goal.createdAt.toISOString(), updatedAt: goal.updatedAt.toISOString() };
}

function toInitiative(initiative: InitiativeEntity): Initiative {
  return { id: initiative.id, goalId: initiative.goalId, name: initiative.name, description: initiative.description, createdAt: initiative.createdAt.toISOString(), updatedAt: initiative.updatedAt.toISOString() };
}

function optional(value: string | null | undefined): string | null {
  return value == null ? null : value.trim() || null;
}
