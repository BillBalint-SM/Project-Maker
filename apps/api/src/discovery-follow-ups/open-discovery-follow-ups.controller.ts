import { Controller, Get } from '@nestjs/common';
import type { OpenDiscoveryFollowUpQueueItem } from '@project-maker/contracts';

import { DiscoveryFollowUpsService } from './discovery-follow-ups.service';

@Controller('discovery-follow-ups')
export class OpenDiscoveryFollowUpsController {
  constructor(private readonly discoveryFollowUpsService: DiscoveryFollowUpsService) {}

  @Get('open')
  listOpen(): Promise<readonly OpenDiscoveryFollowUpQueueItem[]> {
    return this.discoveryFollowUpsService.listOpen();
  }
}
