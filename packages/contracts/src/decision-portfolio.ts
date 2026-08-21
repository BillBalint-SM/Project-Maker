import type { ProjectWorkState } from './active-project-queue.js';
import type { ProjectPreparationState } from './project-preparation-status.js';
import type { ProjectStatus, ProjectWorkspace } from './projects.js';

export const formalDecisionOutcomes = ['GO', 'CONDITIONAL_GO', 'NO_GO'] as const;
export type FormalDecisionOutcome = (typeof formalDecisionOutcomes)[number];

export interface CreateFormalDecisionInput {
  readonly outcome: FormalDecisionOutcome;
  readonly decisionDate: string;
  readonly decisionMaker: string;
  readonly rationale: string;
  readonly conditions?: string | null;
  readonly reviewDate?: string | null;
  readonly referenceDecisionReview?: boolean;
  readonly insightIds?: readonly string[];
  readonly specificationRevisionId?: string | null;
}

export interface FormalDecision extends CreateFormalDecisionInput {
  readonly id: string;
  readonly projectId: string;
  readonly version: number;
  readonly actorId: string;
  readonly conditions: string | null;
  readonly reviewDate: string | null;
  readonly referenceDecisionReview: boolean;
  readonly insightIds: readonly string[];
  readonly specificationRevisionId: string | null;
  readonly createdAt: string;
}

export const projectHealthValues = ['ON_TRACK', 'AT_RISK', 'BLOCKED'] as const;
export type ProjectHealth = (typeof projectHealthValues)[number];

export interface SaveProjectStatusUpdateInput {
  readonly health: ProjectHealth;
  readonly summary: string;
  readonly changes?: string | null;
  readonly risks?: string | null;
  readonly nextStep: string;
}

export interface ProjectStatusUpdate extends SaveProjectStatusUpdateInput {
  readonly id: string;
  readonly projectId: string;
  readonly version: number;
  readonly changes: string | null;
  readonly risks: string | null;
  readonly actorId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly editable: boolean;
}

export interface BusinessGoal {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface Initiative {
  readonly id: string;
  readonly goalId: string;
  readonly name: string;
  readonly description: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SaveRoadmapGroupInput {
  readonly name: string;
  readonly description?: string | null;
}

export interface AssignProjectInitiativeInput {
  readonly initiativeId: string | null;
}

export interface RoadmapProject {
  readonly id: string;
  readonly name: string;
  readonly status: ProjectStatus;
  readonly latestHealth: ProjectHealth | null;
  readonly latestDecision: FormalDecisionOutcome | null;
}

export interface RoadmapInitiative extends Initiative {
  readonly projects: readonly RoadmapProject[];
}

export interface RoadmapGoal extends BusinessGoal {
  readonly initiatives: readonly RoadmapInitiative[];
}

export interface BusinessRoadmap {
  readonly goals: readonly RoadmapGoal[];
  readonly unassignedProjects: readonly RoadmapProject[];
}

export const portfolioSorts = [
  'RECENTLY_UPDATED',
  'NAME',
  'DUE_DATE',
  'READINESS_DESC',
  'DECISION_SCORE_DESC',
] as const;
export type PortfolioSort = (typeof portfolioSorts)[number];

export const portfolioArchiveScopes = ['ACTIVE', 'ARCHIVED', 'ALL'] as const;
export type PortfolioArchiveScope = (typeof portfolioArchiveScopes)[number];

export interface PortfolioQuery {
  readonly search?: string;
  readonly internalOwner?: string;
  readonly statuses?: readonly ProjectStatus[];
  readonly preparationStates?: readonly ProjectPreparationState[];
  readonly readinessBucket?: 'CLARIFICATION' | 'PREPARABLE' | 'READY';
  readonly decisionScoreBucket?: 'LOW' | 'MEDIUM' | 'HIGH';
  readonly due?: 'OVERDUE' | 'DUE_SOON' | 'NONE';
  readonly decision?: FormalDecisionOutcome;
  readonly health?: ProjectHealth;
  readonly goalId?: string;
  readonly initiativeId?: string;
  readonly archiveScope?: PortfolioArchiveScope;
  readonly sort?: PortfolioSort;
  readonly page?: number;
  readonly pageSize?: number;
}

export interface PortfolioRow {
  readonly project: ProjectWorkspace;
  readonly workState: ProjectWorkState | null;
  readonly readinessPercentage: number | null;
  readonly decisionScore: number | null;
  readonly latestDecision: FormalDecision | null;
  readonly latestStatus: ProjectStatusUpdate | null;
  readonly goal: BusinessGoal | null;
  readonly initiative: Initiative | null;
}

export interface PortfolioPage {
  readonly items: readonly PortfolioRow[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
  readonly pageCount: number;
}
