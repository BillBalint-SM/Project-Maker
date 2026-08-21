import { Injectable } from '@nestjs/common';
import type {
  FormalDecision,
  PortfolioPage,
  PortfolioQuery,
  PortfolioRow,
  ProjectStatusUpdate,
} from '@project-maker/contracts';
import { DataSource, In } from 'typeorm';

import { DecisionReviewService } from '../decision-review/decision-review.service';
import { findCurrentInitialIntakeSources } from '../interviews/current-initial-intake-source';
import { ActiveProjectQueueService } from '../projects/active-project-queue.service';
import { Project } from '../projects/project.entity';
import { BusinessGoalEntity } from './business-goal.entity';
import { FormalDecisionEntity } from './formal-decision.entity';
import { InitiativeEntity } from './initiative.entity';
import { ProjectStatusUpdateEntity } from './project-status-update.entity';

@Injectable()
export class PortfolioService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly activeQueue: ActiveProjectQueueService,
    private readonly decisionReview: DecisionReviewService,
  ) {}

  async getPage(query: PortfolioQuery): Promise<PortfolioPage> {
    const [entries, projects, statuses, decisions, initiatives, goals] = await Promise.all([
      this.activeQueue.getPortfolio(),
      this.dataSource.manager.getRepository(Project).find(),
      this.dataSource.manager.getRepository(ProjectStatusUpdateEntity).find({ order: { version: 'DESC' } }),
      this.dataSource.manager.getRepository(FormalDecisionEntity).find({ order: { version: 'DESC' } }),
      this.dataSource.manager.getRepository(InitiativeEntity).find(),
      this.dataSource.manager.getRepository(BusinessGoalEntity).find(),
    ]);
    const projectIds = projects.map((project) => project.id);
    const sourceRounds = await findCurrentInitialIntakeSources(this.dataSource.manager, projectIds);
    const reviews = await this.decisionReview.getReviewsForProjectsWithManager(
      this.dataSource.manager,
      projects,
      sourceRounds,
    );
    const entityById = new Map(projects.map((project) => [project.id, project]));
    const workById = new Map(entries.map((entry) => [entry.project.id, entry.workState]));
    const latestStatus = firstByProject(statuses);
    const latestDecision = firstByProject(decisions);
    const initiativeById = new Map(initiatives.map((initiative) => [initiative.id, initiative]));
    const goalById = new Map(goals.map((goal) => [goal.id, goal]));

    let rows = entries.map((entry): PortfolioRow => {
      const project = entityById.get(entry.project.id)!;
      const review = reviews.get(project.id);
      const initiative = project.initiativeId ? initiativeById.get(project.initiativeId) ?? null : null;
      const goal = initiative ? goalById.get(initiative.goalId) ?? null : null;
      const status = latestStatus.get(project.id) ?? null;
      const decision = latestDecision.get(project.id) ?? null;
      return {
        project: entry.project,
        workState: workById.get(project.id) ?? null,
        readinessPercentage: review?.available ? review.readinessPercentage : null,
        decisionScore: review?.available ? review.decisionScore : null,
        latestDecision: decision ? toDecision(decision) : null,
        latestStatus: status ? toStatus(status, project.status !== 'ARCHIVED') : null,
        goal: goal ? toGoal(goal) : null,
        initiative: initiative ? toInitiative(initiative) : null,
      };
    });

    rows = rows.filter((row) => matches(row, query));
    rows.sort(comparator(query.sort ?? 'RECENTLY_UPDATED'));
    const totalCount = rows.length;
    const pageSize = Math.max(1, Math.min(query.pageSize ?? 20, 50));
    const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
    const page = Math.max(1, Math.min(query.page ?? 1, pageCount));
    const offset = (page - 1) * pageSize;
    return { items: rows.slice(offset, offset + pageSize), totalCount, page, pageSize, pageCount };
  }
}

