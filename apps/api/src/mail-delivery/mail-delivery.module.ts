import { DynamicModule, Global, Module, type Provider } from '@nestjs/common';

import {
  customerMailboxChangesToken,
  customerOutboundMailToken,
  UnavailableCustomerMailboxChanges,
} from './customer-mail-boundary';
import { GraphCustomerMailBoundary, type GraphMailClient } from './graph-customer-mail-boundary';
import { SmtpMailerService } from './smtp-mailer.service';

@Global()
@Module({})
export class MailDeliveryModule {
  static smtp(): DynamicModule {
    return {
      module: MailDeliveryModule,
      providers: [
        SmtpMailerService,
        UnavailableCustomerMailboxChanges,
        { provide: customerOutboundMailToken, useExisting: SmtpMailerService },
        { provide: customerMailboxChangesToken, useExisting: UnavailableCustomerMailboxChanges },
      ],
      exports: [customerOutboundMailToken, customerMailboxChangesToken],
    };
  }

  static graph(clientProvider: Provider<GraphMailClient>): DynamicModule {
    return {
      module: MailDeliveryModule,
      providers: [
        clientProvider,
        GraphCustomerMailBoundary,
        { provide: customerOutboundMailToken, useExisting: GraphCustomerMailBoundary },
        { provide: customerMailboxChangesToken, useExisting: GraphCustomerMailBoundary },
      ],
      exports: [customerOutboundMailToken, customerMailboxChangesToken],
    };
  }
}
