import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import type { ProjectQuestionSchema } from '@project-maker/contracts';

import { PublishProjectQuestionSchemaDto } from './dto/publish-project-question-schema.dto';
import { QuestionBankService } from './question-bank.service';

@Controller('projects/:projectId/question-schema')
export class ProjectQuestionSchemaController {
  constructor(private readonly questionBankService: QuestionBankService) {}

  @Get()
  get(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<ProjectQuestionSchema> {
    return this.questionBankService.getProjectSchema(projectId);
  }

  @Post()
  create(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: PublishProjectQuestionSchemaDto,
  ): Promise<ProjectQuestionSchema> {
    return this.questionBankService.createProjectSchema(projectId, input);
  }

  @Patch()
  update(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: PublishProjectQuestionSchemaDto,
  ): Promise<ProjectQuestionSchema> {
    return this.questionBankService.updateProjectSchema(projectId, input);
  }
}
