import { IsEmail, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

const nonBlankPattern = /\S/;

export class UpdateProjectBasicsDto {
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
}
