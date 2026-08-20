import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  customerMailboxChangesToken,
  customerOutboundMailToken,
  type CustomerMailboxChanges,
  type CustomerOutboundMail,
} from '../src/mail-delivery/customer-mail-boundary';
import { ImapCustomerMailboxChanges } from '../src/mail-delivery/imap-customer-mailbox-changes';
import { MailDeliveryModule } from '../src/mail-delivery/mail-delivery.module';
import { SmtpCustomerOutboundMail } from '../src/mail-delivery/smtp-customer-outbound-mail';

describe('mail delivery module', () => {
  it('provides one SMTP/IMAP gateway without a Graph or unavailable-reader fallback', async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          ignoreEnvFile: true,
          load: [() => completeConfiguration()],
        }),
        MailDeliveryModule.gateway(),
      ],
    }).compile();

    const outbound = module.get<CustomerOutboundMail>(customerOutboundMailToken);
    const mailbox = module.get<CustomerMailboxChanges>(customerMailboxChangesToken);
    assert.ok(outbound instanceof SmtpCustomerOutboundMail);
    assert.ok(mailbox instanceof ImapCustomerMailboxChanges);
    assert.equal(outbound.isConfigured(), true);
    assert.equal(mailbox.isConfigured(), true);
    await module.close();
  });
});

function completeConfiguration(): Record<string, string> {
  return {
    CORRESPONDENCE_MAILBOX_NAME: 'Project Maker',
    CORRESPONDENCE_MAILBOX_ADDRESS: 'project-maker@example.test',
    MAIL_GATEWAY_SMTP_HOST: 'smtp.example.test',
    MAIL_GATEWAY_SMTP_SECURITY: 'STARTTLS_REQUIRED',
    MAIL_GATEWAY_SMTP_USERNAME: 'smtp-user',
    MAIL_GATEWAY_SMTP_PASSWORD: 'smtp-secret',
    MAIL_GATEWAY_IMAP_HOST: 'imap.example.test',
    MAIL_GATEWAY_IMAP_SECURITY: 'IMPLICIT_TLS',
    MAIL_GATEWAY_IMAP_USERNAME: 'imap-user',
    MAIL_GATEWAY_IMAP_PASSWORD: 'imap-secret',
    MAIL_GATEWAY_CHECKPOINT_SECRET: 'checkpoint-secret-with-at-least-32-bytes',
  };
}
