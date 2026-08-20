import { Body, Controller, Get, Param, Post, Put } from '@nestjs/common';

import { PreviewHandoffDto, RetryHandoffDto, SendHandoffDto, UpdateHandoffDraftDto } from './dto/handoff-command.dto';
import { InterviewCustomerHandoffService } from './interview-customer-handoff.service';

@Controller('projects/:projectId/rounds/:roundId/customer-handoffs')
export class InterviewCustomerHandoffController {
  constructor(private readonly service: InterviewCustomerHandoffService) {}

  @Get()
  list(@Param('projectId') projectId: string, @Param('roundId') roundId: string) {
    return this.service.list(projectId, roundId);
  }

  @Get('sender-identity')
  senderIdentity(@Param('projectId') projectId: string, @Param('roundId') roundId: string) {
    return this.service.senderIdentity(projectId, roundId);
  }

  @Get(':handoffId')
  get(@Param('projectId') projectId: string, @Param('roundId') roundId: string, @Param('handoffId') handoffId: string) {
    return this.service.get(projectId, roundId, handoffId);
  }

  @Post()
  start(@Param('projectId') projectId: string, @Param('roundId') roundId: string) {
    return this.service.startDraft(projectId, roundId);
  }

  @Put(':handoffId/draft')
  updateDraft(@Param('projectId') projectId: string, @Param('roundId') roundId: string, @Param('handoffId') handoffId: string, @Body() input: UpdateHandoffDraftDto) {
    return this.service.updateDraft(projectId, roundId, handoffId, input.modificationSummary ?? null);
  }

  @Post(':handoffId/preview')
  preview(@Param('projectId') projectId: string, @Param('roundId') roundId: string, @Param('handoffId') handoffId: string, @Body() _input: PreviewHandoffDto) {
    return this.service.preview(projectId, roundId, handoffId);
  }

  @Post(':handoffId/send')
  send(@Param('projectId') projectId: string, @Param('roundId') roundId: string, @Param('handoffId') handoffId: string, @Body() input: SendHandoffDto) {
    return this.service.send(projectId, roundId, handoffId, input);
  }

  @Post(':handoffId/retry')
  retry(@Param('projectId') projectId: string, @Param('roundId') roundId: string, @Param('handoffId') handoffId: string, @Body() input: RetryHandoffDto) {
    return this.service.retry(projectId, roundId, handoffId, input.acknowledgeDuplicateRisk === true);
  }

  @Post(':handoffId/resume-editing')
  resumeEditing(@Param('projectId') projectId: string, @Param('roundId') roundId: string, @Param('handoffId') handoffId: string) {
    return this.service.resumeEditing(projectId, roundId, handoffId);
  }
}
