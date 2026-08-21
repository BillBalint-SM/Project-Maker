import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import { EvidenceSourceDto } from './evidence-source.dto';

const nonBlankPattern = /\S/;

export class CreateInsightDto {
  @IsString()
  @Matches(nonBlankPattern)
  @MaxLength(4000)
  statement!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  evidenceIds?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => EvidenceSourceDto)
  sources?: EvidenceSourceDto[];
}
