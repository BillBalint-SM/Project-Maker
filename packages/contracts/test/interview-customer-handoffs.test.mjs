import assert from 'node:assert/strict';
import test from 'node:test';

import {
  handoffVersionStatuses,
  interviewRoundStatuses,
  nextActionOwnerRoles,
} from '../dist/index.js';

test('interview completion publishes orthogonal meeting, handoff, and owner vocabularies', () => {
  assert.deepEqual(interviewRoundStatuses, ['OPEN', 'ENDED']);
  assert.deepEqual(handoffVersionStatuses, [
    'DRAFT',
    'SENDING',
    'SENT',
    'FAILED',
    'UNKNOWN',
  ]);
  assert.deepEqual(nextActionOwnerRoles, ['INTERNAL_OWNER', 'CUSTOMER_CONTACT']);
});
