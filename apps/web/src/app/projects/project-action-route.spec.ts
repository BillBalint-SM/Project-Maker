import { describe, expect, it } from 'vitest';

import { projectActionFragment, projectActionRoute } from './project-action-route';

describe('Project work action navigation', () => {
  it('opens the editable coordination task on Project status', () => {
    const projectId = '11111111-1111-4111-8111-111111111111';

    expect(projectActionRoute(projectId, 'PROJECT_COORDINATION')).toEqual([
      '/projects',
      projectId,
      'status',
    ]);
    expect(projectActionFragment('PROJECT_COORDINATION')).toBe('workspace');
    expect(projectActionFragment('CUSTOMER_CORRESPONDENCE')).toBeUndefined();
  });
});
