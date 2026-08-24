import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import type {
  MarkdownGenerationConfiguration,
  MarkdownRevision,
  MarkdownRevisionSummary,
} from '@project-maker/contracts';

import { CreateMarkdownRevisionDto } from './dto/create-markdown-revision.dto';
import { MarkdownService } from './markdown.service';

@Controller('projects/:projectId/markdown-revisions')
export class MarkdownController {
  constructor(private readonly markdownService: MarkdownService) {}

  @Post()
  create(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: CreateMarkdownRevisionDto,
  ): Promise<MarkdownRevision> {
    return this.markdownService.create(projectId, input);
  }

  @Get()
  list(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<readonly MarkdownRevisionSummary[]> {
    return this.markdownService.listSummaries(projectId);
  }

  @Get('configuration')
  configuration(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<MarkdownGenerationConfiguration> {
    return this.markdownService.configuration(projectId);
  }

  @Get(':revisionId/download')
  @Header('Content-Type', 'text/markdown; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="execution-plan.md"')
  async download(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('revisionId', new ParseUUIDPipe()) revisionId: string,
  ): Promise<string> {
    const revision = await this.markdownService.find(projectId, revisionId);
    return revision.content;
  }

  @Get(':revisionId')
  get(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('revisionId', new ParseUUIDPipe()) revisionId: string,
  ): Promise<MarkdownRevision> {
    return this.markdownService.find(projectId, revisionId);
  }
}
