import { CustomerMailBoundaryError } from './customer-mail-boundary';

export interface MailGatewayCheckpointState {
  readonly uidValidity: string;
  readonly nextUid: number;
  readonly upperUid: number | null;
  readonly recoverySince: string | null;
}

const version = 'v2';
const maximumUid = 4_294_967_295;

/**
 * Stores IMAP progress as a versioned opaque value. It is not a credential and
 * the mailbox validates UIDVALIDITY before using it, so the value needs strict
 * shape validation rather than a second configuration secret.
 */
export class MailGatewayCheckpointCodec {
  encode(state: MailGatewayCheckpointState): string {
    requireValidState(state);
    return `${version}.${Buffer.from(JSON.stringify(state), 'utf8').toString('base64url')}`;
  }

  decode(value: string): MailGatewayCheckpointState {
    try {
      const [tokenVersion, encodedState, extra] = value.split('.');
      if (
        tokenVersion !== version ||
        !encodedState ||
        extra !== undefined ||
        !isBase64Url(encodedState)
      )
        throw invalidCheckpoint();
      if (
        Buffer.from(encodedState, 'base64url').toString('base64url') !==
        encodedState
      ) {
        throw invalidCheckpoint();
      }
      const parsed = JSON.parse(
        Buffer.from(encodedState, 'base64url').toString('utf8'),
      ) as unknown;
      requireValidState(parsed);
      return Object.freeze({ ...parsed });
    } catch (error) {
      if (error instanceof CustomerMailBoundaryError) throw error;
      throw invalidCheckpoint();
    }
  }
}

function requireValidState(
  value: unknown,
): asserts value is MailGatewayCheckpointState {
  if (!isRecord(value)) throw invalidCheckpoint();
  if (
    Object.keys(value).sort().join(',') !==
      'nextUid,recoverySince,uidValidity,upperUid' ||
    !validUidString(value.uidValidity) ||
    !validNextUid(value.nextUid) ||
    !(value.upperUid === null || validUid(value.upperUid)) ||
    (typeof value.upperUid === 'number' && value.upperUid < value.nextUid) ||
    (value.nextUid === maximumUid + 1 && value.upperUid !== null) ||
    !(value.recoverySince === null || validTimestamp(value.recoverySince))
  )
    throw invalidCheckpoint();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validUidString(value: unknown): value is string {
  if (typeof value !== 'string' || !/^[1-9]\d{0,9}$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed <= maximumUid;
}

function validUid(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    Number(value) >= 1 &&
    Number(value) <= maximumUid
  );
}

function validNextUid(value: unknown): value is number {
  return (
    Number.isSafeInteger(value) &&
    Number(value) >= 1 &&
    Number(value) <= maximumUid + 1
  );
}

function validTimestamp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function isBase64Url(value: string): boolean {
  return /^[A-Za-z0-9_-]+$/.test(value);
}

function invalidCheckpoint(): CustomerMailBoundaryError {
  return new CustomerMailBoundaryError('INVALID_CURSOR');
}
