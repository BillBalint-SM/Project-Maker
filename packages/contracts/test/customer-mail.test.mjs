import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  parseCustomerMailErrorCode,
  parseCustomerCorrespondenceStatus,
  parseMailSystemAcceptanceState,
  parseMailboxChangeType,
} from '../dist/customer-mail.js';

describe('customer mail runtime contracts', () => {
  it('accepts every published provider-neutral value', () => {
    assert.equal(parseMailSystemAcceptanceState('ACCEPTED'), 'ACCEPTED');
    assert.equal(parseMailSystemAcceptanceState('REJECTED'), 'REJECTED');
    assert.equal(parseMailboxChangeType('UPSERTED'), 'UPSERTED');
    assert.equal(parseMailboxChangeType('DELETED'), 'DELETED');
    assert.equal(parseCustomerMailErrorCode('AUTHENTICATION_ERROR'), 'AUTHENTICATION_ERROR');
    assert.equal(parseCustomerMailErrorCode('INVALID_CURSOR'), 'INVALID_CURSOR');
    assert.equal(parseCustomerCorrespondenceStatus('Új válasz'), 'Új válasz');
  });

  it('rejects unknown state and error values at runtime', () => {
    assert.throws(() => parseMailSystemAcceptanceState('DELIVERED'), TypeError);
    assert.throws(() => parseMailboxChangeType('REPLIED'), TypeError);
    assert.throws(() => parseCustomerMailErrorCode('GRAPH_401'), TypeError);
    assert.throws(() => parseCustomerCorrespondenceStatus('DELIVERED'), TypeError);
  });
});
