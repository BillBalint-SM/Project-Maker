import {
  ArrayNotEmpty,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

import type { BaseQuestionType } from '@project-maker/contracts';
import { baseQuestionTypeValues } from '../base-question.entity';

export class UpdateBaseQuestionDto {
  @IsUUID()
  id!: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  topic?: string;

  @IsOptional()
  @IsString()
  controlPoint?: string;

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsIn(baseQuestionTypeValues)
  type?: BaseQuestionType;

  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @IsOptional()
  @IsBoolean()
  requiredForEstimate?: boolean;

  @IsOptional()
  @IsBoolean()
  blocking?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  order?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

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
