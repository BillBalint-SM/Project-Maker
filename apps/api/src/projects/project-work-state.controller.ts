import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { ProjectPortfolioEntry, ProjectWorkState } from '@project-maker/contracts';

import { ActiveProjectQueueService } from './active-project-queue.service';

@Controller('projects')
export class ProjectWorkStateController {
  constructor(private readonly activeProjectQueueService: ActiveProjectQueueService) {}

  @Get('portfolio')
  getPortfolio(): Promise<readonly ProjectPortfolioEntry[]> {
    return this.activeProjectQueueService.getPortfolio();
  }

  @Get(':projectId/work-state')
  getWorkState(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<ProjectWorkState> {
    return this.activeProjectQueueService.getWorkState(projectId);
  }
}
