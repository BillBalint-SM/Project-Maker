import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import type { Insight } from '@project-maker/contracts';

import { CreateInsightDto } from './dto/create-insight.dto';
import { UpdateInsightDto } from './dto/update-insight.dto';
import { InsightsService } from './insights.service';

@Controller('projects/:projectId')
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('insights')
  list(@Param('projectId', new ParseUUIDPipe()) projectId: string): Promise<readonly Insight[]> {
    return this.insights.list(projectId);
  }

  @Post('insights')
  create(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: CreateInsightDto,
  ): Promise<Insight> {
    return this.insights.create(projectId, input);
  }

  @Put('insights/:insightId')
  update(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('insightId', new ParseUUIDPipe()) insightId: string,
    @Body() input: UpdateInsightDto,
  ): Promise<Insight> {
    return this.insights.update(projectId, insightId, input);
  }

  @Delete('evidence/:evidenceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteEvidence(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('evidenceId', new ParseUUIDPipe()) evidenceId: string,
  ): Promise<void> {
    return this.insights.deleteEvidence(projectId, evidenceId);
  }
}
