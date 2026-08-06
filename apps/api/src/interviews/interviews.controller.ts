import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Res } from '@nestjs/common';
import type { InterviewRound, RoundQuestionSnapshot } from '@project-maker/contracts';

import { CreateInterviewRoundDto } from './dto/create-interview-round.dto';
import { UpdateRoundAnswerDto } from './dto/update-round-answer.dto';
import { InterviewsService } from './interviews.service';

@Controller('projects/:projectId/rounds')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Get('active')
  async getActiveRound(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Res()
    response: { status(code: number): { json(value: InterviewRound | null): void } },
  ): Promise<void> {
    const activeRound = await this.interviewsService.getActiveInitialIntake(projectId);
    response.status(200).json(activeRound);
  }

  @Post()
  createRound(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Body() input: CreateInterviewRoundDto,
  ): Promise<InterviewRound> {
    return this.interviewsService.createRound(projectId, input);
  }

  @Patch(':roundId/answers/:snapshotId')
  updateAnswer(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
    @Param('snapshotId', new ParseUUIDPipe()) snapshotId: string,
    @Body() input: UpdateRoundAnswerDto,
  ): Promise<RoundQuestionSnapshot> {
    return this.interviewsService.updateAnswer(projectId, roundId, snapshotId, input);
  }

  @Post(':roundId/complete')
  completeRound(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
  ): Promise<InterviewRound> {
    return this.interviewsService.completeRound(projectId, roundId);
  }
}
