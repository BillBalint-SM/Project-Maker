import { randomUUID } from 'node:crypto';

import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  CustomerEmailDelivery,
  CustomerFollowUpState,
  FollowUpDeliveryStatus,
} from '@project-maker/contracts';
import {
  DataSource,
  EntityManager,
  LessThanOrEqual,
  Repository,
} from 'typeorm';

import { createFollowUpConfiguration } from '../config/follow-up.config';
import { AuditEvent } from '../audit/audit-event.entity';
import { MarkdownRevisionEntity } from '../markdown/markdown-revision.entity';
import { Project } from '../projects/project.entity';
import {
  CustomerMailer,
  customerMailerToken,
} from './smtp-mailer.service';
import { CustomerFollowUpEntity } from './follow-up.entity';
import { minimumFollowUpIntervalMinutes, maximumFollowUpIntervalMinutes } from './dto/update-follow-up.dto';
import {
  SendCustomerReviewEmailDto,
  SendFollowUpPingDto,
  UpdateFollowUpDto,
} from './dto/update-follow-up.dto';

const defaultFollowUpIntervalMinutes = 10_080;
const neverDeliveryStatus: FollowUpDeliveryStatus = 'NEVER';
const sentDeliveryStatus: FollowUpDeliveryStatus = 'SENT';
const failedDeliveryStatus: FollowUpDeliveryStatus = 'FAILED';
const smtpFailureCode = 'SMTP_SEND_FAILED';

interface DuePingResult {
  readonly state: CustomerFollowUpEntity;
  readonly sentAt: Date;
}

interface ManualPingResult {
  readonly state: CustomerFollowUpEntity;
  readonly failed: boolean;
}

