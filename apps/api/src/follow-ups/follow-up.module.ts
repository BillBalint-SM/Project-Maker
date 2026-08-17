import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { Project } from '../projects/project.entity';
import { CustomerFollowUpController } from './follow-up.controller';
import { CustomerFollowUpEntity } from './follow-up.entity';
import { CustomerFollowUpDeliveryAttemptEntity } from './follow-up-delivery-attempt.entity';
import { CustomerFollowUpService } from './follow-up.service';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      CustomerFollowUpEntity,
      CustomerFollowUpDeliveryAttemptEntity,
      AuditEvent,
      Project,
    ]),
  ],
  controllers: [CustomerFollowUpController],
  providers: [CustomerFollowUpService],
})
export class CustomerFollowUpModule {}
