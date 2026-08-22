import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { GitAuthenticationMode, GitCredentialInput } from '@project-maker/contracts';

export interface StoredGitCredential {
  readonly mode: GitAuthenticationMode;
  readonly username: string | null;
  readonly accessToken: string | null;
  readonly privateKey: string | null;
  readonly passphrase: string | null;
}

@Injectable()
export class CredentialCrypto {
  constructor(private readonly config: ConfigService) {}

  encrypt(mode: GitAuthenticationMode, username: string | null, input: GitCredentialInput): string {
    const credential = normalizeCredential(mode, username, input);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const ciphertext = Buffer.concat([
      cipher.update(JSON.stringify(credential), 'utf8'),
      cipher.final(),
    ]);
    return [iv, cipher.getAuthTag(), ciphertext].map((value) => value.toString('base64url')).join('.');
  }

  decrypt(value: string): StoredGitCredential {
    try {
      const [iv, tag, ciphertext] = value.split('.').map((item) => Buffer.from(item ?? '', 'base64url'));
      if (!iv || !tag || !ciphertext || iv.length !== 12 || tag.length !== 16) throw new Error('invalid envelope');
      const decipher = createDecipheriv('aes-256-gcm', this.key(), iv);
      decipher.setAuthTag(tag);
      return JSON.parse(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')) as StoredGitCredential;
    } catch {
      throw new InternalServerErrorException('The stored Git credential cannot be decrypted with the configured application key.');
    }
  }

  private key(): Buffer {
    const secret = this.config.get<string>('GIT_CREDENTIAL_ENCRYPTION_KEY') ?? '';
    if (secret.length < 32) {
      throw new InternalServerErrorException('The Git credential encryption key is not configured.');
    }
    return createHash('sha256').update(secret, 'utf8').digest();
  }
}

function normalizeCredential(
  mode: GitAuthenticationMode,
  username: string | null,
  input: GitCredentialInput,
): StoredGitCredential {
  const accessToken = clean(input.accessToken);
  const privateKey = clean(input.privateKey);
  const passphrase = clean(input.passphrase);
  if (mode === 'HTTPS_TOKEN' && !accessToken) {
    throw new BadRequestException('An access token is required for an HTTPS Git setup.');
  }
  if (mode === 'SSH_KEY' && !privateKey) {
    throw new BadRequestException('A private key is required for an SSH Git setup.');
  }
  return {
    mode,
    username,
    accessToken: mode === 'HTTPS_TOKEN' ? accessToken : null,
    privateKey: mode === 'SSH_KEY' ? privateKey : null,
    passphrase: mode === 'SSH_KEY' ? passphrase : null,
  };
}

function clean(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}
