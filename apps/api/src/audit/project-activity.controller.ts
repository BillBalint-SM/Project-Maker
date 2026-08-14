import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { ProjectActivityFeed } from '@project-maker/contracts';

import { AuditService } from './audit.service';

@Controller('projects/:projectId/activity')
export class ProjectActivityController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  list(@Param('projectId', new ParseUUIDPipe()) projectId: string): Promise<ProjectActivityFeed> {
    return this.auditService.listRecentProjectActivity(projectId);
  }
}
