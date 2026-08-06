import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { Project } from './project.entity';
import { ProjectsController } from './projects.controller';
import { ProjectsService } from './projects.service';

@Module({
  imports: [TypeOrmModule.forFeature([Project, AuditEvent])],
  controllers: [ProjectsController],
  providers: [ProjectsService],
})
export class ProjectsModule {}
