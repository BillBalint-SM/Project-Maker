import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Res,
} from '@nestjs/common';
import type { InterviewRound, RoundQuestionSnapshot } from '@project-maker/contracts';

import { CreateInterviewRoundDto } from './dto/create-interview-round.dto';
import { SetRoundQuestionAssessmentDto } from './dto/set-round-question-assessment.dto';
import { UpdateRoundAnswerDto } from './dto/update-round-answer.dto';
import { InterviewsService } from './interviews.service';

@Controller('projects/:projectId/rounds')
export class InterviewsController {
  constructor(private readonly interviewsService: InterviewsService) {}

  @Get()
  list(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
  ): Promise<readonly InterviewRound[]> {
    return this.interviewsService.list(projectId);
  }

  @Get('active')
  async getActiveRound(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Res()
    response: { status(code: number): { json(value: InterviewRound | null): void } },
  ): Promise<void> {
    const activeRound = await this.interviewsService.getActiveInitialIntake(projectId);
    response.status(200).json(activeRound);
  }

  @Get(':roundId')
  getRound(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
  ): Promise<InterviewRound> {
    return this.interviewsService.getRound(projectId, roundId);
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

  @Put(':roundId/answers/:snapshotId/assessment')
  @HttpCode(HttpStatus.OK)
  setAssessment(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
    @Param('snapshotId', new ParseUUIDPipe()) snapshotId: string,
    @Body() input: SetRoundQuestionAssessmentDto,
  ): Promise<RoundQuestionSnapshot> {
    return this.interviewsService.setAssessment(projectId, roundId, snapshotId, input);
  }

  @Delete(':roundId/answers/:snapshotId/assessment')
  @HttpCode(HttpStatus.OK)
  resetAssessment(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
    @Param('snapshotId', new ParseUUIDPipe()) snapshotId: string,
  ): Promise<RoundQuestionSnapshot> {
    return this.interviewsService.resetAssessment(projectId, roundId, snapshotId);
  }

  @Post(':roundId/complete')
  completeRound(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
  ): Promise<InterviewRound> {
    return this.interviewsService.finishRound(projectId, roundId);
  }

  @Post(':roundId/finish')
  finishRound(
    @Param('projectId', new ParseUUIDPipe()) projectId: string,
    @Param('roundId', new ParseUUIDPipe()) roundId: string,
  ): Promise<InterviewRound> {
    return this.interviewsService.finishRound(projectId, roundId);
  }
}
