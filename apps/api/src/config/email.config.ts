import type { ConfigService } from '@nestjs/config';

export interface SmtpConfiguration {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly username: string | null;
  readonly password: string | null;
  readonly from: string;
  readonly timeoutMs: number;
}

/**
 * Returns null when SMTP is intentionally not configured. Partial credentials
 * are treated as unavailable so the timer cannot repeatedly attempt a broken
 * transport. No secret value is included in validation errors.
 */
export function createSmtpConfiguration(
  configService: ConfigService,
): SmtpConfiguration | null {
  const host = normalize(configService.get<string>('SMTP_HOST'));
  const from = normalize(configService.get<string>('SMTP_FROM'));
  if (!host || !from) {
    return null;
  }

  const port = parsePort(configService.get<string>('SMTP_PORT'));
  const secure = parseBoolean(configService.get<string>('SMTP_SECURE'), false, 'SMTP_SECURE');
  const username = normalize(configService.get<string>('SMTP_USER'));
  const password = configService.get<string>('SMTP_PASSWORD') ?? '';
  const hasUsername = username !== null;
  const hasPassword = password.length > 0;
  if (hasUsername !== hasPassword) {
    return null;
  }
  if (hasUsername && !secure) {
    throw new Error('SMTP_SECURE must be true when SMTP_USER and SMTP_PASSWORD are configured.');
  }

  return {
    host,
    port,
    secure,
    username,
    password: hasPassword ? password : null,
    from,
    timeoutMs: 10_000,
  };
}

function normalize(value: string | undefined): string | null {
  const normalized = value?.trim() ?? '';
  return normalized.length === 0 ? null : normalized;
}

function parsePort(value: string | undefined): number {
  const raw = value?.trim() ?? '';
  const parsed = raw.length === 0 ? 587 : Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65_535) {
    throw new Error('SMTP_PORT must be an integer between 1 and 65535.');
  }
  return parsed;
}

function parseBoolean(value: string | undefined, fallback: boolean, field: string): boolean {
  const raw = value?.trim().toLowerCase() ?? '';
  if (raw.length === 0) {
    return fallback;
  }
  if (raw === 'true') {
    return true;
  }
  if (raw === 'false') {
    return false;
  }
  throw new Error(`${field} must be true or false.`);
}
