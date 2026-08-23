import { describe, expect, it } from 'vitest';

import { validatedWorkspaceMapReturnTarget } from './workspace-map-return-target';

describe('validatedWorkspaceMapReturnTarget', () => {
  it('accepts known selected Project routes and their validated origin', () => {
    expect(
      validatedWorkspaceMapReturnTarget(
        '/projects/project-1/customer-correspondences?returnTo=%2Ffollow-ups',
      ),
    ).toBe('/projects/project-1/customer-correspondences?returnTo=%2Ffollow-ups');
  });

  it.each([
    ['external', 'https://example.test/projects/project-1/status'],
    ['protocol-relative', '//example.test/projects/project-1/status'],
    ['unknown page', '/projects/project-1/not-a-page'],
    ['unexpected query', '/projects/project-1/status?next=https://example.test'],
    [
      'unsafe nested origin',
      '/projects/project-1/status?returnTo=https%3A%2F%2Fexample.test',
    ],
    ['malformed', '/projects/project-1/status?returnTo=%'],
  ])('defaults an %s target to the Portfolio', (_case, candidate) => {
    expect(validatedWorkspaceMapReturnTarget(candidate)).toBe('/');
  });
});
