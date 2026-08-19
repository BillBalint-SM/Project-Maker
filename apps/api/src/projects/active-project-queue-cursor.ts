import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from 'node:crypto';

const formatVersion = 1;
const nonceLength = 12;
const authenticationTagLength = 16;
const processFallbackKey = randomBytes(32);

@Injectable()
export class ActiveProjectQueueCursorCodec {
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const configuredSecret = config.get<string>('ACTIVE_PROJECT_QUEUE_CURSOR_SECRET')?.trim();
    if (configuredSecret && Buffer.byteLength(configuredSecret, 'utf8') < 32) {
      throw new Error('ACTIVE_PROJECT_QUEUE_CURSOR_SECRET must contain at least 32 bytes.');
    }
    if (!configuredSecret && config.get<string>('NODE_ENV') === 'production') {
      throw new Error('ACTIVE_PROJECT_QUEUE_CURSOR_SECRET is required in production.');
    }
    this.key = configuredSecret
      ? createHash('sha256').update(configuredSecret, 'utf8').digest()
      : processFallbackKey;
  }

  seal(value: unknown): string {
    const nonce = randomBytes(nonceLength);
    const cipher = createCipheriv('aes-256-gcm', this.key, nonce);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(value), 'utf8'),
      cipher.final(),
    ]);
    return Buffer.concat([
      Buffer.from([formatVersion]),
      nonce,
      cipher.getAuthTag(),
      ciphertext,
    ]).toString('base64url');
  }

  open(raw: string): unknown {
    const token = Buffer.from(raw, 'base64url');
    if (token.length <= 1 + nonceLength + authenticationTagLength || token[0] !== formatVersion) {
      throw new TypeError('Invalid cursor envelope.');
    }
    const nonceStart = 1;
    const tagStart = nonceStart + nonceLength;
    const ciphertextStart = tagStart + authenticationTagLength;
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      token.subarray(nonceStart, tagStart),
    );
    decipher.setAuthTag(token.subarray(tagStart, ciphertextStart));
    const plaintext = Buffer.concat([
      decipher.update(token.subarray(ciphertextStart)),
      decipher.final(),
    ]).toString('utf8');
    return JSON.parse(plaintext) as unknown;
  }
}
