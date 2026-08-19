import type {
  NextActionOwner,
  ProjectWorkspace,
} from './projects.js';
import type {
  ProjectPreparationActionTarget,
  ProjectPreparationStatus,
} from './project-preparation-status.js';

export const activeProjectUrgencies = [
  'CUSTOMER_REPLY',
  'OVERDUE',
  'DUE_SOON',
  'IN_PROGRESS',
] as const;

export type ActiveProjectUrgency = (typeof activeProjectUrgencies)[number];

export type ActiveProjectQueueActionTarget =
  | 'CUSTOMER_CORRESPONDENCE'
  | 'PROJECT_COORDINATION'
  | ProjectPreparationActionTarget;

export interface ActiveProjectQueueAction {
  readonly target: ActiveProjectQueueActionTarget;
  readonly label: string;
}

export interface InterviewAnswerProgress {
  readonly kind: 'INTERVIEW_ANSWERS';
  readonly answeredQuestions: number;
  readonly totalQuestions: number;
}

export interface DecisionInputProgress {
  readonly kind: 'DECISION_INPUTS';
  readonly completedInputs: number;
  readonly totalInputs: number;
}

export type ProjectWorkProgress = InterviewAnswerProgress | DecisionInputProgress;

export interface ProjectWorkState {
  readonly projectId: string;
  readonly projectName: string;
  readonly urgency: ActiveProjectUrgency;
  readonly urgencyLabel: string;
  readonly preparationStatus: ProjectPreparationStatus;
  readonly nextAction: string | null;
  readonly nextActionOwner: NextActionOwner;
  readonly dueAt: string | null;
  readonly newReplyCount: number;
  readonly progress?: ProjectWorkProgress;
  readonly primaryAction: ActiveProjectQueueAction;
}

export type ActiveProjectQueueItem = ProjectWorkState;

export interface ProjectPortfolioEntry {
  readonly project: ProjectWorkspace;
  readonly workState: ProjectWorkState | null;
}

export type ActiveProjectQueueGroupCounts = Readonly<Record<ActiveProjectUrgency, number>>;

export interface ActiveProjectQueueQuery {
  readonly search?: string;
  readonly urgencies?: readonly ActiveProjectUrgency[];
  readonly preparationStates?: readonly ProjectPreparationStatus['state'][];
  readonly cursor?: string;
}

export const activeProjectQueueCursorErrorCodes = [
  'MALFORMED_CURSOR',
  'MISMATCHED_CURSOR',
  'OBSOLETE_CURSOR',
] as const;

export type ActiveProjectQueueCursorErrorCode =
  (typeof activeProjectQueueCursorErrorCodes)[number];

export interface ActiveProjectQueuePage {
  readonly items: readonly ActiveProjectQueueItem[];
  readonly totalCount: number;
  readonly groupCounts: ActiveProjectQueueGroupCounts;
  readonly retrievedAt: string;
  readonly previousCursor: string | null;
  readonly nextCursor: string | null;
}
