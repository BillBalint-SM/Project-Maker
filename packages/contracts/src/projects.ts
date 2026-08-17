export const projectStatuses = [
  'DRAFT',
  'INTAKE_IN_PROGRESS',
  'WAITING_INTERNAL',
  'WAITING_CUSTOMER',
  'READY_FOR_PLANNING',
  'ARCHIVED',
] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

export const nextActionOwnerRoles = ['INTERNAL_OWNER', 'CUSTOMER_CONTACT'] as const;

export type NextActionOwnerRole = (typeof nextActionOwnerRoles)[number];

export interface NextActionOwner {
  readonly role: NextActionOwnerRole | null;
  readonly displayName: string | null;
  readonly complete: boolean;
}

export interface CreateProjectInput {
  readonly name: string;
  readonly customerContactName: string;
  readonly customerContactEmail: string;
  readonly internalOwnerName: string;
  readonly nextActionOwnerRole?: NextActionOwnerRole | null;
  readonly nextAction?: string | null;
  readonly dueAt?: string | null;
}

export interface ProjectWorkspace {
  readonly id: string;
  readonly name: string;
  readonly customerContactName: string;
  readonly customerContactEmail: string;
  readonly status: ProjectStatus;
  readonly internalOwnerName: string | null;
  readonly nextActionOwnerRole: NextActionOwnerRole | null;
  readonly nextActionOwner: NextActionOwner;
  readonly nextAction: string | null;
  readonly dueAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ProjectCockpit {
  readonly projectId: string;
  readonly status: ProjectStatus;
  readonly internalOwnerName: string | null;
  readonly nextActionOwnerRole: NextActionOwnerRole | null;
  readonly nextActionOwner: NextActionOwner;
  readonly nextAction: string | null;
  readonly dueAt: string | null;
}
