import type { ConfigService } from '@nestjs/config';

export const mailGatewaySecurityProfiles = [
  'STARTTLS_REQUIRED',
  'IMPLICIT_TLS',
] as const;

export type MailGatewaySecurityProfile =
  (typeof mailGatewaySecurityProfiles)[number];

export interface MailGatewayChannelConfiguration {
  readonly host: string;
  readonly port: number;
  readonly security: MailGatewaySecurityProfile;
  readonly username: string;
  readonly password: string;
}

export interface MailGatewayConfiguration {
  readonly mailbox: {
    readonly name: string;
    readonly address: string;
  };
  readonly smtp: MailGatewayChannelConfiguration;
  readonly imap: MailGatewayChannelConfiguration & { readonly folder: string };
  readonly checkpointSecret: string;
  readonly tlsCaCertificate: string | null;
  readonly timeoutMs: number;
}

/**
 * Returns null for missing, partial, or unsafe mail configuration. Mail features
 * therefore fail closed without preventing unrelated Project work from starting.
 * Secret values and provider diagnostics are deliberately never included in an
 * exception or log message.
 */
export function createMailGatewayConfiguration(
  config: ConfigService,
): MailGatewayConfiguration | null {
  const mailboxName = normalized(config.get<string>('CORRESPONDENCE_MAILBOX_NAME'));
  const mailboxAddress = normalized(config.get<string>('CORRESPONDENCE_MAILBOX_ADDRESS'));
  const checkpointSecret = config.get<string>('MAIL_GATEWAY_CHECKPOINT_SECRET') ?? '';
  const smtp = channel(config, 'SMTP');
  const imapChannel = channel(config, 'IMAP');
  const folder = normalized(config.get<string>('MAIL_GATEWAY_IMAP_FOLDER')) ?? 'INBOX';
  const tlsCaCertificate = optionalCertificate(
    config.get<string>('MAIL_GATEWAY_TLS_CA_CERTIFICATE_BASE64'),
  );

  if (
    !safeMailboxName(mailboxName)
    || !safeEmailAddress(mailboxAddress)
    || !smtp
    || !imapChannel
    || !safeFolder(folder)
    || Buffer.byteLength(checkpointSecret, 'utf8') < 32
    || tlsCaCertificate === undefined
  ) {
    return null;
  }

  return Object.freeze({
    mailbox: Object.freeze({ name: mailboxName, address: mailboxAddress }),
    smtp,
    imap: Object.freeze({ ...imapChannel, folder }),
    checkpointSecret,
    tlsCaCertificate,
    timeoutMs: 10_000,
  });
}

function channel(
  config: ConfigService,
  channelName: 'SMTP' | 'IMAP',
): MailGatewayChannelConfiguration | null {
  const prefix = `MAIL_GATEWAY_${channelName}`;
  const host = normalized(config.get<string>(`${prefix}_HOST`));
  const security = securityProfile(config.get<string>(`${prefix}_SECURITY`));
  const username = normalized(config.get<string>(`${prefix}_USERNAME`));
  const password = config.get<string>(`${prefix}_PASSWORD`) ?? '';
  if (!host || !safeHost(host) || !security || !username || password.length === 0) {
    return null;
  }
  const port = portNumber(
    config.get<string>(`${prefix}_PORT`),
    defaultPort(channelName, security),
  );
  return port === null
    ? null
    : Object.freeze({ host, port, security, username, password });
}

function securityProfile(value: string | undefined): MailGatewaySecurityProfile | null {
  const candidate = value?.trim().toUpperCase() ?? '';
  return mailGatewaySecurityProfiles.includes(candidate as MailGatewaySecurityProfile)
    ? candidate as MailGatewaySecurityProfile
    : null;
}

function defaultPort(
  channel: 'SMTP' | 'IMAP',
  security: MailGatewaySecurityProfile,
): number {
  if (channel === 'SMTP') return security === 'IMPLICIT_TLS' ? 465 : 587;
  return security === 'IMPLICIT_TLS' ? 993 : 143;
}

function portNumber(value: string | undefined, fallback: number): number | null {
  const raw = value?.trim() ?? '';
  const parsed = raw.length === 0 ? fallback : Number(raw);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 65_535
    ? parsed
    : null;
}

function optionalCertificate(value: string | undefined): string | null | undefined {
  const encoded = value?.trim() ?? '';
  if (encoded.length === 0) return null;
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
    return undefined;
  }
  const decoded = Buffer.from(encoded, 'base64').toString('utf8').trim();
  return /^-----BEGIN CERTIFICATE-----\r?\n[\s\S]+\r?\n-----END CERTIFICATE-----$/.test(decoded)
    ? decoded
    : undefined;
}

function normalized(value: string | undefined): string | null {
  const result = value?.trim() ?? '';
  return result.length > 0 ? result : null;
}

function safeHost(value: string): boolean {
  return value.length <= 253
    && !/[\s/\\@]/.test(value)
    && !value.includes('://');
}

function safeEmailAddress(value: string | null): value is string {
  return value !== null
    && value.length <= 320
    && !/[\r\n<>]/.test(value)
    && /^[^@\s]+@[^@\s]+$/.test(value);
}

function safeMailboxName(value: string | null): value is string {
  return value !== null
    && value.length <= 255
    && !/[\r\n\0]/.test(value);
}

function safeFolder(value: string): boolean {
  return value.length <= 255 && !/[\r\n\0]/.test(value);
}
