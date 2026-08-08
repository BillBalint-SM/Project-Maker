import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { Project } from '../projects/project.entity';
import { DiscoveryFollowUpsController } from './discovery-follow-ups.controller';
import { DiscoveryFollowUpEntity } from './discovery-follow-up.entity';
import { DiscoveryFollowUpsService } from './discovery-follow-ups.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent, DiscoveryFollowUpEntity, Project])],
  controllers: [DiscoveryFollowUpsController],
  providers: [DiscoveryFollowUpsService],
})
export class DiscoveryFollowUpsModule {}
