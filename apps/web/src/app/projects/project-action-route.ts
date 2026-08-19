import type { ActiveProjectQueueActionTarget } from '@project-maker/contracts';

export function projectActionRoute(
  projectId: string,
  target: ActiveProjectQueueActionTarget,
): readonly string[] {
  switch (target) {
    case 'CUSTOMER_CORRESPONDENCE':
      return ['/projects', projectId, 'customer-correspondences'];
    case 'PROJECT_COORDINATION':
      return ['/projects', projectId];
    case 'INTERVIEW':
      return ['/projects', projectId, 'interview'];
    case 'READINESS':
      return ['/projects', projectId, 'readiness'];
    case 'DECISION_REVIEW':
      return ['/projects', projectId, 'decision-review'];
  }
}

export function projectActionFragment(
  target: ActiveProjectQueueActionTarget,
): string | undefined {
  return target === 'PROJECT_COORDINATION' ? 'workspace' : undefined;
}
