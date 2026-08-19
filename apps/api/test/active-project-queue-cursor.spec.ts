import { ConfigService } from '@nestjs/config';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ActiveProjectQueueCursorCodec } from '../src/projects/active-project-queue-cursor';

describe('ActiveProjectQueueCursorCodec', () => {
  it('requires one shared sufficiently strong secret in production', () => {
    assert.throws(
      () => new ActiveProjectQueueCursorCodec(configuration({ NODE_ENV: 'production' })),
      /ACTIVE_PROJECT_QUEUE_CURSOR_SECRET/,
    );
    assert.throws(
      () => new ActiveProjectQueueCursorCodec(configuration({
        NODE_ENV: 'production',
        ACTIVE_PROJECT_QUEUE_CURSOR_SECRET: 'too-short',
      })),
      /ACTIVE_PROJECT_QUEUE_CURSOR_SECRET/,
    );
  });

  it('opens a cursor sealed by another process-equivalent codec with the shared secret', () => {
    const config = configuration({
      NODE_ENV: 'production',
      ACTIVE_PROJECT_QUEUE_CURSOR_SECRET: 'one-shared-secret-with-at-least-32-characters',
    });
    const first = new ActiveProjectQueueCursorCodec(config);
    const second = new ActiveProjectQueueCursorCodec(config);
    const payload = { page: 'next', projectId: 'private' };

    assert.deepEqual(second.open(first.seal(payload)), payload);
  });
});

function configuration(values: Readonly<Record<string, string>>): ConfigService {
  return { get: (key: string) => values[key] } as ConfigService;
}
