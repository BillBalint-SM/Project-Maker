export const projectPreparationStates = [
  'SCHEMA_REQUIRED',
  'INTAKE_IN_PROGRESS',
  'CLARIFICATION_REQUIRED',
  'DECISION_REVIEW_REQUIRED',
  'ESTIMATE_PREPARABLE',
  'ESTIMATE_READY',
] as const;

export type ProjectPreparationState = (typeof projectPreparationStates)[number];

export const projectPreparationActionTargets = [
  'INTERVIEW',
  'READINESS',
  'DECISION_REVIEW',
] as const;

export type ProjectPreparationActionTarget =
  (typeof projectPreparationActionTargets)[number];

export interface ProjectPreparationAction {
  readonly label: string;
  readonly target: ProjectPreparationActionTarget;
}

export interface ProjectPreparationStatus {
  readonly projectId: string;
  readonly state: ProjectPreparationState;
  readonly label: string;
  readonly primaryAction: ProjectPreparationAction;
}
