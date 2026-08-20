import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

import { CustomerMailBoundaryError } from './customer-mail-boundary';

export interface MailGatewayCheckpointState {
  readonly uidValidity: string;
  readonly nextUid: number;
  readonly upperUid: number | null;
  readonly recoverySince: string | null;
}

interface MailGatewayCheckpointContext {
  readonly secret: string;
  readonly mailboxAddress: string;
  readonly folder: string;
}

const version = 'v1';
const maximumUid = 4_294_967_295;

/**
 * Seals IMAP progress so persisted checkpoints remain restart-safe without
 * exposing mailbox implementation details. AES-GCM authenticates both the
 * state and its mailbox/folder context.
 */
export class MailGatewayCheckpointCodec {
  private readonly key: Buffer;
  private readonly additionalAuthenticatedData: Buffer;

  constructor(context: MailGatewayCheckpointContext) {
    this.key = createHash('sha256').update(context.secret, 'utf8').digest();
    this.additionalAuthenticatedData = Buffer.from(
      `${version}\0${context.mailboxAddress.trim().toLowerCase()}\0${context.folder}`,
      'utf8',
    );
  }

  encode(state: MailGatewayCheckpointState): string {
    requireValidState(state);
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    cipher.setAAD(this.additionalAuthenticatedData);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(state), 'utf8'),
      cipher.final(),
    ]);
    return [
      version,
      nonce.toString('base64url'),
      ciphertext.toString('base64url'),
      cipher.getAuthTag().toString('base64url'),
    ].join('.');
  }

  decode(value: string): MailGatewayCheckpointState {
    try {
      const [tokenVersion, encodedNonce, encodedCiphertext, encodedTag, extra] = value.split('.');
      if (
        tokenVersion !== version
        || !encodedNonce
        || !encodedCiphertext
        || !encodedTag
        || extra !== undefined
        || !isBase64Url(encodedNonce)
        || !isBase64Url(encodedCiphertext)
        || !isBase64Url(encodedTag)
      ) throw invalidCheckpoint();
      const nonce = Buffer.from(encodedNonce, 'base64url');
      const ciphertext = Buffer.from(encodedCiphertext, 'base64url');
      const tag = Buffer.from(encodedTag, 'base64url');
      if (nonce.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
        throw invalidCheckpoint();
      }
      const decipher = createDecipheriv('aes-256-gcm', this.key, nonce);
      decipher.setAAD(this.additionalAuthenticatedData);
      decipher.setAuthTag(tag);
      const parsed = JSON.parse(Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8')) as unknown;
      requireValidState(parsed);
      return Object.freeze({ ...parsed });
    } catch (error) {
      if (error instanceof CustomerMailBoundaryError) throw error;
      throw invalidCheckpoint();
    }
  }
}

function requireValidState(value: unknown): asserts value is MailGatewayCheckpointState {
  if (!isRecord(value)) throw invalidCheckpoint();
  if (
    Object.keys(value).sort().join(',') !== 'nextUid,recoverySince,uidValidity,upperUid'
    || !validUidString(value.uidValidity)
    || !validNextUid(value.nextUid)
    || !(value.upperUid === null || validUid(value.upperUid))
    || (typeof value.upperUid === 'number' && value.upperUid < value.nextUid)
    || (value.nextUid === maximumUid + 1 && value.upperUid !== null)
    || !(value.recoverySince === null || validTimestamp(value.recoverySince))
  ) throw invalidCheckpoint();
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
  return Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= maximumUid;
}

function validNextUid(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 1 && Number(value) <= maximumUid + 1;
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
