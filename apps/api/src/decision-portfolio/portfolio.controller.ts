import { Controller, Get, Query } from '@nestjs/common';
import type { PortfolioPage, PortfolioQuery } from '@project-maker/contracts';
import {
  formalDecisionOutcomes,
  portfolioArchiveScopes,
  portfolioSorts,
  projectHealthValues,
} from '@project-maker/contracts/decision-portfolio-runtime';
import { projectStatuses } from '@project-maker/contracts/runtime';
import { projectPreparationStates } from '@project-maker/contracts/project-preparation-status';

import { PortfolioService } from './portfolio.service';

@Controller('projects/portfolio-page')
export class PortfolioController {
  constructor(private readonly portfolio: PortfolioService) {}

  @Get()
  get(
    @Query('search') search?: string,
    @Query('internalOwner') internalOwner?: string,
    @Query('status') status?: string | string[],
    @Query('preparation') preparation?: string | string[],
    @Query('readiness') readinessBucket?: string,
    @Query('score') decisionScoreBucket?: string,
    @Query('due') due?: string,
    @Query('decision') decision?: string,
    @Query('health') health?: string,
    @Query('goalId') goalId?: string,
    @Query('initiativeId') initiativeId?: string,
    @Query('archiveScope') archiveScope?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<PortfolioPage> {
    const query: PortfolioQuery = {
      search,
      internalOwner,
      statuses: knownMany(status, projectStatuses),
      preparationStates: knownMany(preparation, projectPreparationStates),
      readinessBucket: knownOne(readinessBucket, ['CLARIFICATION', 'PREPARABLE', 'READY'] as const),
      decisionScoreBucket: knownOne(decisionScoreBucket, ['LOW', 'MEDIUM', 'HIGH'] as const),
      due: knownOne(due, ['OVERDUE', 'DUE_SOON', 'NONE'] as const),
      decision: knownOne(decision, formalDecisionOutcomes),
      health: knownOne(health, projectHealthValues),
      goalId,
      initiativeId,
      archiveScope: knownOne(archiveScope, portfolioArchiveScopes),
      sort: knownOne(sort, portfolioSorts),
      page: positiveInteger(page),
      pageSize: positiveInteger(pageSize),
    };
    return this.portfolio.getPage(query);
  }
}

function knownOne<const Value extends string>(value: string | undefined, allowed: readonly Value[]): Value | undefined {
  return value && allowed.includes(value as Value) ? value as Value : undefined;
}

function knownMany<const Value extends string>(value: string | string[] | undefined, allowed: readonly Value[]): Value[] {
  const values = value === undefined ? [] : Array.isArray(value) ? value : [value];
  return [...new Set(values.filter((item): item is Value => allowed.includes(item as Value)))];
}

function positiveInteger(value: string | undefined): number | undefined {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
