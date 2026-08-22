import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { BaseQuestionBank } from '@project-maker/contracts';

import {
  attachmentContentDisposition,
  type UploadedAttachmentFile,
} from '../attachments/attachment-file-policy';
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

  @Post(':questionId/reference-files')
  @UseInterceptors(FileInterceptor('file'))
  addReferenceFile(
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @UploadedFile() file: UploadedAttachmentFile | undefined,
  ): Promise<BaseQuestionBank> {
    return this.questionBankService.addReferenceFile(questionId, file);
  }

  @Delete(':questionId/reference-files/:fileId')
  removeReferenceFile(
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
  ): Promise<BaseQuestionBank> {
    return this.questionBankService.removeReferenceFile(questionId, fileId);
  }

  @Get(':questionId/reference-files/:fileId/download')
  async downloadReferenceFile(
    @Param('questionId', new ParseUUIDPipe()) questionId: string,
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @Res() response: {
      setHeader(name: string, value: string | number): void;
      send(content: Buffer): void;
    },
  ): Promise<void> {
    const file = await this.questionBankService.downloadReferenceFile(questionId, fileId);
    response.setHeader('Content-Type', file.contentType);
    response.setHeader('Content-Length', file.sizeBytes);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Disposition', attachmentContentDisposition(file.originalName));
    response.send(file.content);
  }
}
