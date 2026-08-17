import { DynamicModule, Module, type Provider } from '@nestjs/common';

import {
  customerMailboxChangesToken,
  customerOutboundMailToken,
  UnavailableCustomerMailboxChanges,
} from './customer-mail-boundary';
import { GraphCustomerMailBoundary, type GraphMailClient } from './graph-customer-mail-boundary';
import { SmtpMailerService } from './smtp-mailer.service';

@Module({
  providers: [
    SmtpMailerService,
    UnavailableCustomerMailboxChanges,
    { provide: customerOutboundMailToken, useExisting: SmtpMailerService },
    { provide: customerMailboxChangesToken, useExisting: UnavailableCustomerMailboxChanges },
  ],
  exports: [customerOutboundMailToken, customerMailboxChangesToken],
})
export class MailDeliveryModule {}

@Module({})
export class GraphMailDeliveryModule {
  static register(clientProvider: Provider<GraphMailClient>): DynamicModule {
    return {
      module: GraphMailDeliveryModule,
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
