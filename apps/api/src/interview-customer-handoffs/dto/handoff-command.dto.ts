import { IsBoolean, IsInt, IsOptional, IsString, Length, Matches, Min } from 'class-validator';

export class UpdateHandoffDraftDto {
  @IsOptional()
  @IsString()
  @Length(1, 2_000)
  modificationSummary?: string | null;
}

export class SendHandoffDto {
  @IsInt()
  @Min(1)
  sourceContentVersion!: number;

  @IsString()
  @Matches(/^[a-f0-9]{64}$/)
  previewDigest!: string;
}

export class RetryHandoffDto {
  @IsOptional()
  @IsBoolean()
  acknowledgeDuplicateRisk?: boolean;
}
