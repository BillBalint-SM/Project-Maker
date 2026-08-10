export interface AvailableProjectReadiness {
  readonly available: true;
  readonly projectId: string;
  readonly sourceRoundId: string;
  readonly sourceRoundStatus: string;
  readonly completionPercentage: number;
  readonly completionLabel: string;
  readonly readinessPercentage: number;
  readonly readinessBand: string;
  readonly factors: readonly ReadinessFactor[];
  readonly gaps: readonly ReadinessGap[];
}

export interface UnavailableProjectReadiness {
  readonly available: false;
  readonly projectId: string;
  readonly reason: 'NO_INITIAL_INTAKE' | 'UNSUPPORTED_SCHEMA';
}

export type ProjectReadiness =
  | AvailableProjectReadiness
  | UnavailableProjectReadiness;

export interface ReadinessFactor {
  readonly id: string;
  readonly weight: number;
  readonly percentage: number;
  readonly label: string;
  readonly helpText: string;
}

export type ReadinessGapTarget = 'overview' | 'checklist' | 'follow-ups';

export interface ReadinessGap {
  readonly id: string;
  readonly severity: string;
  readonly category: string;
  readonly message: string;
  readonly nextStep: string;
  readonly target: ReadinessGapTarget;
  readonly snapshotId: string | null;
  readonly followUpId: string | null;
}
