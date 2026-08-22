import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type {
  DeliveryHandoff,
  DeliveryHandoffPreview,
  GitConnectionTestResult,
} from '@project-maker/contracts';
import { DataSource, QueryFailedError } from 'typeorm';

import { AuditEvent } from '../audit/audit-event.entity';
import { currentAuditActorId } from '../audit/audit-actor';
import { Project } from '../projects/project.entity';
import { DeliveryHandoffEntity, type GitTargetSnapshot } from './delivery.entity';
import { DeliveryPackageService, sha256 } from './delivery-package.service';
import { GitClient, GitOperationError } from './git-client';
import { GitSetupService } from './git-setup.service';

const previewLifetimeMs = 30 * 60 * 1_000;

interface HandoffPreviewPayload {
  readonly previewId: string;
  readonly projectId: string;
  readonly packageId: string;
  readonly packageVersion: number;
  readonly setupId: string;
  readonly setupVersion: number;
  readonly targetDigest: string;
  readonly artifactDigest: string;
  readonly expiresAt: string;
}

@Injectable()
export class DeliveryHandoffService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly config: ConfigService,
    private readonly packages: DeliveryPackageService,
    private readonly setups: GitSetupService,
    private readonly git: GitClient,
  ) {}

  async testSetup(setupId: string): Promise<GitConnectionTestResult> {
    const setup = await this.setups.entity(setupId);
    const checkedAt = new Date().toISOString();
    try {
      await this.git.remoteSha(setup, this.setups.credential(setup));
      return { ok: true, checkedAt, message: 'The Git remote and target branch are reachable.' };
    } catch (error) {
      return { ok: false, checkedAt, message: gitFailureMessage(error) };
    }
  }

  async preview(projectId: string, setupId: string): Promise<DeliveryHandoffPreview> {
    await requireActiveProject(this.dataSource, projectId);
    const deliveryPackage = await this.packages.entity(projectId);
    const setup = await this.setups.entity(setupId);
    const artifact = await this.packages.artifact(projectId);
    const target = targetSnapshot(setup);
    const payload: HandoffPreviewPayload = {
      previewId: randomUUID(), projectId, packageId: deliveryPackage.id,
      packageVersion: deliveryPackage.version, setupId: setup.id, setupVersion: setup.version,
      targetDigest: sha256(JSON.stringify(target)), artifactDigest: artifact.digest,
      expiresAt: new Date(Date.now() + previewLifetimeMs).toISOString(),
    };
    return {
      previewToken: encodePreview(payload, this.previewSecret()),
      expiresAt: payload.expiresAt,
      setup: {
        id: setup.id, name: setup.name, remoteUrl: setup.remoteUrl, branch: setup.branch,
        repositoryWebUrl: setup.repositoryWebUrl, version: setup.version,
      },
      packageVersion: deliveryPackage.version,
      artifactPath: artifactPath(projectId, deliveryPackage.version),
      commitMessage: commitMessage((await requireActiveProject(this.dataSource, projectId)).name, deliveryPackage.version),
      artifact,
    };
  }

  async confirm(projectId: string, token: string): Promise<DeliveryHandoff> {
    const payload = decodePreview(token, this.previewSecret());
    if (payload.projectId !== projectId || Date.parse(payload.expiresAt) <= Date.now()) {
      throw new ConflictException('The Git handoff preview has expired. Generate a new preview.');
    }
    const project = await requireActiveProject(this.dataSource, projectId);
    const deliveryPackage = await this.packages.entity(projectId);
    const setup = await this.setups.entity(payload.setupId);
    const target = targetSnapshot(setup);
    if (
      deliveryPackage.id !== payload.packageId || deliveryPackage.version !== payload.packageVersion ||
      setup.version !== payload.setupVersion || sha256(JSON.stringify(target)) !== payload.targetDigest
    ) {
      throw new ConflictException('The Delivery package or Git setup changed. Generate a new preview.');
    }
    const existing = await this.dataSource.getRepository(DeliveryHandoffEntity).findOneBy({
      deliveryPackageId: deliveryPackage.id,
      packageVersion: deliveryPackage.version,
      targetDigest: payload.targetDigest,
    });
    if (existing) return toView(existing);
    const artifact = await this.packages.artifact(projectId);
    if (artifact.digest !== payload.artifactDigest) {
      throw new ConflictException('The Delivery package handoff content changed. Generate a new preview.');
    }
    const revision = await this.packages.revision(deliveryPackage);
    let handoff: DeliveryHandoffEntity;
    try {
      handoff = await this.dataSource.transaction(async (manager) => {
        const saved = await manager.getRepository(DeliveryHandoffEntity).save({
          id: randomUUID(), projectId, deliveryPackageId: deliveryPackage.id,
          packageVersion: deliveryPackage.version, gitSetupId: setup.id, previewId: payload.previewId,
          targetDigest: payload.targetDigest, targetSnapshot: target,
          packageSnapshot: {
            packageId: deliveryPackage.id, packageVersion: deliveryPackage.version,
            specificationRevisionId: revision.id, specificationVersion: revision.version,
            items: deliveryPackage.items,
          },
          artifactPath: artifactPath(projectId, deliveryPackage.version),
          artifactContent: artifact.content, artifactDigest: artifact.digest,
          commitMessage: commitMessage(project.name, deliveryPackage.version),
          state: 'PENDING', expectedCommitSha: null, commitSha: null,
          repositoryBacklink: null, failureCode: null, attemptCount: 0,
          createdBy: currentAuditActorId(),
        });
        await audit(manager, projectId, 'DELIVERY_HANDOFF_CONFIRMED', saved, {});
        return saved;
      });
    } catch (error) {
      if (error instanceof QueryFailedError && (error.driverError as { code?: string }).code === '23505') {
        const duplicate = await this.dataSource.getRepository(DeliveryHandoffEntity).findOneBy({
          deliveryPackageId: deliveryPackage.id,
          packageVersion: deliveryPackage.version,
          targetDigest: payload.targetDigest,
        });
        if (duplicate) return toView(duplicate);
      }
      throw error;
    }
    return this.execute(handoff);
  }

  async list(projectId: string): Promise<readonly DeliveryHandoff[]> {
    await requireProject(this.dataSource, projectId);
    const rows = await this.dataSource.getRepository(DeliveryHandoffEntity).find({
      where: { projectId }, order: { createdAt: 'DESC', id: 'DESC' },
    });
    return rows.map(toView);
  }

  async retry(projectId: string, handoffId: string): Promise<DeliveryHandoff> {
    await requireActiveProject(this.dataSource, projectId);
    const handoff = await this.dataSource.getRepository(DeliveryHandoffEntity).findOneBy({ id: handoffId, projectId });
    if (!handoff) throw new NotFoundException('Delivery handoff not found.');
    if (!['FAILED', 'CONFLICT'].includes(handoff.state)) throw new ConflictException('This Git handoff cannot be retried.');
    return this.execute(handoff);
  }

  private async execute(handoff: DeliveryHandoffEntity): Promise<DeliveryHandoff> {
    const setup = handoff.gitSetupId ? await this.setups.entity(handoff.gitSetupId).catch(() => null) : null;
    if (!setup || setup.remoteUrl !== handoff.targetSnapshot.remoteUrl || setup.branch !== handoff.targetSnapshot.branch) {
      return this.fail(handoff, 'FAILED', 'SETUP_CHANGED_OR_REMOVED');
    }
    const credential = this.setups.credential(setup);
    if (handoff.expectedCommitSha) {
      try {
        if (await this.git.remoteSha(handoff.targetSnapshot, credential) === handoff.expectedCommitSha) {
          return this.sent(handoff, handoff.expectedCommitSha);
        }
      } catch { /* A normal explicit retry continues with the retained snapshot. */ }
    }
    let prepared: Awaited<ReturnType<GitClient['preparePush']>> | null = null;
    try {
      prepared = await this.git.preparePush({
        ...handoff.targetSnapshot,
        credential,
        artifactPath: handoff.artifactPath,
        artifactContent: handoff.artifactContent,
        commitMessage: handoff.commitMessage,
        committedAt: handoff.createdAt,
      });
      handoff.expectedCommitSha = prepared.expectedCommitSha;
      handoff.state = 'PUSHING';
      handoff.failureCode = null;
      handoff.attemptCount += 1;
      await this.dataSource.getRepository(DeliveryHandoffEntity).save(handoff);
      await prepared.push();
      return this.sent(handoff, prepared.expectedCommitSha);
    } catch (error) {
      if (error instanceof GitOperationError && error.code === 'PUSH_RESULT_UNKNOWN' && handoff.expectedCommitSha) {
        try {
          if (await this.git.remoteSha(handoff.targetSnapshot, credential) === handoff.expectedCommitSha) {
            return this.sent(handoff, handoff.expectedCommitSha);
          }
        } catch { /* Stored as a retryable, unproven result below. */ }
        return this.fail(handoff, 'FAILED', 'PUSH_RESULT_UNPROVEN');
      }
      const code = error instanceof GitOperationError ? error.code : 'GIT_FAILED';
      return this.fail(handoff, code === 'NON_FAST_FORWARD' ? 'CONFLICT' : 'FAILED', code);
    } finally {
      await prepared?.dispose();
    }
  }

  private async sent(handoff: DeliveryHandoffEntity, commitSha: string): Promise<DeliveryHandoff> {
    handoff.state = 'SENT'; handoff.commitSha = commitSha; handoff.failureCode = null;
    handoff.repositoryBacklink = handoff.targetSnapshot.repositoryWebUrl;
    const saved = await this.dataSource.getRepository(DeliveryHandoffEntity).save(handoff);
    await this.auditResult(saved, 'DELIVERY_HANDOFF_SENT');
    return toView(saved);
  }

  private async fail(
    handoff: DeliveryHandoffEntity,
    state: 'FAILED' | 'CONFLICT',
    failureCode: string,
  ): Promise<DeliveryHandoff> {
    handoff.state = state; handoff.failureCode = failureCode; handoff.commitSha = null;
    const saved = await this.dataSource.getRepository(DeliveryHandoffEntity).save(handoff);
    await this.auditResult(saved, state === 'CONFLICT' ? 'DELIVERY_HANDOFF_CONFLICT' : 'DELIVERY_HANDOFF_FAILED');
    return toView(saved);
  }

  private async auditResult(handoff: DeliveryHandoffEntity, eventType: string): Promise<void> {
    await this.dataSource.transaction((manager) => audit(manager, handoff.projectId, eventType, handoff, {
      failureCode: handoff.failureCode ?? '', commitSha: handoff.commitSha ?? '',
    }));
  }

  private previewSecret(): string {
    const secret = this.config.get<string>('GIT_HANDOFF_PREVIEW_SECRET') ?? '';
    if (secret.length < 32) throw new ConflictException('The Git handoff preview signing key is not configured.');
    return secret;
  }
}

