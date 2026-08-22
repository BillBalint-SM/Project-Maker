import { describe, expect, it } from 'vitest';

import { ProjectCommandPending } from './project-command-pending';

describe('ProjectCommandPending', () => {
  it('blocks a duplicate command but permits an independent command', () => {
    const pending = new ProjectCommandPending();

    expect(pending.begin('save')).toBe(true);
    expect(pending.begin('save')).toBe(false);
    expect(pending.begin('preview')).toBe(true);
    expect(pending.isPending('save')).toBe(true);
    expect(pending.isPending('preview')).toBe(true);
  });

  it('releases only the completed command', () => {
    const pending = new ProjectCommandPending();
    pending.begin('save');
    pending.begin('preview');

    pending.end('save');

    expect(pending.isPending('save')).toBe(false);
    expect(pending.isPending('preview')).toBe(true);
  });
});
