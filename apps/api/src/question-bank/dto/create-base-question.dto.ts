import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

import type { BaseQuestionType } from '@project-maker/contracts';
import { baseQuestionTypeValues } from '../base-question.entity';

export class CreateBaseQuestionDto {
  @IsString()
  @MaxLength(100)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  stableKey!: string;

  @IsString()
  @MaxLength(255)
  topic!: string;

  @IsString()
  controlPoint!: string;

  @IsString()
  text!: string;

  @IsIn(baseQuestionTypeValues)
  type!: BaseQuestionType;

  @IsBoolean()
  required!: boolean;

  @IsBoolean()
  requiredForEstimate!: boolean;

  @IsBoolean()
  blocking!: boolean;

  @IsInt()
  @Min(1)
  order!: number;

  @IsBoolean()
  active!: boolean;

  @IsOptional()
  @IsString()
  hint?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ArrayUnique()
  @IsString({ each: true })
  options?: string[] | null;
}
