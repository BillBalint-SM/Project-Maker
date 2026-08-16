import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { UpdateMarkdownTemplateDraftInput } from '@project-maker/contracts';

export class UpdateMarkdownTemplateDraftDto implements UpdateMarkdownTemplateDraftInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100_000)
  draftContent!: string;
}
