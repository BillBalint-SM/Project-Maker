import { randomUUID } from 'node:crypto';

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { FormalDecision, ProjectStatusUpdate } from '@project-maker/contracts';
import { DataSource, In, type EntityManager } from 'typeorm';

import { currentAuditActorId } from '../audit/audit-actor';
import { AuditEvent } from '../audit/audit-event.entity';
import { InsightEntity } from '../discovery/insight.entity';
import { MarkdownRevisionEntity } from '../markdown/markdown-revision.entity';
import { Project } from '../projects/project.entity';
import { CreateFormalDecisionDto } from './dto/create-formal-decision.dto';
import { SaveProjectStatusUpdateDto } from './dto/save-project-status-update.dto';
import { FormalDecisionEntity } from './formal-decision.entity';
import { ProjectStatusUpdateEntity } from './project-status-update.entity';

@Injectable()
export class DecisionStatusService {
  constructor(private readonly dataSource: DataSource) {}

  async listDecisions(projectId: string): Promise<readonly FormalDecision[]> {
    await requireProject(this.dataSource.manager, projectId, false);
    return (await this.dataSource.manager.getRepository(FormalDecisionEntity).find({
      where: { projectId },
      order: { version: 'DESC' },
    })).map(toDecision);
  }

  async createDecision(projectId: string, input: CreateFormalDecisionDto): Promise<FormalDecision> {
    return this.dataSource.transaction(async (manager) => {
      await requireProject(manager, projectId, true);
      const normalized = normalizeDecision(input);
      const insightIds = [...new Set(input.insightIds ?? [])];
      if (insightIds.length > 0) {
        const count = await manager.getRepository(InsightEntity).countBy({ id: In(insightIds), projectId });
        if (count !== insightIds.length) throw new BadRequestException('Decision Insights must belong to the Project.');
      }
      if (input.specificationRevisionId) {
        const revision = await manager.getRepository(MarkdownRevisionEntity).findOneBy({
          id: input.specificationRevisionId,
          projectId,
        });
        if (!revision) throw new BadRequestException('Decision Specification must belong to the Project.');
      }
      const latest = await manager.getRepository(FormalDecisionEntity).findOne({
        where: { projectId },
        order: { version: 'DESC' },
      });
      const decision = manager.getRepository(FormalDecisionEntity).create({
        id: randomUUID(),
        projectId,
        version: (latest?.version ?? 0) + 1,
        ...normalized,
        referenceDecisionReview: input.referenceDecisionReview ?? false,
        insightIds,
        specificationRevisionId: input.specificationRevisionId ?? null,
        actorId: currentAuditActorId(),
      });
      const saved = await manager.getRepository(FormalDecisionEntity).save(decision);
      await audit(manager, projectId, 'FORMAL_DECISION_RECORDED', {
        decisionId: saved.id,
        version: String(saved.version),
        outcome: saved.outcome,
      });
      return toDecision(saved);
    });
  }

  async listStatusUpdates(projectId: string): Promise<readonly ProjectStatusUpdate[]> {
    await requireProject(this.dataSource.manager, projectId, false);
    const updates = await this.dataSource.manager.getRepository(ProjectStatusUpdateEntity).find({
      where: { projectId },
      order: { version: 'DESC' },
    });
    return updates.map((update, index) => toStatusUpdate(update, index === 0));
  }

  async createStatusUpdate(
    projectId: string,
    input: SaveProjectStatusUpdateDto,
  ): Promise<ProjectStatusUpdate> {
    return this.dataSource.transaction(async (manager) => {
      await requireProject(manager, projectId, true);
      const latest = await manager.getRepository(ProjectStatusUpdateEntity).findOne({
        where: { projectId },
        order: { version: 'DESC' },
      });
      const update = manager.getRepository(ProjectStatusUpdateEntity).create({
        id: randomUUID(),
        projectId,
        version: (latest?.version ?? 0) + 1,
        ...normalizeStatus(input),
        actorId: currentAuditActorId(),
      });
      const saved = await manager.getRepository(ProjectStatusUpdateEntity).save(update);
      await audit(manager, projectId, 'PROJECT_STATUS_UPDATE_PUBLISHED', {
        statusUpdateId: saved.id,
        version: String(saved.version),
        health: saved.health,
      });
      return toStatusUpdate(saved, true);
    });
  }

