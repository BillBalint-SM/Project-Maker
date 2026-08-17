import {
  IsBoolean,
  IsISO8601,
  IsInt,
  IsOptional,
  Matches,
  Max,
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
}
