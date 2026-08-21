import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class SaveRoadmapGroupDto {
  @IsString() @Matches(/\S/) @MaxLength(255) name!: string;
  @IsOptional() @IsString() @Matches(/\S/) @MaxLength(2000) description?: string | null;
}
