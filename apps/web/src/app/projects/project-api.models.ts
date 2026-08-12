import type {
  AuditEventPage,
  AuditEventRecord,
  CustomerFollowUpState,
  ProjectCockpit,
  ProjectStatus,
  ProjectWorkspace,
} from '@project-maker/contracts';

export type {
  AuditEventPage,
} from '@project-maker/contracts';

export interface UpdateProjectWorkspaceInput {
  readonly status: Exclude<ProjectStatus, 'ARCHIVED'>;
  readonly ballOwner: string | null;
  readonly nextAction: string | null;
  readonly dueAt: string | null;
}

export interface CockpitView {
  readonly project: ProjectWorkspace;
  readonly cockpit: ProjectCockpit;
  readonly followUp: CustomerFollowUpState;
}

export interface StatusOption {
  readonly label: string;
  readonly value: Exclude<ProjectStatus, 'ARCHIVED'>;
}
