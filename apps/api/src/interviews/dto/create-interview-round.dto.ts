import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import type { InterviewRoundType } from '@project-maker/contracts';
import { interviewRoundTypeValues } from '../interview-round.entity';

export class CreateInterviewRoundDto {
  @IsIn(interviewRoundTypeValues)
  type!: InterviewRoundType;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(30)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  selectedStableKeys?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => AdHocRoundQuestionDto)
  adHocQuestions?: AdHocRoundQuestionDto[];
}

class AdHocRoundQuestionDto {
  @IsString()
  @Matches(/\S/)
  @MaxLength(2000)
  text!: string;

  @IsString()
  @Matches(/\S/)
  @MaxLength(255)
  topic!: string;
}
