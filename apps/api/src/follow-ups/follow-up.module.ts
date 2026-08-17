import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { MarkdownRevisionEntity } from '../markdown/markdown-revision.entity';
import { Project } from '../projects/project.entity';
import { MailDeliveryModule } from '../mail-delivery/mail-delivery.module';
import { CustomerFollowUpController } from './follow-up.controller';
import { CustomerFollowUpEntity } from './follow-up.entity';
import { CustomerFollowUpService } from './follow-up.service';

@Module({
  imports: [
    ConfigModule,
    MailDeliveryModule,
    TypeOrmModule.forFeature([CustomerFollowUpEntity, AuditEvent, MarkdownRevisionEntity, Project]),
  ],
  controllers: [CustomerFollowUpController],
  providers: [CustomerFollowUpService],
})
export class CustomerFollowUpModule {}
