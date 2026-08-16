import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import type { CreateMarkdownTemplateInput } from '@project-maker/contracts';

export class CreateMarkdownTemplateDto implements CreateMarkdownTemplateInput {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100_000)
  draftContent!: string;
}
