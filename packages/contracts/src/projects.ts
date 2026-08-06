export const projectStatuses = [
  'DRAFT',
  'INTAKE_IN_PROGRESS',
  'WAITING_INTERNAL',
  'WAITING_CUSTOMER',
  'READY_FOR_PLANNING',
  'ARCHIVED',
] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

export interface CreateProjectInput {
  readonly name: string;
  readonly customerContactName: string;
  readonly customerContactEmail: string;
  readonly ballOwner?: string | null;
  readonly nextAction?: string | null;
  readonly dueAt?: string | null;
}

export interface ProjectWorkspace {
  readonly id: string;
  readonly name: string;
  readonly customerContactName: string;
  readonly customerContactEmail: string;
  readonly status: ProjectStatus;
  readonly ballOwner: string | null;
  readonly nextAction: string | null;
  readonly dueAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectCockpit {
  readonly projectId: string;
  readonly status: ProjectStatus;
  readonly ballOwner: string | null;
  readonly nextAction: string | null;
  readonly dueAt: string | null;
}