function targetSnapshot(setup: Awaited<ReturnType<GitSetupService['entity']>>): GitTargetSnapshot {
  return {
    setupId: setup.id, setupVersion: setup.version, setupName: setup.name,
    remoteUrl: setup.remoteUrl, branch: setup.branch, repositoryWebUrl: setup.repositoryWebUrl,
  };
}

function artifactPath(projectId: string, packageVersion: number): string {
  return `project-maker-handoffs/${projectId}/delivery-package-v${packageVersion}.md`;
}

function commitMessage(projectName: string, packageVersion: number): string {
  return `Project Maker: ${projectName} delivery package v${packageVersion}`.slice(0, 255);
}

function encodePreview(payload: HandoffPreviewPayload, secret: string): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${createHmac('sha256', secret).update(body).digest('base64url')}`;
}

function decodePreview(token: string, secret: string): HandoffPreviewPayload {
  const [body, signature] = token.split('.');
  if (!body || !signature) throw new BadRequestException('Invalid Git handoff preview.');
  const expected = createHmac('sha256', secret).update(body).digest();
  const actual = Buffer.from(signature, 'base64url');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new BadRequestException('Invalid Git handoff preview.');
  }
  try { return JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as HandoffPreviewPayload; }
  catch { throw new BadRequestException('Invalid Git handoff preview.'); }
}

async function requireProject(dataSource: DataSource, id: string): Promise<Project> {
  const project = await dataSource.getRepository(Project).findOneBy({ id });
  if (!project) throw new NotFoundException('Project not found.');
  return project;
}
async function requireActiveProject(dataSource: DataSource, id: string): Promise<Project> {
  const project = await requireProject(dataSource, id);
  if (project.status === 'ARCHIVED') throw new ConflictException('A Git handoff cannot be started from an archived Project.');
  return project;
}
async function audit(
  manager: import('typeorm').EntityManager,
  projectId: string,
  eventType: string,
  handoff: DeliveryHandoffEntity,
  additional: Record<string, string>,
): Promise<void> {
  await manager.getRepository(AuditEvent).save({
    id: randomUUID(), projectId, eventType,
    payload: {
      deliveryHandoffId: handoff.id, deliveryPackageId: handoff.deliveryPackageId,
      packageVersion: String(handoff.packageVersion), setupName: handoff.targetSnapshot.setupName,
      state: handoff.state, ...additional,
    },
  });
}
function toView(row: DeliveryHandoffEntity): DeliveryHandoff {
  return {
    id: row.id, projectId: row.projectId, packageVersion: row.packageVersion,
    setupName: row.targetSnapshot.setupName, remoteUrl: row.targetSnapshot.remoteUrl,
    branch: row.targetSnapshot.branch, artifactPath: row.artifactPath, artifactDigest: row.artifactDigest,
    state: row.state, expectedCommitSha: row.expectedCommitSha, commitSha: row.commitSha,
    repositoryBacklink: row.repositoryBacklink, failureCode: row.failureCode,
    attemptCount: row.attemptCount, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString(),
  };
}
function gitFailureMessage(error: unknown): string {
  const code = error instanceof GitOperationError ? error.code : 'GIT_FAILED';
  const messages: Record<string, string> = {
    AUTHENTICATION_FAILED: 'Git authentication failed.',
    NON_FAST_FORWARD: 'The target branch changed before the handoff could be completed.',
    REMOTE_UNREACHABLE: 'The Git remote is unreachable.',
    PUSH_RESULT_UNKNOWN: 'The result of the Git push could not be confirmed.',
    GIT_FAILED: 'The Git operation failed.',
  };
  return messages[code] ?? messages['GIT_FAILED']!;
}
