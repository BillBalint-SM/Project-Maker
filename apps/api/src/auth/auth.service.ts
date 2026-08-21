import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { McpConnectionStatus, McpConnectionToken } from '@project-maker/contracts';
import { createHash, randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { MoreThan, Repository } from 'typeorm';

import type { InternalUserView } from './auth-request';
import { InternalUserSession } from './internal-user-session.entity';
import { InternalUser } from './internal-user.entity';

const derivePassword = promisify(scrypt);
const sessionLifetimeMilliseconds = 7 * 24 * 60 * 60 * 1000;
const rateLimitWindowMilliseconds = 10 * 60 * 1000;
const rateLimitMaximum = 10;

export interface AuthResult {
  readonly token: string;
  readonly user: InternalUserView;
}

@Injectable()
export class AuthService {
  private readonly attempts = new Map<string, readonly number[]>();

  constructor(
    @InjectRepository(InternalUser)
    private readonly users: Repository<InternalUser>,
    @InjectRepository(InternalUserSession)
    private readonly sessions: Repository<InternalUserSession>,
  ) {}

  async signUp(email: string, password: string): Promise<AuthResult> {
    const normalizedEmail = normalizeEmail(email);
    this.assertRateLimit(`signup:${normalizedEmail}`);
    if (await this.users.existsBy({ email: normalizedEmail })) {
      throw new ConflictException('Ehhez az e-mail-címhez már tartozik fiók.');
    }

    const user = await this.users.save({
      id: randomUUID(),
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      active: true,
      deactivatedAt: null,
    });
    this.attempts.delete(`signup:${normalizedEmail}`);
    return this.createSession(user);
  }

  async login(email: string, password: string): Promise<AuthResult> {
    return this.authenticate('login', email, password, false);
  }

  async restore(email: string, password: string): Promise<AuthResult> {
    const result = await this.authenticate('restore', email, password, true);
    await this.users.update(result.user.id, { active: true, deactivatedAt: null });
    return result;
  }

  async resolveSession(token: string): Promise<InternalUserView | null> {
    const tokenDigest = digestToken(token);
    const session = await this.sessions.findOne({
      where: { tokenDigest, expiresAt: MoreThan(new Date()) },
    });
    if (!session) {
      return null;
    }

    const user = await this.users.findOneBy({ id: session.userId, active: true });
    if (!user) {
      await this.sessions.delete({ tokenDigest });
      return null;
    }
    return toView(user);
  }

  async logout(token: string): Promise<void> {
    await this.sessions.delete({ tokenDigest: digestToken(token) });
  }

  async mcpConnectionStatus(userId: string): Promise<McpConnectionStatus> {
    const user = await this.users.findOneByOrFail({ id: userId, active: true });
    return {
      configured: user.mcpTokenDigest !== null,
      createdAt: user.mcpTokenCreatedAt?.toISOString() ?? null,
    };
  }

  async createMcpConnection(userId: string): Promise<McpConnectionToken> {
    const user = await this.users.findOneByOrFail({ id: userId, active: true });
    const token = `pm_mcp_${randomBytes(32).toString('base64url')}`;
    const createdAt = new Date();
    user.mcpTokenDigest = digestToken(token);
    user.mcpTokenCreatedAt = createdAt;
    await this.users.save(user);
    return { token, createdAt: createdAt.toISOString() };
  }

  async revokeMcpConnection(userId: string): Promise<void> {
    await this.users.update(
      { id: userId, active: true },
      { mcpTokenDigest: null, mcpTokenCreatedAt: null },
    );
  }

  async resolveMcpToken(token: string): Promise<InternalUserView | null> {
    const user = await this.users.findOneBy({
      mcpTokenDigest: digestToken(token),
      active: true,
    });
    return user ? toView(user) : null;
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<AuthResult> {
    const user = await this.users.findOneByOrFail({ id: userId, active: true });
    if (!(await passwordMatches(currentPassword, user.passwordHash))) {
      throw new UnauthorizedException('A jelenlegi jelszó nem megfelelő.');
    }

    user.passwordHash = await hashPassword(newPassword);
    await this.users.save(user);
    await this.sessions.delete({ userId });
    return this.createSession(user);
  }

  async deactivate(userId: string): Promise<void> {
    await this.users.update(userId, {
      active: false,
      deactivatedAt: new Date(),
      mcpTokenDigest: null,
      mcpTokenCreatedAt: null,
    });
    await this.sessions.delete({ userId });
  }

  private async authenticate(
    operation: 'login' | 'restore',
    email: string,
    password: string,
    includeInactive: boolean,
  ): Promise<AuthResult> {
    const normalizedEmail = normalizeEmail(email);
    const rateLimitKey = `${operation}:${normalizedEmail}`;
    this.assertRateLimit(rateLimitKey);
    const user = await this.users.findOneBy({ email: normalizedEmail });
    const accepted =
      user && (includeInactive || user.active) && (await passwordMatches(password, user.passwordHash));
    if (!accepted) {
      throw new UnauthorizedException('Hibás e-mail-cím vagy jelszó.');
    }

    this.attempts.delete(rateLimitKey);
    return this.createSession(user);
  }

  private async createSession(user: InternalUser): Promise<AuthResult> {
    const token = randomBytes(32).toString('base64url');
    await this.sessions.save({
      tokenDigest: digestToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + sessionLifetimeMilliseconds),
    });
    return { token, user: toView(user) };
  }

  private assertRateLimit(key: string): void {
    const threshold = Date.now() - rateLimitWindowMilliseconds;
    const recentAttempts = (this.attempts.get(key) ?? []).filter(
      (attemptedAt) => attemptedAt > threshold,
    );
    if (recentAttempts.length >= rateLimitMaximum) {
      throw new HttpException(
        'Túl sok próbálkozás. Kérjük, próbáld újra később.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    this.attempts.set(key, [...recentAttempts, Date.now()]);
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = (await derivePassword(password, salt, 64)) as Buffer;
  return `scrypt:${salt.toString('base64url')}:${derived.toString('base64url')}`;
}

async function passwordMatches(password: string, encoded: string): Promise<boolean> {
  const [scheme, saltText, expectedText] = encoded.split(':');
  if (scheme !== 'scrypt' || !saltText || !expectedText) {
    return false;
  }
  const salt = Buffer.from(saltText, 'base64url');
  const expected = Buffer.from(expectedText, 'base64url');
  const actual = (await derivePassword(password, salt, expected.length)) as Buffer;
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function digestToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toView(user: InternalUser): InternalUserView {
  return { id: user.id, email: user.email };
}
