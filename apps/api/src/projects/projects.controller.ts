import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { ProjectCockpit, ProjectWorkspace } from '@project-maker/contracts';

import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectWorkspaceDto } from './dto/update-project-workspace.dto';
import { ProjectsService } from './projects.service';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(@Body() input: CreateProjectDto): Promise<ProjectWorkspace> {
    return this.projectsService.create(input);
  }

  @Get()
  list(): Promise<readonly ProjectWorkspace[]> {
    return this.projectsService.list();
  }

  @Get(':projectId/cockpit')
  cockpit(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<ProjectCockpit> {
    return this.projectsService.cockpit(projectId);
  }

  @Patch(':projectId/workspace')
  updateWorkspace(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: UpdateProjectWorkspaceDto,
  ): Promise<ProjectWorkspace> {
    return this.projectsService.updateWorkspace(projectId, input);
  }

  @Post(':projectId/archive')
  archive(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<ProjectWorkspace> {
    return this.projectsService.archive(projectId);
  }

  @Post(':projectId/restore')
  restore(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<ProjectWorkspace> {
    return this.projectsService.restore(projectId);
  }
}
