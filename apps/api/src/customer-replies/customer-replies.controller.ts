import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import type { CustomerCorrespondenceCommand, CustomerCorrespondenceView, CustomerReplySummary, ProjectCustomerCorrespondenceWork } from '@project-maker/contracts';

import { CustomerCorrespondenceCommandDto } from './dto/customer-correspondence-command.dto';
import { CustomerRepliesService } from './customer-replies.service';

@Controller()
export class CustomerRepliesController {
  constructor(private readonly replies: CustomerRepliesService) {}

  @Get('customer-correspondences/summary')
  summary(): Promise<CustomerReplySummary> {
    return this.replies.summary();
  }

  @Get('projects/:projectId/customer-correspondences')
  forProject(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<ProjectCustomerCorrespondenceWork> {
    return this.replies.forProject(projectId);
  }

  @Post('projects/:projectId/customer-correspondences/:correspondenceId/commands')
  command(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('correspondenceId', new ParseUUIDPipe()) correspondenceId: string,
    @Body() input: CustomerCorrespondenceCommandDto,
  ): Promise<CustomerCorrespondenceView> {
    return this.replies.command(projectId, correspondenceId, input as CustomerCorrespondenceCommand);
  }
}
