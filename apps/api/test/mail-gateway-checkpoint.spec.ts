import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CustomerMailBoundaryError } from '../src/mail-delivery/customer-mail-boundary';
import {
  MailGatewayCheckpointCodec,
  type MailGatewayCheckpointState,
} from '../src/mail-delivery/mail-gateway-checkpoint';

const context = {
  secret: 'checkpoint-secret-with-at-least-32-bytes',
  mailboxAddress: 'project-maker@example.test',
  folder: 'INBOX',
};

const state: MailGatewayCheckpointState = {
  uidValidity: '4294967295',
  nextUid: 42,
  upperUid: 91,
  recoverySince: '2026-08-20T08:00:00.000Z',
};

describe('mail gateway checkpoint', () => {
  it('round-trips across process-equivalent codec instances without exposing cursor internals', () => {
    const encoded = new MailGatewayCheckpointCodec(context).encode(state);
    const decoded = new MailGatewayCheckpointCodec(context).decode(encoded);

    assert.deepEqual(decoded, state);
    assert.match(encoded, /^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.equal(encoded.includes('INBOX'), false);
    assert.equal(encoded.includes('4294967295'), false);
    for (const segment of encoded.split('.').slice(1)) {
      assert.doesNotMatch(Buffer.from(segment, 'base64url').toString('utf8'), /INBOX|uidValidity|nextUid/);
    }
  });

  it('rejects tampering and checkpoints bound to another mailbox or folder', () => {
    const encoded = new MailGatewayCheckpointCodec(context).encode(state);
    const [tokenVersion, nonce, ciphertext, tag] = encoded.split('.');
    assert.ok(tokenVersion && nonce && ciphertext && tag);
    const alteredCiphertext = `${ciphertext[0] === 'A' ? 'B' : 'A'}${ciphertext.slice(1)}`;
    const tampered = [tokenVersion, nonce, alteredCiphertext, tag].join('.');
    const wrongMailbox = new MailGatewayCheckpointCodec({
      ...context,
      mailboxAddress: 'other@example.test',
    });
    const wrongFolder = new MailGatewayCheckpointCodec({ ...context, folder: 'Replies' });

    for (const decode of [
      () => new MailGatewayCheckpointCodec(context).decode(tampered),
      () => wrongMailbox.decode(encoded),
      () => wrongFolder.decode(encoded),
      () => new MailGatewayCheckpointCodec(context).decode('not-a-checkpoint'),
    ]) {
      assert.throws(decode, invalidCursor);
    }
  });

  it('rejects impossible UID and recovery state before persisting a checkpoint', () => {
    const codec = new MailGatewayCheckpointCodec(context);
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
    const codec = new MailGatewayCheckpointCodec(context);
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
