import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import type { CustomerFollowUpState } from '@project-maker/contracts';

import {
  SendFollowUpPingDto,
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

  @Post('follow-up/ping')
  sendFollowUpPing(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: SendFollowUpPingDto,
  ): Promise<CustomerFollowUpState> {
    return this.customerFollowUpService.sendManualPing(projectId, input);
  }
}
