import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { ProjectReadiness } from '@project-maker/contracts';

import { ReadinessService } from './readiness.service';

@Controller('projects/:projectId')
export class ReadinessController {
  constructor(private readonly readinessService: ReadinessService) {}

  @Get('readiness')
  getReadiness(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<ProjectReadiness> {
    return this.readinessService.getReadiness(projectId);
  }
}
