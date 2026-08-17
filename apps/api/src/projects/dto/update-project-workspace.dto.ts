import { IsISO8601, IsIn, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import {
  nextActionOwnerRoles,
  projectStatuses,
  type NextActionOwnerRole,
  type ProjectStatus,
} from '@project-maker/contracts/runtime';

const utcIsoDatePattern = /Z$/;
const nonBlankPattern = /\S/;
const statusValues = [...projectStatuses];

export class UpdateProjectWorkspaceDto {
  @IsOptional()
  @IsString()
  @Matches(nonBlankPattern)
  @MaxLength(255)
  internalOwnerName?: string | null;

  @IsOptional()
  @IsIn([...nextActionOwnerRoles])
  nextActionOwnerRole?: NextActionOwnerRole | null;

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
