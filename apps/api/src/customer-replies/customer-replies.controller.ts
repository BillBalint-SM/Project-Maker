import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import type { CustomerReplySummary, ProjectCustomerCorrespondenceWork } from '@project-maker/contracts';

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
}
