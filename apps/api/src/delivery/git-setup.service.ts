import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { GitSetup } from '@project-maker/contracts';
import { DataSource, QueryFailedError } from 'typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { currentAuditActorId } from '../audit/audit-actor';
import { CredentialCrypto, type StoredGitCredential } from './credential-crypto';
import { GitSetupEntity } from './delivery.entity';
import { SaveGitSetupDto } from './dto/delivery.dto';

@Injectable()
export class GitSetupService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly crypto: CredentialCrypto,
  ) {}

  async list(): Promise<readonly GitSetup[]> {
    const rows = await this.dataSource.getRepository(GitSetupEntity).find({ order: { name: 'ASC', id: 'ASC' } });
    return rows.map(toView);
  }

  async get(id: string): Promise<GitSetup> { return toView(await this.entity(id)); }

  async create(input: SaveGitSetupDto): Promise<GitSetup> {
    const normalized = normalizeSetup(input);
    if (!input.credential) throw new BadRequestException('A credential is required for a new Git setup.');
    const actor = currentAuditActorId();
    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const row = await manager.getRepository(GitSetupEntity).save({
          id: randomUUID(), ...normalized,
          credentialCiphertext: this.crypto.encrypt(normalized.authenticationMode, normalized.username, input.credential!),
          version: 1, createdBy: actor, updatedBy: actor,
        });
        await manager.getRepository(AuditEvent).save({
          id: randomUUID(), projectId: null, eventType: 'GIT_SETUP_CREATED',
          payload: { gitSetupId: row.id, setupVersion: '1', authenticationMode: row.authenticationMode },
        });
        return row;
      });
      return toView(saved);
    } catch (error) { throw mapWriteError(error); }
  }

  async update(id: string, input: SaveGitSetupDto): Promise<GitSetup> {
    const normalized = normalizeSetup(input);
    try {
      const saved = await this.dataSource.transaction(async (manager) => {
        const row = await manager.getRepository(GitSetupEntity).findOne({
          where: { id }, lock: { mode: 'pessimistic_write' },
        });
        if (!row) throw new NotFoundException('Git setup not found.');
        if (row.authenticationMode !== normalized.authenticationMode && !input.credential) {
          throw new BadRequestException('A new credential is required when changing the authentication method.');
        }
        Object.assign(row, normalized, {
          credentialCiphertext: input.credential
            ? this.crypto.encrypt(normalized.authenticationMode, normalized.username, input.credential)
            : row.credentialCiphertext,
          version: row.version + 1,
          updatedBy: currentAuditActorId(),
        });
        const updated = await manager.getRepository(GitSetupEntity).save(row);
        await manager.getRepository(AuditEvent).save({
          id: randomUUID(), projectId: null, eventType: 'GIT_SETUP_UPDATED',
          payload: { gitSetupId: id, setupVersion: String(updated.version), authenticationMode: updated.authenticationMode },
        });
        return updated;
      });
      return toView(saved);
    } catch (error) { throw mapWriteError(error); }
  }

  async remove(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const row = await manager.getRepository(GitSetupEntity).findOneBy({ id });
      if (!row) throw new NotFoundException('Git setup not found.');
      await manager.getRepository(GitSetupEntity).remove(row);
      await manager.getRepository(AuditEvent).save({
        id: randomUUID(), projectId: null, eventType: 'GIT_SETUP_DELETED',
        payload: { gitSetupId: id, setupVersion: String(row.version), authenticationMode: row.authenticationMode },
      });
    });
  }

  async entity(id: string): Promise<GitSetupEntity> {
    const row = await this.dataSource.getRepository(GitSetupEntity).findOneBy({ id });
    if (!row) throw new NotFoundException('Git setup not found.');
    return row;
  }

  credential(row: GitSetupEntity): StoredGitCredential { return this.crypto.decrypt(row.credentialCiphertext); }
}

function normalizeSetup(input: SaveGitSetupDto): Pick<GitSetupEntity,
  'name' | 'remoteUrl' | 'branch' | 'authenticationMode' | 'username' | 'repositoryWebUrl'> {
  const name = required(input.name, 'A setup neve');
  const remoteUrl = required(input.remoteUrl, 'Git remote');
  const branch = required(input.branch, 'Target branch');
  const username = optional(input.username);
  const repositoryWebUrl = optional(input.repositoryWebUrl);
  validateBranch(branch);
  validateRemote(remoteUrl, input.authenticationMode);
  if (repositoryWebUrl) validateWebUrl(repositoryWebUrl);
  return { name, remoteUrl, branch, authenticationMode: input.authenticationMode, username, repositoryWebUrl };
}

function validateRemote(remote: string, mode: GitSetupEntity['authenticationMode']): void {
  if (remote.includes('::') || remote.startsWith('-') || /\s/.test(remote)) invalidRemote();
  if (mode === 'HTTPS_TOKEN') {
    let url: URL;
    try { url = new URL(remote); } catch { return invalidRemote(); }
    if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash) invalidRemote();
    return;
  }
  if (remote.startsWith('ssh://')) {
    let url: URL;
    try { url = new URL(remote); } catch { return invalidRemote(); }
    if (!url.hostname || url.password || !url.pathname || url.pathname === '/' || url.search || url.hash) invalidRemote();
    return;
  }
  if (!/^(?:[A-Za-z0-9._-]+@)?[A-Za-z0-9.-]+:[A-Za-z0-9._~/-]+$/.test(remote)) invalidRemote();
}

function validateBranch(branch: string): void {
  if (branch.startsWith('-') || branch.startsWith('.') || branch.endsWith('.') || branch.endsWith('/') ||
      /[\s\\~^:?*\[]/.test(branch) || branch.includes('..') || branch.includes('//') || branch.includes('@{')) {
    throw new BadRequestException('The target branch name is invalid.');
  }
}

function validateWebUrl(value: string): void {
  let url: URL;
  try { url = new URL(value); } catch { throw new BadRequestException('The repository web URL is invalid.'); }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password) {
    throw new BadRequestException('The repository web URL is invalid.');
  }
}

function invalidRemote(): never { throw new BadRequestException('Only HTTPS or SSH Git remotes without embedded credentials are supported.'); }
function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new BadRequestException(`${label} cannot be empty.`);
  return normalized;
}
function optional(value: string | null | undefined): string | null { return value?.trim() || null; }
function mapWriteError(error: unknown): unknown {
  if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505') {
    return new ConflictException('A Git setup with this name already exists.');
  }
  return error;
}
function toView(row: GitSetupEntity): GitSetup {
  return {
    id: row.id, name: row.name, remoteUrl: row.remoteUrl, branch: row.branch,
    authenticationMode: row.authenticationMode, username: row.username,
    credentialConfigured: Boolean(row.credentialCiphertext), repositoryWebUrl: row.repositoryWebUrl,
    version: row.version, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(), updatedBy: row.updatedBy,
  };
}
