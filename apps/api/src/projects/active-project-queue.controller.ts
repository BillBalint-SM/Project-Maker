import { Controller, Get, Query } from '@nestjs/common';
import type {
  ActiveProjectQueuePage,
  ActiveProjectQueueQuery,
} from '@project-maker/contracts';
import { activeProjectUrgencies } from '@project-maker/contracts/active-project-queue';
import { projectPreparationStates } from '@project-maker/contracts/project-preparation-status';

import { ActiveProjectQueueService } from './active-project-queue.service';

@Controller('projects/active-queue')
export class ActiveProjectQueueController {
  constructor(private readonly activeProjectQueueService: ActiveProjectQueueService) {}

  @Get()
  firstPage(
    @Query('q') search?: string | string[],
    @Query('urgency') urgency?: string | string[],
    @Query('preparation') preparation?: string | string[],
  ): Promise<ActiveProjectQueuePage> {
    const query: ActiveProjectQueueQuery = {
      search: Array.isArray(search) ? search[0] : search,
      urgencies: knownValues(urgency, activeProjectUrgencies),
      preparationStates: knownValues(preparation, projectPreparationStates),
    };
    return this.activeProjectQueueService.firstPage(query);
  }
}

function knownValues<const Value extends string>(
  raw: string | string[] | undefined,
  allowed: readonly Value[],
): Value[] {
  const values = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw];
  const allowedValues = new Set<string>(allowed);
  return [...new Set(values.filter((value): value is Value => allowedValues.has(value)))];
}