function matches(row: PortfolioRow, query: PortfolioQuery): boolean {
  const archived = row.project.status === 'ARCHIVED';
  const scope = query.archiveScope ?? 'ACTIVE';
  if ((scope === 'ACTIVE' && archived) || (scope === 'ARCHIVED' && !archived)) return false;
  const search = normalize(query.search ?? '');
  if (search && !normalize([
    row.project.name,
    row.project.customerContactName,
    row.project.customerContactEmail,
  ].join(' ')).includes(search)) return false;
  if (query.internalOwner && !normalize(row.project.internalOwnerName ?? '').includes(normalize(query.internalOwner))) return false;
  if (query.statuses?.length && !query.statuses.includes(row.project.status)) return false;
  if (query.preparationStates?.length && (!row.workState || !query.preparationStates.includes(row.workState.preparationStatus.state))) return false;
  if (query.health && row.latestStatus?.health !== query.health) return false;
  if (query.decision && row.latestDecision?.outcome !== query.decision) return false;
  if (query.goalId && row.goal?.id !== query.goalId) return false;
  if (query.initiativeId && row.initiative?.id !== query.initiativeId) return false;
  if (query.readinessBucket && readinessBucket(row.readinessPercentage) !== query.readinessBucket) return false;
  if (query.decisionScoreBucket && scoreBucket(row.decisionScore) !== query.decisionScoreBucket) return false;
  if (query.due && dueBucket(row.project.dueAt) !== query.due) return false;
  return true;
}

function comparator(sort: NonNullable<PortfolioQuery['sort']>): (left: PortfolioRow, right: PortfolioRow) => number {
  return (left, right) => {
    if (sort === 'NAME') return left.project.name.localeCompare(right.project.name, 'hu') || left.project.id.localeCompare(right.project.id);
    if (sort === 'DUE_DATE') return compareNullable(left.project.dueAt, right.project.dueAt) || left.project.id.localeCompare(right.project.id);
    if (sort === 'READINESS_DESC') return compareNumberDesc(left.readinessPercentage, right.readinessPercentage) || left.project.id.localeCompare(right.project.id);
    if (sort === 'DECISION_SCORE_DESC') return compareNumberDesc(left.decisionScore, right.decisionScore) || left.project.id.localeCompare(right.project.id);
    return right.project.updatedAt.localeCompare(left.project.updatedAt) || left.project.id.localeCompare(right.project.id);
  };
}

function readinessBucket(value: number | null): PortfolioQuery['readinessBucket'] | null {
  if (value === null || value < 60) return value === null ? null : 'CLARIFICATION';
  return value >= 80 ? 'READY' : 'PREPARABLE';
}

function scoreBucket(value: number | null): PortfolioQuery['decisionScoreBucket'] | null {
  if (value === null) return null;
  if (value >= 75) return 'HIGH';
  return value >= 50 ? 'MEDIUM' : 'LOW';
}

function dueBucket(value: string | null): PortfolioQuery['due'] {
  if (!value) return 'NONE';
  const due = new Date(value).getTime();
  const now = Date.now();
  return due < now ? 'OVERDUE' : due <= now + 7 * 24 * 60 * 60 * 1000 ? 'DUE_SOON' : 'NONE';
}

function compareNullable(left: string | null, right: string | null): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return left.localeCompare(right);
}

function compareNumberDesc(left: number | null, right: number | null): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return right - left;
}

function firstByProject<T extends { projectId: string }>(items: readonly T[]): Map<string, T> {
  const result = new Map<string, T>();
  for (const item of items) if (!result.has(item.projectId)) result.set(item.projectId, item);
  return result;
}

function toDecision(entity: FormalDecisionEntity): FormalDecision {
  return {
    id: entity.id, projectId: entity.projectId, version: entity.version, outcome: entity.outcome,
    decisionDate: entity.decisionDate, decisionMaker: entity.decisionMaker, rationale: entity.rationale,
    conditions: entity.conditions, reviewDate: entity.reviewDate,
    referenceDecisionReview: entity.referenceDecisionReview, insightIds: entity.insightIds,
    specificationRevisionId: entity.specificationRevisionId, actorId: entity.actorId,
    createdAt: entity.createdAt.toISOString(),
  };
}

function toStatus(entity: ProjectStatusUpdateEntity, editable: boolean): ProjectStatusUpdate {
  return {
    id: entity.id, projectId: entity.projectId, version: entity.version, health: entity.health,
    summary: entity.summary, changes: entity.changes, risks: entity.risks, nextStep: entity.nextStep,
    actorId: entity.actorId, createdAt: entity.createdAt.toISOString(), updatedAt: entity.updatedAt.toISOString(), editable,
  };
}

function toGoal(entity: BusinessGoalEntity) {
  return { id: entity.id, name: entity.name, description: entity.description, createdAt: entity.createdAt.toISOString(), updatedAt: entity.updatedAt.toISOString() };
}

function toInitiative(entity: InitiativeEntity) {
  return { id: entity.id, goalId: entity.goalId, name: entity.name, description: entity.description, createdAt: entity.createdAt.toISOString(), updatedAt: entity.updatedAt.toISOString() };
}

function normalize(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('hu-HU').trim();
}
