import { ConfigService } from '@nestjs/config';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  dedicatedCustomerSender,
} from '../src/mail-delivery/customer-mail-identity';

describe('Operator-provided correspondence mailbox identity', () => {
  const config = new ConfigService({
    CORRESPONDENCE_MAILBOX_NAME: 'Project Maker',
    CORRESPONDENCE_MAILBOX_ADDRESS: 'project-maker@operator.example',
  });

  it('uses the configured dedicated identity without a provider-specific domain rule', () => {
    assert.deepEqual(dedicatedCustomerSender(config), {
      name: 'Project Maker',
      address: 'project-maker@operator.example',
    });
  });

  it('fails closed on a malformed configured identity', () => {
    for (const values of [
      {
        CORRESPONDENCE_MAILBOX_NAME: 'Project Maker',
        CORRESPONDENCE_MAILBOX_ADDRESS: 'not-an-address',
      },
      {
        CORRESPONDENCE_MAILBOX_NAME: 'Project\r\nMaker',
        CORRESPONDENCE_MAILBOX_ADDRESS: 'project-maker@operator.example',
      },
    ]) {
      assert.throws(
        () => dedicatedCustomerSender(new ConfigService(values)),
        /correspondence mailbox/i,
      );
    }
  });
});
