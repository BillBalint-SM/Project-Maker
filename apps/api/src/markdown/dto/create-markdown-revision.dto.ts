import { IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength } from 'class-validator';

import type { CreateMarkdownRevisionInput, MarkdownRevisionReason } from '@project-maker/contracts';

import { markdownRevisionReasonValues } from '../markdown-revision.entity';

const nonBlankPattern = /\S/;

export class CreateMarkdownRevisionDto implements CreateMarkdownRevisionInput {
  @IsIn(markdownRevisionReasonValues)
  reason!: MarkdownRevisionReason;

  @IsOptional()
  @IsString()
  @Matches(nonBlankPattern)
  @MaxLength(255)
  milestone?: string | null;

  @IsOptional()
  @IsUUID()
  templateId?: string | null;
}
