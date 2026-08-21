import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, IsString, IsUUID, Matches, MaxLength, Min } from 'class-validator';

const nonBlankPattern = /\S/;

export class UpdateInsightDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

  @IsString()
  @Matches(nonBlankPattern)
  @MaxLength(4000)
  statement!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @IsUUID('4', { each: true })
  evidenceIds!: string[];
}
