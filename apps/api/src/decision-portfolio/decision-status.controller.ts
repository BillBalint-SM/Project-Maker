import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import type { FormalDecision, ProjectStatusUpdate } from '@project-maker/contracts';

import { DecisionStatusService } from './decision-status.service';
import { CreateFormalDecisionDto } from './dto/create-formal-decision.dto';
import { SaveProjectStatusUpdateDto } from './dto/save-project-status-update.dto';

@Controller('projects/:projectId')
export class DecisionStatusController {
  constructor(private readonly service: DecisionStatusService) {}

  @Get('decisions')
  decisions(@Param('projectId', new ParseUUIDPipe()) projectId: string): Promise<readonly FormalDecision[]> {
    return this.service.listDecisions(projectId);
  }

  @Post('decisions')
  createDecision(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: CreateFormalDecisionDto,
  ): Promise<FormalDecision> {
    return this.service.createDecision(projectId, input);
  }

  @Get('status-updates')
  statuses(@Param('projectId', new ParseUUIDPipe()) projectId: string): Promise<readonly ProjectStatusUpdate[]> {
    return this.service.listStatusUpdates(projectId);
  }

  @Post('status-updates')
  createStatus(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: SaveProjectStatusUpdateDto,
  ): Promise<ProjectStatusUpdate> {
    return this.service.createStatusUpdate(projectId, input);
  }

  @Put('status-updates/:statusUpdateId')
  updateStatus(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('statusUpdateId', new ParseUUIDPipe()) statusUpdateId: string,
    @Body() input: SaveProjectStatusUpdateDto,
  ): Promise<ProjectStatusUpdate> {
    return this.service.updateLatestStatus(projectId, statusUpdateId, input);
  }
}
