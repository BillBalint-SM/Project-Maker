import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { GovernedAttachment } from '@project-maker/contracts';

import {
  attachmentContentDisposition,
  type UploadedAttachmentFile,
} from '../attachments/attachment-file-policy';
import { AttachmentsService } from './attachments.service';
import { UploadAttachmentDto } from './dto/upload-attachment.dto';

@Controller('projects/:projectId/attachments')
export class AttachmentsController {
  constructor(private readonly attachments: AttachmentsService) {}

  @Get()
  list(@Param('projectId', new ParseUUIDPipe()) projectId: string): Promise<readonly GovernedAttachment[]> {
    return this.attachments.list(projectId);
  }

  @Post()
  @UseInterceptors(FileInterceptor('file'))
  upload(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: UploadAttachmentDto,
    @UploadedFile() file: UploadedAttachmentFile | undefined,
  ): Promise<GovernedAttachment> {
    return this.attachments.upload(projectId, input.ownerKind, input.ownerId, file);
  }

  @Get(':attachmentId/download')
  async download(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
    @Res() response: {
      setHeader(name: string, value: string | number): void;
      send(content: Buffer): void;
    },
  ): Promise<void> {
    const attachment = await this.attachments.download(projectId, attachmentId);
    response.setHeader('Content-Type', attachment.contentType);
    response.setHeader('Content-Length', attachment.sizeBytes);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Content-Disposition', attachmentContentDisposition(attachment.originalName));
    response.send(attachment.content);
  }

  @Delete(':attachmentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('attachmentId', new ParseUUIDPipe()) attachmentId: string,
  ): Promise<void> {
    return this.attachments.delete(projectId, attachmentId);
  }
}