@Injectable()
export class CustomerFollowUpService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CustomerFollowUpService.name);
  private readonly pollIntervalMs: number;
  private pollHandle: NodeJS.Timeout | null = null;

  constructor(
    @InjectRepository(CustomerFollowUpEntity)
    private readonly followUpRepository: Repository<CustomerFollowUpEntity>,
    private readonly dataSource: DataSource,
    @Inject(customerMailerToken)
    private readonly mailer: CustomerMailer,
    configService: ConfigService,
  ) {
    this.pollIntervalMs = createFollowUpConfiguration(configService).pollIntervalMs;
  }

  onModuleInit(): void {
    // Every API process may poll in a multi-replica deployment. Due rows are
    // selected again under a PostgreSQL row lock before SMTP send, so only one
    // process can claim a due state at a time. This is intentionally bounded
    // polling, not a durable job queue; a queue is the next scaling step.
    if (!this.mailer.isConfigured()) {
      return;
    }
    this.pollHandle = setInterval(() => {
      void this.processDuePings(new Date()).catch(() => {
        // Never emit transport or database details from the timer. The next
        // bounded poll retries after this process-level failure.
        this.logger.warn('Automatic customer follow-up processing failed.');
      });
    }, this.pollIntervalMs);
    this.pollHandle.unref();
  }

  onModuleDestroy(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = null;
    }
  }

  async get(projectId: string): Promise<CustomerFollowUpState> {
    await this.findProject(this.dataSource.manager, projectId, false);
    const existing = await this.followUpRepository.findOneBy({ projectId });
    return toState(existing ?? createDefaultState(projectId));
  }

  async update(projectId: string, input: UpdateFollowUpDto): Promise<CustomerFollowUpState> {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException('Follow-up update must include at least one field.');
    }
    validateInterval(input.intervalMinutes);
    const now = new Date();

    return this.dataSource.transaction(async (manager) => {
      const project = await this.findProject(manager, projectId, true);
      rejectArchivedProject(project);
      const state = await findOrCreateLockedState(manager, projectId);
      const intervalMinutes = input.intervalMinutes ?? state.intervalMinutes;
      const enabled = input.enabled ?? state.enabled;
      const expiresAt = parseExpiresAt(input.expiresAt, state.expiresAt, now, enabled);
      if (enabled) {
        this.requireMailer();
      }

      state.enabled = enabled;
      state.intervalMinutes = intervalMinutes;
      state.expiresAt = expiresAt;
      state.nextPingAt = enabled ? addMinutes(now, intervalMinutes) : null;
      if (!enabled) {
        state.nextPingAt = null;
      }
      const saved = await manager.getRepository(CustomerFollowUpEntity).save(state);
      await saveAuditEvent(manager, projectId, 'FOLLOW_UP_SETTINGS_UPDATED', {
        enabled: String(saved.enabled),
        intervalMinutes: String(saved.intervalMinutes),
        expiresAt: saved.expiresAt ? saved.expiresAt.toISOString() : 'NONE',
      });
      return toState(saved);
    });
  }

  async sendManualPing(
    projectId: string,
    input: SendFollowUpPingDto,
  ): Promise<CustomerFollowUpState> {
    this.requireMailer();
    const now = new Date();
    const result = await this.dataSource.transaction(async (manager): Promise<ManualPingResult> => {
      const project = await this.findProject(manager, projectId, true);
      rejectArchivedProject(project);
      const state = await findOrCreateLockedState(manager, projectId);
      const revision = input.revisionId
        ? await findRevision(manager, projectId, input.revisionId)
        : await findLatestRevision(manager, projectId);

      try {
        await this.mailer.send({
          to: project.customerContactEmail,
          subject: `Follow-up reminder — ${project.name}`,
          text: createFollowUpBody(project, revision?.content ?? null),
        });
      } catch {
        await markDeliveryFailure(manager, state, now, state.enabled);
        await saveAuditEvent(manager, projectId, 'FOLLOW_UP_PING_FAILED', {
          deliveryStatus: failedDeliveryStatus,
          errorCode: smtpFailureCode,
        });
        return { state, failed: true };
      }

      await markDeliverySuccess(manager, state, now, state.enabled);
      await saveAuditEvent(manager, projectId, 'FOLLOW_UP_PING_SENT', {
        deliveryStatus: sentDeliveryStatus,
      });
      return { state, failed: false };
    });
    if (result.failed) {
      throw new ServiceUnavailableException('Customer follow-up email could not be delivered.');
    }
    return toState(result.state);
  }

  async sendCustomerReviewEmail(
    projectId: string,
    input: SendCustomerReviewEmailDto,
  ): Promise<CustomerEmailDelivery> {
    this.requireMailer();
    const delivery = await this.dataSource.transaction(async (manager) => {
      const project = await this.findProject(manager, projectId, true);
      rejectArchivedProject(project);
      const revision = await findRevision(
        manager,
        projectId,
        input.revisionId ?? null,
      );
      const sentAt = new Date();
      try {
        await this.mailer.send({
          to: project.customerContactEmail,
          subject: `Customer review — ${project.name}`,
          text: createCustomerReviewBody(project, revision.content),
        });
      } catch {
        await saveAuditEvent(manager, projectId, 'CUSTOMER_REVIEW_EMAIL_FAILED', {
          revisionId: revision.id,
          revisionVersion: String(revision.version),
          errorCode: smtpFailureCode,
        });
        // Return a failure marker so the audit event commits with the locked
        // project transaction. Throwing here would roll the audit event back.
        return null;
      }

      await saveAuditEvent(manager, projectId, 'CUSTOMER_REVIEW_EMAIL_SENT', {
        revisionId: revision.id,
        revisionVersion: String(revision.version),
        contentLength: String(revision.content.length),
      });
      return {
        projectId,
        revisionId: revision.id,
        revisionVersion: revision.version,
        sentAt: sentAt.toISOString(),
      };
    });
    if (delivery === null) {
      throw new ServiceUnavailableException('Customer review email could not be delivered.');
    }
    return delivery;
  }

  async processDuePings(now: Date): Promise<readonly CustomerFollowUpState[]> {
    if (!this.mailer.isConfigured()) {
      return [];
    }
    const candidates = await this.followUpRepository.find({
      where: {
        enabled: true,
        nextPingAt: LessThanOrEqual(now),
      },
      order: { nextPingAt: 'ASC', id: 'ASC' },
    });
    const sentStates: CustomerFollowUpState[] = [];
    for (const candidate of candidates) {
      const result = await this.processDueState(candidate.id, now);
      if (result) {
        sentStates.push(toState(result.state));
      }
    }
    return sentStates;
  }

  private async processDueState(id: string, now: Date): Promise<DuePingResult | null> {
    return this.dataSource.transaction(async (manager) => {
      const state = await manager.getRepository(CustomerFollowUpEntity).findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!state || !state.enabled || !state.nextPingAt || state.nextPingAt > now) {
        return null;
      }
      if (state.expiresAt && state.expiresAt <= now) {
        state.enabled = false;
        state.nextPingAt = null;
        await manager.getRepository(CustomerFollowUpEntity).save(state);
        return null;
      }

      const project = await this.findProject(manager, state.projectId, false);
      if (project.status === 'ARCHIVED') {
        state.enabled = false;
        state.nextPingAt = null;
        await manager.getRepository(CustomerFollowUpEntity).save(state);
        return null;
      }
      const revision = await findLatestRevision(manager, project.id);
      try {
        await this.mailer.send({
          to: project.customerContactEmail,
          subject: `Follow-up reminder — ${project.name}`,
          text: createFollowUpBody(project, revision?.content ?? null),
        });
      } catch {
        await markDeliveryFailure(manager, state, now, true);
        await saveAuditEvent(manager, project.id, 'FOLLOW_UP_PING_FAILED', {
          deliveryStatus: failedDeliveryStatus,
          errorCode: smtpFailureCode,
        });
        return { state, sentAt: now };
      }

      await markDeliverySuccess(manager, state, now, true);
      await saveAuditEvent(manager, project.id, 'FOLLOW_UP_PING_SENT', {
        deliveryStatus: sentDeliveryStatus,
      });
      return { state, sentAt: now };
    });
  }

  private requireMailer(): void {
    if (!this.mailer.isConfigured()) {
      throw new ServiceUnavailableException(
        'Customer email delivery is not configured on this API.',
      );
    }
  }

  private async findProject(
    manager: EntityManager,
    projectId: string,
    lock: boolean,
  ): Promise<Project> {
    const project = await manager.getRepository(Project).findOne({
      where: { id: projectId },
      lock: lock ? { mode: 'pessimistic_write' } : undefined,
    });
    if (!project) {
      throw new NotFoundException('Project not found.');
    }
    return project;
  }
}

