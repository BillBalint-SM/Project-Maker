import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, ValidateIf } from 'class-validator';

import { formalDecisionOutcomes, type FormalDecisionOutcome } from '@project-maker/contracts/decision-portfolio-runtime';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const nonBlank = /\S/;

export class CreateFormalDecisionDto {
  @IsIn([...formalDecisionOutcomes]) outcome!: FormalDecisionOutcome;
  @Matches(datePattern) decisionDate!: string;
  @IsString() @Matches(nonBlank) @MaxLength(255) decisionMaker!: string;
  @IsString() @Matches(nonBlank) @MaxLength(4000) rationale!: string;
  @ValidateIf((input: CreateFormalDecisionDto) => input.outcome === 'CONDITIONAL_GO')
  @IsString() @Matches(nonBlank) @MaxLength(4000) conditions?: string | null;
  @ValidateIf((input: CreateFormalDecisionDto) => input.outcome === 'CONDITIONAL_GO')
  @Matches(datePattern) reviewDate?: string | null;
  @IsOptional() @IsBoolean() referenceDecisionReview?: boolean;
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsUUID('4', { each: true }) insightIds?: string[];
  @IsOptional() @IsUUID('4') specificationRevisionId?: string | null;
}
