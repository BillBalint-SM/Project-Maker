import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ActiveProjectQueueCursorCodec } from '../src/projects/active-project-queue-cursor';

describe('ActiveProjectQueueCursorCodec', () => {
  it('creates deterministic, readable navigation state that another process can open', () => {
    const first = new ActiveProjectQueueCursorCodec();
    const second = new ActiveProjectQueueCursorCodec();
    const payload = { page: 'next', projectId: 'private' };

    assert.equal(first.seal(payload), first.seal(payload));
    assert.deepEqual(second.open(first.seal(payload)), payload);
    assert.match(
      Buffer.from(first.seal(payload), 'base64url').toString('utf8'),
      /"version":1/,
    );
  });

  it('rejects malformed or unsupported cursor envelopes', () => {
    const codec = new ActiveProjectQueueCursorCodec();

    assert.throws(() => codec.open('not-a-cursor'), /Invalid cursor envelope/);
    assert.throws(
      () => codec.open(Buffer.from(JSON.stringify({ version: 2, payload: {} })).toString('base64url')),
      /Invalid cursor envelope/,
    );
  });
});
