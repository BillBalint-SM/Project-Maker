import type {
  NextActionOwner,
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
  | ProjectPreparationActionTarget;

export interface ActiveProjectQueueAction {
  readonly target: ActiveProjectQueueActionTarget;
  readonly label: string;
}

export interface ActiveProjectQueueItem {
  readonly projectId: string;
  readonly projectName: string;
  readonly urgency: ActiveProjectUrgency;
  readonly urgencyLabel: string;
  readonly preparationStatus: ProjectPreparationStatus;
  readonly nextAction: string | null;
  readonly nextActionOwner: NextActionOwner;
  readonly dueAt: string | null;
  readonly newReplyCount: number;
  readonly primaryAction: ActiveProjectQueueAction;
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
