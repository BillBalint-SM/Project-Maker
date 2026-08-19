import { describe, expect, it } from 'vitest';

import { validatedProjectReturnTarget } from './project-return-target';

describe('validatedProjectReturnTarget', () => {
  it('accepts the global follow-up queue without allowing extra query state', () => {
    expect(validatedProjectReturnTarget('/follow-ups')).toBe('/follow-ups');
    expect(validatedProjectReturnTarget('/follow-ups?project=hidden')).toBe('/');
  });
});
