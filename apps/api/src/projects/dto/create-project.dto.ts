import { IsEmail, IsISO8601, IsIn, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

import { nextActionOwnerRoles, type NextActionOwnerRole } from '@project-maker/contracts/runtime';

const utcIsoDatePattern = /Z$/;
const nonBlankPattern = /\S/;

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @Matches(nonBlankPattern)
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(nonBlankPattern)
  @MaxLength(255)
  customerContactName!: string;

  @IsEmail()
  @MaxLength(320)
  customerContactEmail!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(nonBlankPattern)
  @MaxLength(255)
  internalOwnerName!: string;

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
}
