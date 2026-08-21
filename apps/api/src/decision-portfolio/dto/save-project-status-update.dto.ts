import { IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { projectHealthValues, type ProjectHealth } from '@project-maker/contracts/decision-portfolio-runtime';

const nonBlank = /\S/;

export class SaveProjectStatusUpdateDto {
  @IsIn([...projectHealthValues]) health!: ProjectHealth;
  @IsString() @Matches(nonBlank) @MaxLength(2000) summary!: string;
  @IsOptional() @IsString() @Matches(nonBlank) @MaxLength(4000) changes?: string | null;
  @IsOptional() @IsString() @Matches(nonBlank) @MaxLength(4000) risks?: string | null;
  @IsString() @Matches(nonBlank) @MaxLength(2000) nextStep!: string;
}
