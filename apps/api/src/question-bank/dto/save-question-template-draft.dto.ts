import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsOptional, IsString, IsUUID, MaxLength, ValidateNested } from 'class-validator';

import { ProjectSchemaQuestionDto } from './publish-project-question-schema.dto';

export class SaveQuestionTemplateDraftDto {
  @IsString()
  @MaxLength(255)
  name!: string;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ProjectSchemaQuestionDto)
  questions!: ProjectSchemaQuestionDto[];

  @IsOptional()
  @IsUUID('4')
  focusedProjectId?: string | null;
}
