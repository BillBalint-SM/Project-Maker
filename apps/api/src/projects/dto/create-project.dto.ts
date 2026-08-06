import { IsEmail, IsISO8601, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

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
}
