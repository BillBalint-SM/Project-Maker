import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CustomerMailBoundaryError } from '../src/mail-delivery/customer-mail-boundary';
import {
  MailGatewayCheckpointCodec,
  type MailGatewayCheckpointState,
} from '../src/mail-delivery/mail-gateway-checkpoint';

const state: MailGatewayCheckpointState = {
  uidValidity: '4294967295',
  nextUid: 42,
  upperUid: 91,
  recoverySince: '2026-08-20T08:00:00.000Z',
};

describe('mail gateway checkpoint', () => {
  it('round-trips a versioned, opaque checkpoint without configuration', () => {
    const encoded = new MailGatewayCheckpointCodec().encode(state);
    const decoded = new MailGatewayCheckpointCodec().decode(encoded);

    assert.deepEqual(decoded, state);
    assert.match(encoded, /^v2\.[A-Za-z0-9_-]+$/);
    assert.equal(encoded.includes('INBOX'), false);
  });

  it('rejects malformed, unknown-version, and schema-invalid checkpoints', () => {
    const encoded = new MailGatewayCheckpointCodec().encode(state);
    const [, payload] = encoded.split('.');
    assert.ok(payload);
    const invalidPayload = Buffer.from(JSON.stringify({ ...state, extra: true })).toString('base64url');

    for (const decode of [
      () => new MailGatewayCheckpointCodec().decode(`v2.${payload.slice(1)}`),
      () => new MailGatewayCheckpointCodec().decode(`v2.${invalidPayload}`),
      () => new MailGatewayCheckpointCodec().decode('v1.legacy.encrypted.checkpoint'),
      () => new MailGatewayCheckpointCodec().decode('not-a-checkpoint'),
    ]) {
      assert.throws(decode, invalidCursor);
    }
  });

  it('rejects impossible UID and recovery state before persisting a checkpoint', () => {
    const codec = new MailGatewayCheckpointCodec();
    const invalidStates: MailGatewayCheckpointState[] = [
      { ...state, uidValidity: '0' },
      { ...state, nextUid: 0 },
      { ...state, upperUid: 40 },
      { ...state, recoverySince: 'not-a-date' },
    ];

    for (const invalidState of invalidStates) {
      assert.throws(() => codec.encode(invalidState), invalidCursor);
    }
  });

  it('preserves the maximum-UID terminal nextUid sentinel for restart-safe completion', () => {
    const codec = new MailGatewayCheckpointCodec();
    const terminal: MailGatewayCheckpointState = {
      uidValidity: '4294967295',
      nextUid: 4_294_967_296,
      upperUid: null,
      recoverySince: null,
    };

    assert.deepEqual(codec.decode(codec.encode(terminal)), terminal);
    assert.throws(
      () => codec.encode({ ...terminal, upperUid: 4_294_967_295 }),
      invalidCursor,
    );
  });
});

function invalidCursor(error: unknown): boolean {
  return error instanceof CustomerMailBoundaryError
    && error.code === 'INVALID_CURSOR'
    && error.message === 'Customer mail operation failed.';
}
