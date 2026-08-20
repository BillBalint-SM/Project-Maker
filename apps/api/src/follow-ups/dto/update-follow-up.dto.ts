import {
  IsBoolean,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const utcIsoDatePattern = /Z$/;

export const minimumFollowUpIntervalMinutes = 1;
export const maximumFollowUpIntervalMinutes = 525_600;

export class UpdateFollowUpDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(minimumFollowUpIntervalMinutes)
  @Max(maximumFollowUpIntervalMinutes)
  intervalMinutes?: number;

  @IsOptional()
  @ValidateIf((value: UpdateFollowUpDto) => value.expiresAt !== null)
  @IsISO8601({ strict: true })
  @Matches(utcIsoDatePattern)
  expiresAt?: string | null;
}

export class SendFollowUpPingDto {
  @IsString()
  @MaxLength(200)
  previewToken!: string;

  @IsOptional()
  @IsUUID()
  acknowledgeDuplicateRiskForAttemptId?: string;
}

export class RetryFollowUpPingDto {
  @IsUUID()
  attemptId!: string;

  @IsOptional()
  @IsBoolean()
  acknowledgeDuplicateRisk?: boolean;
}

export class PreviewFollowUpPingDto {
  @IsInt()
  @Min(1)
  expectedVersion!: number;

}

export const customerFollowUpDraftMaxLength = 10_000;

export class UpdateFollowUpDraftDto {
  @IsString()
  @MaxLength(customerFollowUpDraftMaxLength)
  messageDraft!: string;

  @ValidateIf((value: UpdateFollowUpDraftDto) => value.referencedFollowUpId !== null)
  @IsUUID()
  referencedFollowUpId!: string | null;

  @IsInt()
  @Min(1)
  expectedVersion!: number;
}
