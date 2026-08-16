import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import type { MarkdownTemplatePreview, MarkdownTemplateSummary } from '@project-maker/contracts';

import { CreateMarkdownTemplateDto } from './dto/create-markdown-template.dto';
import { UpdateMarkdownTemplateDraftDto } from './dto/update-markdown-template-draft.dto';
import { MarkdownTemplateService } from './markdown-template.service';

@Controller('settings/markdown-templates')
export class MarkdownTemplateController {
  constructor(private readonly templates: MarkdownTemplateService) {}

  @Get()
  list(): Promise<readonly MarkdownTemplateSummary[]> {
    return this.templates.list();
  }

  @Post()
  create(@Body() input: CreateMarkdownTemplateDto): Promise<MarkdownTemplateSummary> {
    return this.templates.create(input);
  }

  @Put(':templateId/draft')
  updateDraft(
    @Param('templateId', new ParseUUIDPipe()) templateId: string,
    @Body() input: UpdateMarkdownTemplateDraftDto,
  ): Promise<MarkdownTemplateSummary> {
    return this.templates.updateDraft(templateId, input);
  }

  @Post(':templateId/preview')
  preview(
    @Param('templateId', new ParseUUIDPipe()) templateId: string,
  ): Promise<MarkdownTemplatePreview> {
    return this.templates.preview(templateId);
  }

  @Post(':templateId/publish')
  publish(
    @Param('templateId', new ParseUUIDPipe()) templateId: string,
  ): Promise<MarkdownTemplateSummary> {
    return this.templates.publish(templateId);
  }
}
