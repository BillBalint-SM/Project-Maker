import type { GeneralPlaybook } from '@project-maker/contracts';

export interface ReadinessCalculatorInput {
  readonly project: ReadinessProjectInput;
  readonly sourceRound: ReadinessSourceRoundInput;
  readonly snapshots: readonly ReadinessSnapshotInput[];
  readonly followUps: readonly ReadinessFollowUpInput[];
  readonly policy: GeneralPlaybook;
}

export interface ReadinessProjectInput {
  readonly id: string;
  readonly name: string | null;
  readonly customerContactName: string | null;
  readonly customerContactEmail: string | null;
  readonly ballOwner: string | null;
}

export interface ReadinessSourceRoundInput {
  readonly id: string;
  readonly status: string;
}

export interface ReadinessSnapshotInput {
  readonly id: string;
  readonly stableKey: string;
  readonly required: boolean;
  readonly blocking: boolean;
  readonly order: number;
  readonly checklistStatus: string;
}

export interface ReadinessFollowUpInput {
  readonly id: string;
  readonly status: string;
  readonly dueDate: string;
  readonly createdAt: string;
}
