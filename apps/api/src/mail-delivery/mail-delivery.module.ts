import { DynamicModule, Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import {
  customerMailboxChangesToken,
  customerOutboundMailToken,
} from './customer-mail-boundary';
import { ImapFlowMailboxClientFactory } from './imap-flow-mailbox.client';
import {
  ImapCustomerMailboxChanges,
  imapMailboxClientFactoryToken,
} from './imap-customer-mailbox-changes';
import { SmtpCustomerOutboundMail } from './smtp-customer-outbound-mail';

@Global()
@Module({})
export class MailDeliveryModule {
  static gateway(): DynamicModule {
    return {
      module: MailDeliveryModule,
      imports: [ConfigModule],
      providers: [
        SmtpCustomerOutboundMail,
        ImapFlowMailboxClientFactory,
        {
          provide: imapMailboxClientFactoryToken,
          useExisting: ImapFlowMailboxClientFactory,
        },
        ImapCustomerMailboxChanges,
        { provide: customerOutboundMailToken, useExisting: SmtpCustomerOutboundMail },
        { provide: customerMailboxChangesToken, useExisting: ImapCustomerMailboxChanges },
      ],
      exports: [customerOutboundMailToken, customerMailboxChangesToken],
    };
  }
}
