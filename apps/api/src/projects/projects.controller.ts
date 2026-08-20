import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import type { ProjectWorkspace } from '@project-maker/contracts';

import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectBasicsDto } from './dto/update-project-basics.dto';
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

  @Patch(':projectId/workspace')
  updateWorkspace(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: UpdateProjectWorkspaceDto,
  ): Promise<ProjectWorkspace> {
    return this.projectsService.updateWorkspace(projectId, input);
  }

  @Patch(':projectId/basics')
  updateBasics(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: UpdateProjectBasicsDto,
  ): Promise<ProjectWorkspace> {
    return this.projectsService.updateBasics(projectId, input);
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

  @Delete(':projectId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteProject(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<void> {
    return this.projectsService.delete(projectId);
  }
}
