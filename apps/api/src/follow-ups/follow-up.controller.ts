import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import type {
  CorrespondenceMailboxIdentity,
  CustomerFollowUpReferenceOption,
  CustomerFollowUpPingDelivery,
  CustomerFollowUpPingPreview,
  CustomerFollowUpState,
} from '@project-maker/contracts';

import {
  SendFollowUpPingDto,
  RetryFollowUpPingDto,
  PreviewFollowUpPingDto,
  UpdateFollowUpDraftDto,
  UpdateFollowUpDto,
} from './dto/update-follow-up.dto';
import { CustomerFollowUpService } from './follow-up.service';

@Controller('projects/:projectId')
export class CustomerFollowUpController {
  constructor(private readonly customerFollowUpService: CustomerFollowUpService) {}

  @Get('follow-up')
  getFollowUp(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<CustomerFollowUpState> {
    return this.customerFollowUpService.get(projectId);
  }

  @Patch('follow-up')
  updateFollowUp(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: UpdateFollowUpDto,
  ): Promise<CustomerFollowUpState> {
    return this.customerFollowUpService.update(projectId, input);
  }

  @Get('follow-up/reference-options')
  listReferenceOptions(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<readonly CustomerFollowUpReferenceOption[]> {
    return this.customerFollowUpService.listReferenceOptions(projectId);
  }

  @Get('follow-up/sender-identity')
  senderIdentity(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<CorrespondenceMailboxIdentity> {
    return this.customerFollowUpService.senderIdentity(projectId);
  }

  @Patch('follow-up/draft')
  updateFollowUpDraft(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: UpdateFollowUpDraftDto,
  ): Promise<CustomerFollowUpState> {
    return this.customerFollowUpService.updateDraft(projectId, input);
  }

  @Post('follow-up/ping')
  sendFollowUpPing(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: SendFollowUpPingDto,
  ): Promise<CustomerFollowUpPingDelivery> {
    return this.customerFollowUpService.sendManualPing(projectId, input);
  }

  @Post('follow-up/ping/preview')
  previewFollowUpPing(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: PreviewFollowUpPingDto,
  ): Promise<CustomerFollowUpPingPreview> {
    return this.customerFollowUpService.previewManualPing(projectId, input);
  }

  @Post('follow-up/ping/retry')
  retryFollowUpPing(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: RetryFollowUpPingDto,
  ): Promise<CustomerFollowUpPingDelivery> {
    return this.customerFollowUpService.retryManualPing(projectId, input);
  }
}
