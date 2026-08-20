import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { Project } from '../projects/project.entity';
import { AuditEvent } from './audit-event.entity';
import { ProjectActivityController } from './project-activity.controller';
import { AuditService } from './audit.service';

@Module({
  imports: [TypeOrmModule.forFeature([AuditEvent, Project])],
  controllers: [ProjectActivityController],
  providers: [AuditService],
})
export class AuditModule {}
