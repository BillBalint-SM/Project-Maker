import { Module } from '@nestjs/common';

import { customerMailerToken, SmtpMailerService } from './smtp-mailer.service';

@Module({
  providers: [
    SmtpMailerService,
    { provide: customerMailerToken, useExisting: SmtpMailerService },
  ],
  exports: [customerMailerToken],
})
export class MailDeliveryModule {}
