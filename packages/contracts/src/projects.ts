export const projectStatuses = [
  'DRAFT',
  'INTAKE_IN_PROGRESS',
  'WAITING_INTERNAL',
  'WAITING_CUSTOMER',
  'READY_FOR_PLANNING',
  'ARCHIVED',
] as const;

export type ProjectStatus = (typeof projectStatuses)[number];

export const administrativeProjectPhaseOptions = [
  { label: 'Előkészítés alatt', value: 'DRAFT' },
  { label: 'Felmérési szakasz', value: 'INTAKE_IN_PROGRESS' },
  { label: 'Belső egyeztetésre vár', value: 'WAITING_INTERNAL' },
  { label: 'Ügyfél-visszajelzésre vár', value: 'WAITING_CUSTOMER' },
  { label: 'Tervezésre átadva', value: 'READY_FOR_PLANNING' },
] as const satisfies readonly {
  readonly label: string;
  readonly value: Exclude<ProjectStatus, 'ARCHIVED'>;
}[];

export function projectStatusLabel(status: ProjectStatus): string {
  if (status === 'ARCHIVED') return 'Archivált';
  return administrativeProjectPhaseOptions.find((option) => option.value === status)?.label ?? status;
}

export const nextActionOwnerRoles = ['INTERNAL_OWNER', 'CUSTOMER_CONTACT'] as const;

export type NextActionOwnerRole = (typeof nextActionOwnerRoles)[number];

export interface NextActionOwner {
  readonly role: NextActionOwnerRole | null;
  readonly displayName: string | null;
  readonly complete: boolean;
}

export interface CreateProjectInput {
  readonly creationRequestId?: string;
  readonly name: string;
  readonly customerContactName: string;
  readonly customerContactEmail: string;
  readonly internalOwnerName: string;
  readonly nextActionOwnerRole?: NextActionOwnerRole | null;
  readonly nextAction?: string | null;
  readonly dueAt?: string | null;
  readonly playbookId?: string;
  readonly playbookVersion?: number;
}

export interface ProjectPlaybookSelection {
  readonly id: string;
  readonly version: number;
  readonly name: string;
}

export interface UpdateProjectPlaybookInput {
  readonly playbookId: string;
  readonly playbookVersion: number;
}

export interface UpdateProjectBasicsInput {
  readonly name: string;
  readonly customerContactName: string;
  readonly customerContactEmail: string;
  readonly internalOwnerName: string;
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
  readonly playbook: ProjectPlaybookSelection;
  readonly initiativeId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}
