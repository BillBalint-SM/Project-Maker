import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { ProjectPreparationStatus } from '@project-maker/contracts';

import { ProjectPreparationStatusService } from './project-preparation-status.service';

@Controller('projects/:projectId')
export class ProjectPreparationStatusController {
  constructor(
    private readonly projectPreparationStatusService: ProjectPreparationStatusService,
  ) {}

  @Get('preparation-status')
  getPreparationStatus(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<ProjectPreparationStatus> {
    return this.projectPreparationStatusService.getStatus(projectId);
  }
}
