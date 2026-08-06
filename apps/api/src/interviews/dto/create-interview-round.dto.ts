import { IsIn } from 'class-validator';

import type { InterviewRoundType } from '@project-maker/contracts';
import { interviewRoundTypeValues } from '../interview-round.entity';

export class CreateInterviewRoundDto {
  @IsIn(interviewRoundTypeValues)
  type!: InterviewRoundType;
}
