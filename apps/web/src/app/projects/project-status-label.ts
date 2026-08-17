import type { ProjectStatus } from '@project-maker/contracts';

import type { StatusOption } from './project-api.models';

export const activeProjectStatusOptions: StatusOption[] = [
  { label: 'Előkészítés alatt', value: 'DRAFT' },
  { label: 'Interjú folyamatban', value: 'INTAKE_IN_PROGRESS' },
  { label: 'Belső feladatra vár', value: 'WAITING_INTERNAL' },
  { label: 'Ügyfélre vár', value: 'WAITING_CUSTOMER' },
  { label: 'Becslésre kész', value: 'READY_FOR_PLANNING' },
];

export function projectStatusLabel(status: ProjectStatus): string {
  if (status === 'ARCHIVED') return 'Archivált';
  return activeProjectStatusOptions.find((option) => option.value === status)?.label ?? status;
}
