import type {
  NextActionOwnerRole,
  ProjectPreparationStatus,
  ProjectWorkspace,
} from '@project-maker/contracts';

export interface UpdateProjectWorkspaceInput {
  readonly internalOwnerName?: string | null;
  readonly nextActionOwnerRole?: NextActionOwnerRole | null;
  readonly nextAction?: string | null;
  readonly dueAt?: string | null;
  readonly status?: Exclude<ProjectWorkspace['status'], 'ARCHIVED'>;
}

export interface ProjectSettingsView {
  readonly project: ProjectWorkspace;
  readonly preparationStatus: ProjectPreparationStatus;
}

export interface StatusOption {
  readonly label: string;
  readonly value: Exclude<ProjectWorkspace['status'], 'ARCHIVED'>;
}
