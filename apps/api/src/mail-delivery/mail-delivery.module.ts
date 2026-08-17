import { Module } from '@nestjs/common';

import { customerOutboundMailToken } from './customer-mail-boundary';
import { SmtpMailerService } from './smtp-mailer.service';

@Module({
  providers: [
    SmtpMailerService,
    { provide: customerOutboundMailToken, useExisting: SmtpMailerService },
  ],
  exports: [customerOutboundMailToken],
})
export class MailDeliveryModule {}
