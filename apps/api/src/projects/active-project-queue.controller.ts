import { Controller, Get } from '@nestjs/common';
import type { ActiveProjectQueuePage } from '@project-maker/contracts';

import { ActiveProjectQueueService } from './active-project-queue.service';

@Controller('projects/active-queue')
export class ActiveProjectQueueController {
  constructor(private readonly activeProjectQueueService: ActiveProjectQueueService) {}

  @Get()
  firstPage(): Promise<ActiveProjectQueuePage> {
    return this.activeProjectQueueService.firstPage();
  }
}
