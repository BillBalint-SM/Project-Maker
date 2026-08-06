import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { MarkdownRevisionEntity } from '../markdown/markdown-revision.entity';
import { Project } from '../projects/project.entity';
import { CustomerFollowUpController } from './follow-up.controller';
import { CustomerFollowUpEntity } from './follow-up.entity';
import { CustomerFollowUpService } from './follow-up.service';
import { customerMailerToken, SmtpMailerService } from './smtp-mailer.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([CustomerFollowUpEntity, AuditEvent, MarkdownRevisionEntity, Project]),
  ],
  controllers: [CustomerFollowUpController],
  providers: [
    SmtpMailerService,
    {
      provide: customerMailerToken,
      useExisting: SmtpMailerService,
    },
    CustomerFollowUpService,
  ],
})
export class CustomerFollowUpModule {}
