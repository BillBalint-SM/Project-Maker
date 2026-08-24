import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import type { QuestionTemplateSummary } from '@project-maker/contracts';

import { SaveQuestionTemplateDraftDto } from './dto/save-question-template-draft.dto';
import { QuestionTemplateService } from './question-template.service';

@Controller('settings/question-templates')
export class QuestionTemplateController {
  constructor(private readonly templates: QuestionTemplateService) {}

  @Get()
  list(): Promise<readonly QuestionTemplateSummary[]> {
    return this.templates.list();
  }

  @Post()
  create(@Body() input: SaveQuestionTemplateDraftDto): Promise<QuestionTemplateSummary> {
    return this.templates.create(input);
  }

  @Put(':templateId/draft')
  updateDraft(
    @Param('templateId', new ParseUUIDPipe()) templateId: string,
    @Body() input: SaveQuestionTemplateDraftDto,
  ): Promise<QuestionTemplateSummary> {
    return this.templates.updateDraft(templateId, input);
  }

  @Post(':templateId/publish')
  publish(
    @Param('templateId', new ParseUUIDPipe()) templateId: string,
  ): Promise<QuestionTemplateSummary> {
    return this.templates.publish(templateId);
  }
}
