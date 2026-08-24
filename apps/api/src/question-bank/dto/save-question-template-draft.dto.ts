import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsString, MaxLength, ValidateNested } from 'class-validator';

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
}
