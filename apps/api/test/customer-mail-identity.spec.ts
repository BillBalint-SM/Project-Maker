import { ConfigService } from '@nestjs/config';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  preferredCustomerSender,
  rememberedCustomerSender,
} from '../src/mail-delivery/customer-mail-identity';

describe('customer mail identity compatibility', () => {
  const config = new ConfigService({
    CUSTOMER_MAILBOX_NAME: 'Project Maker',
    CUSTOMER_MAILBOX_ADDRESS: 'project-maker@pte.hu',
  });

  it('does not reinterpret a legacy address-as-name snapshot as a confirmed display name', () => {
    assert.equal(rememberedCustomerSender('po@pte.hu', 'po@pte.hu'), null);
    assert.deepEqual(
      preferredCustomerSender('po@pte.hu', 'po@pte.hu', config),
      { name: 'Project Maker', address: 'project-maker@pte.hu' },
    );
  });

  it('preserves a genuinely named remembered sender', () => {
    assert.deepEqual(
      rememberedCustomerSender('PO Péter', 'po.peter@pte.hu'),
      { name: 'PO Péter', address: 'po.peter@pte.hu' },
    );
  });
});
