import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Put, Query } from '@nestjs/common';
import type { BusinessGoal, BusinessRoadmap, Initiative, ProjectWorkspace } from '@project-maker/contracts';

import { AssignProjectInitiativeDto } from './dto/assign-project-initiative.dto';
import { SaveRoadmapGroupDto } from './dto/save-roadmap-group.dto';
import { RoadmapService } from './roadmap.service';

@Controller()
export class RoadmapController {
  constructor(private readonly roadmap: RoadmapService) {}

  @Get('roadmap')
  get(@Query('includeArchived') includeArchived?: string): Promise<BusinessRoadmap> {
    return this.roadmap.get(includeArchived === 'true');
  }

  @Post('roadmap/goals')
  createGoal(@Body() input: SaveRoadmapGroupDto): Promise<BusinessGoal> {
    return this.roadmap.createGoal(input);
  }

  @Put('roadmap/goals/:goalId')
  updateGoal(@Param('goalId', new ParseUUIDPipe()) goalId: string, @Body() input: SaveRoadmapGroupDto): Promise<BusinessGoal> {
    return this.roadmap.updateGoal(goalId, input);
  }

  @Delete('roadmap/goals/:goalId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteGoal(@Param('goalId', new ParseUUIDPipe()) goalId: string): Promise<void> {
    return this.roadmap.deleteGoal(goalId);
  }

  @Post('roadmap/goals/:goalId/initiatives')
  createInitiative(
    @Param('goalId', new ParseUUIDPipe()) goalId: string,
    @Body() input: SaveRoadmapGroupDto,
  ): Promise<Initiative> {
    return this.roadmap.createInitiative(goalId, input);
  }

  @Put('roadmap/initiatives/:initiativeId')
  updateInitiative(
    @Param('initiativeId', new ParseUUIDPipe()) initiativeId: string,
    @Body() input: SaveRoadmapGroupDto,
  ): Promise<Initiative> {
    return this.roadmap.updateInitiative(initiativeId, input);
  }

  @Delete('roadmap/initiatives/:initiativeId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteInitiative(@Param('initiativeId', new ParseUUIDPipe()) initiativeId: string): Promise<void> {
    return this.roadmap.deleteInitiative(initiativeId);
  }

  @Put('projects/:projectId/initiative')
  assignProject(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: AssignProjectInitiativeDto,
  ): Promise<ProjectWorkspace> {
    return this.roadmap.assignProject(projectId, input);
  }
}
