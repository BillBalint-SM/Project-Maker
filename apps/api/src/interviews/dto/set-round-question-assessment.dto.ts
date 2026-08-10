import { IsString, MaxLength, ValidateIf } from 'class-validator';

import type { SetRoundQuestionAssessmentInput } from '@project-maker/contracts';

import { assessmentRationaleMaxLength } from '../round-question-assessment';

export class SetRoundQuestionAssessmentDto implements SetRoundQuestionAssessmentInput {
  @IsString()
  @MaxLength(100)
  status!: string;

  @ValidateIf((_input, value) => value !== null)
  @IsString()
  @MaxLength(assessmentRationaleMaxLength)
  rationale!: string | null;
}
