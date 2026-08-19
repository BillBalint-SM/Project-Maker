import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import type {
  ActiveProjectQueuePage,
  ActiveProjectQueueQuery,
} from '@project-maker/contracts';
import { activeProjectUrgencies } from '@project-maker/contracts/active-project-queue';
import { projectPreparationStates } from '@project-maker/contracts/project-preparation-status';

import {
  ActiveProjectQueueCursorError,
  ActiveProjectQueueService,
} from './active-project-queue.service';

@Controller('projects/active-queue')
export class ActiveProjectQueueController {
  constructor(private readonly activeProjectQueueService: ActiveProjectQueueService) {}

  @Get()
  getPage(
    @Query('q') search?: string | string[],
    @Query('urgency') urgency?: string | string[],
    @Query('preparation') preparation?: string | string[],
    @Query('cursor') cursor?: string | string[],
  ): Promise<ActiveProjectQueuePage> {
    const query: ActiveProjectQueueQuery = {
      search: Array.isArray(search) ? search[0] : search,
      urgencies: knownValues(urgency, activeProjectUrgencies),
      preparationStates: knownValues(preparation, projectPreparationStates),
      cursor: Array.isArray(cursor) ? cursor[0] : cursor,
    };
    return this.activeProjectQueueService.getPage(query).catch((error: unknown) => {
      if (error instanceof ActiveProjectQueueCursorError) {
        throw new BadRequestException({ code: error.code });
      }
      throw error;
    });
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
