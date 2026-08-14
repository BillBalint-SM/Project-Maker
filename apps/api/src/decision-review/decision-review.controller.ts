import { Body, Controller, Get, Param, ParseUUIDPipe, Put } from '@nestjs/common';
import type { ProjectDecisionReview, UpdateDecisionReviewInput } from '@project-maker/contracts';

import { UpdateDecisionReviewDto } from './dto/update-decision-review.dto';
import { DecisionReviewService } from './decision-review.service';

@Controller('projects/:projectId')
export class DecisionReviewController {
  constructor(private readonly decisionReviewService: DecisionReviewService) {}

  @Get('decision-review')
  getReview(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<ProjectDecisionReview> {
    return this.decisionReviewService.getReview(projectId);
  }

  @Put('decision-review')
  updateReview(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: UpdateDecisionReviewDto,
  ): Promise<ProjectDecisionReview> {
    return this.decisionReviewService.updateReview(projectId, input as UpdateDecisionReviewInput);
  }
}
