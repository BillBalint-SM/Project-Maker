import { IsEmail, IsNotEmpty, IsOptional, IsString, Matches, MaxLength } from 'class-validator';

const nonBlankPattern = /\S/;

export class SaveProjectContactDto {
  @IsString()
  @IsNotEmpty()
  @Matches(nonBlankPattern)
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(320)
  email?: string | null;

  @IsOptional()
  @IsString()
  @Matches(nonBlankPattern)
  @MaxLength(100)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @Matches(nonBlankPattern)
  @MaxLength(2000)
  note?: string | null;
}
