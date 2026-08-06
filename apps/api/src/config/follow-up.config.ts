import type { ConfigService } from '@nestjs/config';

export interface FollowUpConfiguration {
  readonly pollIntervalMs: number;
}

const minimumPollIntervalMs = 5_000;
const maximumPollIntervalMs = 86_400_000;

export function createFollowUpConfiguration(
  configService: ConfigService,
): FollowUpConfiguration {
  const raw = configService.get<string>('FOLLOW_UP_POLL_INTERVAL_MS')?.trim() ?? '';
  const parsed = raw.length === 0 ? 60_000 : Number(raw);
  if (
    !Number.isInteger(parsed) ||
    parsed < minimumPollIntervalMs ||
    parsed > maximumPollIntervalMs
  ) {
    throw new Error(
      `FOLLOW_UP_POLL_INTERVAL_MS must be an integer from ${minimumPollIntervalMs} to ${maximumPollIntervalMs}.`,
    );
  }
  return { pollIntervalMs: parsed };
}