  async updateLatestStatus(
    projectId: string,
    statusUpdateId: string,
    input: SaveProjectStatusUpdateDto,
  ): Promise<ProjectStatusUpdate> {
    return this.dataSource.transaction(async (manager) => {
      await requireProject(manager, projectId, true);
      const latest = await manager.getRepository(ProjectStatusUpdateEntity).findOne({
        where: { projectId },
        order: { version: 'DESC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!latest || latest.id !== statusUpdateId) {
        throw new ConflictException('Only the latest Project status update can be edited.');
      }
      Object.assign(latest, normalizeStatus(input));
      const saved = await manager.getRepository(ProjectStatusUpdateEntity).save(latest);
      await audit(manager, projectId, 'PROJECT_STATUS_UPDATE_EDITED', {
        statusUpdateId: saved.id,
        version: String(saved.version),
        health: saved.health,
      });
      return toStatusUpdate(saved, true);
    });
  }
}

function normalizeDecision(input: CreateFormalDecisionDto): Pick<FormalDecisionEntity,
  'outcome' | 'decisionDate' | 'decisionMaker' | 'rationale' | 'conditions' | 'reviewDate'> {
  requireRealDate(input.decisionDate, 'decisionDate');
  if (input.outcome === 'CONDITIONAL_GO') {
    if (!input.conditions || !input.reviewDate) {
      throw new BadRequestException('Conditional Go requires conditions and reviewDate.');
    }
    requireRealDate(input.reviewDate, 'reviewDate');
    return {
      outcome: input.outcome,
      decisionDate: input.decisionDate,
      decisionMaker: required(input.decisionMaker),
      rationale: required(input.rationale),
      conditions: required(input.conditions),
      reviewDate: input.reviewDate,
    };
  }
  if (input.conditions != null || input.reviewDate != null) {
    throw new BadRequestException('Only Conditional Go may include conditions or a review date.');
  }
  return {
    outcome: input.outcome,
    decisionDate: input.decisionDate,
    decisionMaker: required(input.decisionMaker),
    rationale: required(input.rationale),
    conditions: null,
    reviewDate: null,
  };
}

function normalizeStatus(input: SaveProjectStatusUpdateDto): Pick<ProjectStatusUpdateEntity,
  'health' | 'summary' | 'changes' | 'risks' | 'nextStep'> {
  return {
    health: input.health,
    summary: required(input.summary),
    changes: optional(input.changes),
    risks: optional(input.risks),
    nextStep: required(input.nextStep),
  };
}

async function requireProject(manager: EntityManager, projectId: string, mutable: boolean): Promise<Project> {
  const project = await manager.getRepository(Project).findOne({
    where: { id: projectId },
    lock: mutable ? { mode: 'pessimistic_write' } : undefined,
  });
  if (!project) throw new NotFoundException('Project not found.');
  if (mutable && project.status === 'ARCHIVED') {
    throw new ConflictException('Archived projects cannot change decisions or status updates.');
  }
  return project;
}

function toDecision(entity: FormalDecisionEntity): FormalDecision {
  return {
    id: entity.id,
    projectId: entity.projectId,
    version: entity.version,
    outcome: entity.outcome,
    decisionDate: entity.decisionDate,
    decisionMaker: entity.decisionMaker,
    rationale: entity.rationale,
    conditions: entity.conditions,
    reviewDate: entity.reviewDate,
    referenceDecisionReview: entity.referenceDecisionReview,
    insightIds: entity.insightIds,
    specificationRevisionId: entity.specificationRevisionId,
    actorId: entity.actorId,
    createdAt: entity.createdAt.toISOString(),
  };
}

function toStatusUpdate(entity: ProjectStatusUpdateEntity, editable: boolean): ProjectStatusUpdate {
  return {
    id: entity.id,
    projectId: entity.projectId,
    version: entity.version,
    health: entity.health,
    summary: entity.summary,
    changes: entity.changes,
    risks: entity.risks,
    nextStep: entity.nextStep,
    actorId: entity.actorId,
    createdAt: entity.createdAt.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
    editable,
  };
}

function required(value: string): string {
  const result = value.trim();
  if (!result) throw new BadRequestException('Required text must not be blank.');
  return result;
}

function optional(value: string | null | undefined): string | null {
  return value == null ? null : value.trim() || null;
}

function requireRealDate(value: string, field: string): void {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new BadRequestException(`${field} must be a real date.`);
  }
}

async function audit(manager: EntityManager, projectId: string, eventType: string, payload: Readonly<Record<string, string>>): Promise<void> {
  await manager.getRepository(AuditEvent).save({ id: randomUUID(), projectId, eventType, payload });
}