function createDefaultState(projectId: string): CustomerFollowUpEntity {
  return {
    id: randomUUID(),
    projectId,
    enabled: false,
    intervalMinutes: defaultFollowUpIntervalMinutes,
    expiresAt: null,
    lastPingAt: null,
    nextPingAt: null,
    lastDeliveryStatus: neverDeliveryStatus,
    lastDeliveryError: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

async function findOrCreateLockedState(
  manager: EntityManager,
  projectId: string,
): Promise<CustomerFollowUpEntity> {
  const repository = manager.getRepository(CustomerFollowUpEntity);
  const existing = await repository.findOne({
    where: { projectId },
    lock: { mode: 'pessimistic_write' },
  });
  if (existing) {
    return existing;
  }
  const created = repository.create(createDefaultState(projectId));
  return repository.save(created);
}

async function findRevision(
  manager: EntityManager,
  projectId: string,
  revisionId: string | null,
): Promise<MarkdownRevisionEntity> {
  const repository = manager.getRepository(MarkdownRevisionEntity);
  const revision = revisionId
    ? await repository.findOneBy({ id: revisionId, projectId })
    : await repository.findOne({ where: { projectId }, order: { version: 'DESC', id: 'ASC' } });
  if (!revision) {
    throw new ConflictException('A Markdown revision is required before sending a customer email.');
  }
  return revision;
}

async function findLatestRevision(
  manager: EntityManager,
  projectId: string,
): Promise<MarkdownRevisionEntity | null> {
  return manager.getRepository(MarkdownRevisionEntity).findOne({
    where: { projectId },
    order: { version: 'DESC', id: 'ASC' },
  });
}

async function markDeliverySuccess(
  manager: EntityManager,
  state: CustomerFollowUpEntity,
  now: Date,
  enabled: boolean,
): Promise<void> {
  state.lastPingAt = now;
  state.lastDeliveryStatus = sentDeliveryStatus;
  state.lastDeliveryError = null;
  state.nextPingAt = enabled ? addMinutes(now, state.intervalMinutes) : null;
  await manager.getRepository(CustomerFollowUpEntity).save(state);
}

async function markDeliveryFailure(
  manager: EntityManager,
  state: CustomerFollowUpEntity,
  now: Date,
  enabled: boolean,
): Promise<void> {
  state.lastPingAt = now;
  state.lastDeliveryStatus = failedDeliveryStatus;
  state.lastDeliveryError = smtpFailureCode;
  state.nextPingAt = enabled ? addMinutes(now, state.intervalMinutes) : null;
  await manager.getRepository(CustomerFollowUpEntity).save(state);
}

async function saveAuditEvent(
  manager: EntityManager,
  projectId: string,
  eventType: string,
  payload: Readonly<Record<string, string>>,
): Promise<void> {
  await manager.getRepository(AuditEvent).save({
    id: randomUUID(),
    projectId,
    eventType,
    payload,
  });
}

function validateInterval(value: number | undefined): void {
  if (value === undefined) {
    return;
  }
  if (
    !Number.isInteger(value) ||
    value < minimumFollowUpIntervalMinutes ||
    value > maximumFollowUpIntervalMinutes
  ) {
    throw new BadRequestException('intervalMinutes must be an integer from 1 to 525600.');
  }
}

function parseExpiresAt(
  value: string | null | undefined,
  current: Date | null,
  now: Date,
  enabled: boolean,
): Date | null {
  if (value === undefined) {
    if (enabled && current && current <= now) {
      throw new BadRequestException('expiresAt must be in the future.');
    }
    return current;
  }
  if (value === null) {
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || !value.endsWith('Z')) {
    throw new BadRequestException('expiresAt must be a valid UTC ISO date.');
  }
  if (enabled && parsed <= now) {
    throw new BadRequestException('expiresAt must be in the future.');
  }
  return parsed;
}

function addMinutes(value: Date, minutes: number): Date {
  return new Date(value.getTime() + minutes * 60_000);
}

function rejectArchivedProject(project: Project): void {
  if (project.status === 'ARCHIVED') {
    throw new ConflictException('Archived projects cannot send customer emails.');
  }
}

function createFollowUpBody(project: Project, revisionContent: string | null): string {
  const lines = [
    `Hello ${project.customerContactName},`,
    '',
    `This is a follow-up on the Project Maker discovery work for “${project.name}”.`,
    '',
    'Please reply with any outstanding answers or corrections when convenient.',
  ];
  if (revisionContent) {
    lines.push('', 'The current execution-plan revision is included below for reference.', '', revisionContent);
  }
  return `${lines.join('\n')}\n`;
}

function createCustomerReviewBody(project: Project, revisionContent: string): string {
  return [
    `Hello ${project.customerContactName},`,
    '',
    `Please review the current execution plan for “${project.name}”.`,
    '',
    revisionContent,
    '',
    'Please reply with any corrections or approval.',
    '',
  ].join('\n');
}

function toState(value: CustomerFollowUpEntity): CustomerFollowUpState {
  return {
    projectId: value.projectId,
    enabled: value.enabled,
    intervalMinutes: value.intervalMinutes,
    expiresAt: toIsoOrNull(value.expiresAt, 'follow-up expiresAt'),
    lastPingAt: toIsoOrNull(value.lastPingAt, 'follow-up lastPingAt'),
    nextPingAt: toIsoOrNull(value.nextPingAt, 'follow-up nextPingAt'),
    lastDeliveryStatus: value.lastDeliveryStatus,
    lastDeliveryError: toSafeDeliveryError(value.lastDeliveryError),
  };
}

function toSafeDeliveryError(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  return value === smtpFailureCode ? smtpFailureCode : 'DELIVERY_FAILED';
}

function toIsoOrNull(value: Date | null, field: string): string | null {
  if (value === null) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new InternalServerErrorException(`Stored ${field} is invalid.`);
  }
  return date.toISOString();
}
