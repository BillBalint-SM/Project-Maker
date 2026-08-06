import { IsISO8601, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { projectStatuses, type ProjectStatus } from '@project-maker/contracts/runtime';

const utcIsoDatePattern = /Z$/;
const nonBlankPattern = /\S/;
const statusValues = [...projectStatuses];

export class UpdateProjectWorkspaceDto {
  @IsOptional()
  @IsString()
  @Matches(nonBlankPattern)
  @MaxLength(255)
  ballOwner?: string | null;

  @IsOptional()
  @IsString()
  @Matches(nonBlankPattern)
  @MaxLength(10000)
  nextAction?: string | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(utcIsoDatePattern)
  dueAt?: string | null;

  @IsOptional()
  @IsIn(statusValues)
  status?: ProjectStatus;
}
