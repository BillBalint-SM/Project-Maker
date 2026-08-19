import { administrativeProjectPhaseOptions } from '@project-maker/contracts';

import type { StatusOption } from './project-api.models';

export const activeProjectStatusOptions: StatusOption[] = [...administrativeProjectPhaseOptions];

export { projectStatusLabel } from '@project-maker/contracts';
