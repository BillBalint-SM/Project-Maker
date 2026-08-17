import type {
  AuditEventPage,
  AuditEventRecord,
  NextActionOwnerRole,
  ProjectCockpit,
  ProjectPreparationStatus,
  ProjectStatus,
  ProjectWorkspace,
} from '@project-maker/contracts';

export type {
  AuditEventPage,
} from '@project-maker/contracts';

export interface UpdateProjectWorkspaceInput {
  readonly status: Exclude<ProjectStatus, 'ARCHIVED'>;
  readonly internalOwnerName: string | null;
  readonly nextActionOwnerRole: NextActionOwnerRole | null;
  readonly nextAction: string | null;
  readonly dueAt: string | null;
}

export interface CockpitView {
  readonly project: ProjectWorkspace;
  readonly cockpit: ProjectCockpit;
  readonly preparationStatus: ProjectPreparationStatus;
}

export interface StatusOption {
  readonly label: string;
  readonly value: Exclude<ProjectStatus, 'ARCHIVED'>;
}
