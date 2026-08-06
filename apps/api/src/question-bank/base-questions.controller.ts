import { Body, Controller, Get, Patch, Post } from '@nestjs/common';
import type { BaseQuestionBank } from '@project-maker/contracts';

import { CreateBaseQuestionDto } from './dto/create-base-question.dto';
import { UpdateBaseQuestionDto } from './dto/update-base-question.dto';
import { QuestionBankService } from './question-bank.service';

@Controller('settings/base-questions')
export class BaseQuestionsController {
  constructor(private readonly questionBankService: QuestionBankService) {}

  @Get()
  list(): Promise<BaseQuestionBank> {
    return this.questionBankService.getBaseQuestions();
  }

  @Post()
  create(@Body() input: CreateBaseQuestionDto): Promise<BaseQuestionBank> {
    return this.questionBankService.createBaseQuestion(input);
  }

  @Patch()
  update(@Body() input: UpdateBaseQuestionDto): Promise<BaseQuestionBank> {
    return this.questionBankService.updateBaseQuestion(input);
  }
}
