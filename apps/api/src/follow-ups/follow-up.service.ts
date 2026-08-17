import { createHash, randomBytes, randomUUID } from 'node:crypto';

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
  CustomerFollowUpReferenceOption,
  CustomerFollowUpManualAttempt,
  CustomerFollowUpPingDelivery,
  CustomerFollowUpPingPreview,
  CustomerFollowUpState,
  FollowUpDeliveryStatus,
} from '@project-maker/contracts';
import { loadGeneralPlaybookV1 } from '@project-maker/contracts/general-playbook-runtime';
import {
  DataSource,
  EntityManager,
  LessThanOrEqual,
  Repository,
} from 'typeorm';

import { createFollowUpConfiguration } from '../config/follow-up.config';
import { AuditEvent } from '../audit/audit-event.entity';
import { Project } from '../projects/project.entity';
import { DiscoveryFollowUpEntity } from '../discovery-follow-ups/discovery-follow-up.entity';
import {
  CustomerMailBoundaryError,
  type CustomerOutboundMail,
  customerOutboundMailToken,
  immutableOutboundCustomerMessage,
} from '../mail-delivery/customer-mail-boundary';
import { CustomerFollowUpEntity } from './follow-up.entity';
import { CustomerFollowUpDeliveryAttemptEntity } from './follow-up-delivery-attempt.entity';
import {
  renderCustomerFollowUpPing,
  type RenderedCustomerFollowUpPing,
} from './customer-follow-up-ping.renderer';
import { minimumFollowUpIntervalMinutes, maximumFollowUpIntervalMinutes } from './dto/update-follow-up.dto';
import {
  SendFollowUpPingDto,
  RetryFollowUpPingDto,
  PreviewFollowUpPingDto,
  UpdateFollowUpDraftDto,
  UpdateFollowUpDto,
} from './dto/update-follow-up.dto';

const defaultFollowUpIntervalMinutes = 10_080;
const neverDeliveryStatus: FollowUpDeliveryStatus = 'NEVER';
const sentDeliveryStatus: FollowUpDeliveryStatus = 'SENT';
const failedDeliveryStatus: FollowUpDeliveryStatus = 'FAILED';
const smtpFailureCode = 'SMTP_SEND_FAILED';
const unknownDeliveryCode = 'SMTP_DELIVERY_UNKNOWN';
const previewLifetimeMs = 15 * 60_000;
const manualDeliveryLeaseMs = 15 * 60_000;

interface ClaimedManualPing {
  readonly attemptId: string;
  readonly state: CustomerFollowUpEntity;
  readonly rendered: RenderedCustomerFollowUpPing;
  readonly referencedFollowUpId: string | null;
  readonly referencedFollowUpVersion: number | null;
  readonly attemptedAt: Date;
}

interface DuplicateRiskAcknowledgementRequired {
  readonly requiresDuplicateRiskAcknowledgement: true;
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
    @Inject(customerOutboundMailToken)
    private readonly mailer: CustomerOutboundMail,
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
    return this.dataSource.transaction(async (manager) => {
      await this.findProject(manager, projectId, false);
      const existing = await manager.getRepository(CustomerFollowUpEntity).findOneBy({ projectId });
      await this.reconcileExpiredManualAttempts(manager, projectId, new Date());
      const latestManualAttempt = await findLatestManualAttempt(manager, projectId);
      return toState(existing ?? createDefaultState(projectId), latestManualAttempt);
    });
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
        await renderCurrentPing(manager, project, state);
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
      return toState(saved, await findLatestManualAttempt(manager, projectId));
    });
  }

  async listReferenceOptions(
    projectId: string,
  ): Promise<readonly CustomerFollowUpReferenceOption[]> {
    await this.findProject(this.dataSource.manager, projectId, false);
    const openStatus = await initialDiscoveryFollowUpStatus();
    const followUps = await this.dataSource.manager.getRepository(DiscoveryFollowUpEntity).find({
      where: { projectId, status: openStatus },
      order: { createdAt: 'ASC', id: 'ASC' },
    });
    return followUps.map(toReferenceOption);
  }

  async updateDraft(
    projectId: string,
    input: UpdateFollowUpDraftDto,
  ): Promise<CustomerFollowUpState> {
    const messageDraft = input.messageDraft.trim();
    if (!messageDraft) {
      throw new BadRequestException('A Customer follow-up ping üzenete nem lehet üres.');
    }

    const now = new Date();
    return this.dataSource.transaction(async (manager) => {
      const project = await this.findProject(manager, projectId, true);
      rejectArchivedProject(project);
      const state = await findOrCreateLockedState(manager, projectId);
      if (state.draftVersion !== input.expectedVersion) {
        throw new ConflictException({
          code: 'FOLLOW_UP_DRAFT_STALE',
          message: 'A Customer follow-up ping piszkozata időközben megváltozott. Töltsd újra az aktuális változatot, vagy tartsd meg a saját szövegedet.',
        });
      }
      const referencedFollowUp = input.referencedFollowUpId
        ? await requireOpenReference(manager, projectId, input.referencedFollowUpId)
        : null;

      state.messageDraft = messageDraft;
      state.referencedFollowUpId = referencedFollowUp?.id ?? null;
      state.draftVersion += 1;
      clearPreview(state);
      const latestAttempt = await findLatestManualAttempt(manager, projectId);
      if (
        state.enabled
        && state.nextPingAt === null
        && latestAttempt?.state !== 'SENDING'
        && latestAttempt?.state !== 'UNKNOWN'
      ) {
        state.nextPingAt = addMinutes(now, state.intervalMinutes);
      }
      const saved = await manager.getRepository(CustomerFollowUpEntity).save(state);
      await saveAuditEvent(manager, projectId, 'CUSTOMER_FOLLOW_UP_DRAFT_UPDATED', {
        draftVersion: String(saved.draftVersion),
        hasReference: String(referencedFollowUp !== null),
        messageLength: String(messageDraft.length),
      });
      return toState(saved, await findLatestManualAttempt(manager, projectId));
    });
  }

  async previewManualPing(
    projectId: string,
    input: PreviewFollowUpPingDto,
  ): Promise<CustomerFollowUpPingPreview> {
    const now = new Date();
    return this.dataSource.transaction(async (manager) => {
      const project = await this.findProject(manager, projectId, true);
      rejectArchivedProject(project);
      const state = await findOrCreateLockedState(manager, projectId);
      requireCurrentDraftVersion(state, input.expectedVersion);
      const { reference, rendered } = await renderCurrentPing(manager, project, state);
      const previewToken = randomBytes(32).toString('base64url');
      const expiresAt = new Date(now.getTime() + previewLifetimeMs);
      state.previewTokenDigest = digest(previewToken);
      state.previewFingerprint = pingFingerprint(state, rendered, reference);
      state.previewExpiresAt = expiresAt;
      await manager.getRepository(CustomerFollowUpEntity).save(state);
      return {
        ...rendered,
        draftVersion: state.draftVersion,
        previewToken,
        expiresAt: expiresAt.toISOString(),
      };
    });
  }

  async sendManualPing(
    projectId: string,
    input: SendFollowUpPingDto,
  ): Promise<CustomerFollowUpPingDelivery> {
    this.requireMailer();
    const attemptedAt = new Date();
    const claim = await this.dataSource.transaction(async (
      manager,
    ): Promise<ClaimedManualPing | DuplicateRiskAcknowledgementRequired> => {
      const project = await this.findProject(manager, projectId, true);
      rejectArchivedProject(project);
      const state = await findOrCreateLockedState(manager, projectId);
      if (
        !state.previewTokenDigest ||
        !state.previewFingerprint ||
        !state.previewExpiresAt ||
        state.previewExpiresAt <= attemptedAt ||
        digest(input.previewToken) !== state.previewTokenDigest
      ) {
        throw new ConflictException({
          code: 'FOLLOW_UP_PREVIEW_STALE',
          message: 'Az előnézet lejárt vagy már fel lett használva. Készíts új előnézetet a küldés előtt.',
        });
      }
      const { reference, rendered } = await renderCurrentPing(manager, project, state);
      if (pingFingerprint(state, rendered, reference) !== state.previewFingerprint) {
        clearPreview(state);
        await manager.getRepository(CustomerFollowUpEntity).save(state);
        throw new ConflictException({
          code: 'FOLLOW_UP_PREVIEW_STALE',
          message: 'A címzett, a piszkozat vagy a hivatkozott kérdés megváltozott. Ellenőrizd az új előnézetet.',
        });
      }
      const attemptRepository = manager.getRepository(CustomerFollowUpDeliveryAttemptEntity);
      const activeAttempts = await this.reconcileExpiredManualAttempts(
        manager,
        projectId,
        attemptedAt,
      );
      if (activeAttempts.some((attempt) => attempt.state === 'SENDING')) {
        throw new ConflictException({
          code: 'FOLLOW_UP_DELIVERY_IN_PROGRESS',
          message: 'Az ügyfél-ping küldése már folyamatban van. Várj a kézbesítési eredményre.',
        });
      }
      const latestAttempt = activeAttempts[0] ?? await attemptRepository.findOne({
        where: {
          projectId,
        },
        order: { attemptedAt: 'DESC', createdAt: 'DESC', id: 'ASC' },
      });
      if (
        latestAttempt?.state === 'UNKNOWN' &&
        input.acknowledgeDuplicateRiskForAttemptId !== latestAttempt.id
      ) {
        return { requiresDuplicateRiskAcknowledgement: true };
      }
      const claimedAt = nextAttemptTimestamp(attemptedAt, latestAttempt);
      clearPreview(state);
      await manager.getRepository(CustomerFollowUpEntity).save(state);
      const attemptId = randomUUID();
      await attemptRepository.save({
        id: attemptId,
        projectId,
        draftVersion: state.draftVersion,
        referencedFollowUpId: reference?.id ?? null,
        referencedFollowUpVersion: reference?.version ?? null,
        state: 'SENDING',
        recipientEmail: rendered.recipientEmail,
        subjectLength: rendered.subject.length,
        textLength: rendered.text.length,
        failureCode: null,
        createdAt: claimedAt,
        attemptedAt: claimedAt,
        sentAt: null,
      });
      return {
        attemptId,
        state,
        rendered,
        referencedFollowUpId: reference?.id ?? null,
        referencedFollowUpVersion: reference?.version ?? null,
        attemptedAt: claimedAt,
      };
    });

    if ('requiresDuplicateRiskAcknowledgement' in claim) {
      throw new ConflictException({
        code: 'FOLLOW_UP_DELIVERY_UNKNOWN',
        message: 'A korábbi küldés eredménye nem bizonyítható. Ellenőrizd a postafiókot, majd csak a duplikáció kockázatának elfogadásával küldd újra.',
      });
    }
    return this.deliverClaimedManualPing(claim);
  }

  async retryManualPing(
    projectId: string,
    input: RetryFollowUpPingDto,
  ): Promise<CustomerFollowUpPingDelivery> {
    this.requireMailer();
    const attemptedAt = new Date();
    const claimed = await this.dataSource.transaction(async (manager): Promise<ClaimedManualPing> => {
      const project = await this.findProject(manager, projectId, true);
      rejectArchivedProject(project);
      const state = await findOrCreateLockedState(manager, projectId);
      const attemptRepository = manager.getRepository(CustomerFollowUpDeliveryAttemptEntity);
      const latestAttempt = await attemptRepository.findOne({
        where: { projectId },
        order: { attemptedAt: 'DESC', createdAt: 'DESC', id: 'ASC' },
        lock: { mode: 'pessimistic_write' },
      });
      if (!latestAttempt || latestAttempt.id !== input.attemptId) {
        throw new ConflictException({
          code: 'FOLLOW_UP_RETRY_STALE',
          message: 'A kézbesítési állapot időközben megváltozott. Töltsd újra az aktuális állapotot.',
        });
      }
      if (latestAttempt.state === 'UNKNOWN' && !input.acknowledgeDuplicateRisk) {
        throw new ConflictException({
          code: 'FOLLOW_UP_DUPLICATE_RISK_ACKNOWLEDGEMENT_REQUIRED',
          message: 'A korábbi küldés eredménye bizonytalan. Az újraküldéshez külön el kell fogadni a duplikáció kockázatát.',
        });
      }
      if (latestAttempt.state !== 'FAILED' && latestAttempt.state !== 'UNKNOWN') {
        throw new ConflictException({
          code: 'FOLLOW_UP_RETRY_NOT_AVAILABLE',
          message: 'Ez a kézbesítési kísérlet nem próbálható újra.',
        });
      }
      const { reference, rendered } = await renderCurrentPing(manager, project, state);
      const currentReferenceId = reference?.id ?? null;
      const currentReferenceVersion = reference?.version ?? null;
      if (
        state.draftVersion !== latestAttempt.draftVersion ||
        currentReferenceId !== latestAttempt.referencedFollowUpId ||
        currentReferenceVersion !== latestAttempt.referencedFollowUpVersion ||
        rendered.recipientEmail !== latestAttempt.recipientEmail
      ) {
        throw new ConflictException({
          code: 'FOLLOW_UP_RETRY_STALE',
          message: 'A címzett, a piszkozat vagy a hivatkozott kérdés megváltozott. Készíts új előnézetet.',
        });
      }
      const claimedAt = nextAttemptTimestamp(attemptedAt, latestAttempt);
      const attemptId = randomUUID();
      await attemptRepository.save({
        id: attemptId,
        projectId,
        draftVersion: state.draftVersion,
        referencedFollowUpId: currentReferenceId,
        referencedFollowUpVersion: currentReferenceVersion,
        state: 'SENDING',
        recipientEmail: rendered.recipientEmail,
        subjectLength: rendered.subject.length,
        textLength: rendered.text.length,
        failureCode: null,
        createdAt: claimedAt,
        attemptedAt: claimedAt,
        sentAt: null,
      });
      return {
        attemptId,
        state,
        rendered,
        referencedFollowUpId: currentReferenceId,
        referencedFollowUpVersion: currentReferenceVersion,
        attemptedAt: claimedAt,
      };
    });

    return this.deliverClaimedManualPing(claimed);
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
    const processedStates: CustomerFollowUpState[] = [];
    for (const candidate of candidates) {
      const claimed = await this.claimDueState(candidate.id, now);
      if (!claimed) continue;
      const state = await this.deliverClaimedScheduledPing(claimed, now);
      processedStates.push(toState(
        state,
        await findLatestManualAttempt(this.dataSource.manager, state.projectId),
      ));
    }
    return processedStates;
  }

  private async finalizeManualSuccess(
    claimed: ClaimedManualPing,
  ): Promise<CustomerFollowUpPingDelivery> {
    const sentAt = new Date();
    return this.dataSource.transaction(async (manager) => {
      const attempt = await manager.getRepository(CustomerFollowUpDeliveryAttemptEntity).findOne({
        where: { id: claimed.attemptId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!attempt || attempt.state !== 'SENDING') {
        throw new ConflictException('A Customer follow-up ping kézbesítési állapota megváltozott.');
      }
      const state = await manager.getRepository(CustomerFollowUpEntity).findOne({
        where: { id: claimed.state.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!state) {
        throw new NotFoundException('Customer follow-up state not found.');
      }
      attempt.state = 'SENT';
      attempt.sentAt = sentAt;
      await manager.getRepository(CustomerFollowUpDeliveryAttemptEntity).save(attempt);
      await markDeliverySuccess(manager, state, sentAt, state.enabled);
      await saveAuditEvent(manager, state.projectId, 'CUSTOMER_FOLLOW_UP_PING_SENT', {
        attemptId: attempt.id,
        draftVersion: String(attempt.draftVersion),
        referencedFollowUpId: attempt.referencedFollowUpId ?? 'NONE',
        referencedFollowUpVersion: attempt.referencedFollowUpVersion === null
          ? 'NONE'
          : String(attempt.referencedFollowUpVersion),
        deliveryStatus: sentDeliveryStatus,
        subjectLength: String(attempt.subjectLength),
        textLength: String(attempt.textLength),
        attemptedAt: attempt.attemptedAt.toISOString(),
        sentAt: sentAt.toISOString(),
      });
      return {
        attemptId: attempt.id,
        state: 'SENT',
        draftVersion: attempt.draftVersion,
        referencedFollowUpId: attempt.referencedFollowUpId,
        referencedFollowUpVersion: attempt.referencedFollowUpVersion,
        sentAt: sentAt.toISOString(),
      };
    });
  }

  private async finalizeManualFailure(claimed: ClaimedManualPing): Promise<void> {
    const failedAt = new Date();
    await this.dataSource.transaction(async (manager) => {
      const attempt = await manager.getRepository(CustomerFollowUpDeliveryAttemptEntity).findOne({
        where: { id: claimed.attemptId },
        lock: { mode: 'pessimistic_write' },
      });
      const state = await manager.getRepository(CustomerFollowUpEntity).findOne({
        where: { id: claimed.state.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!attempt || !state || attempt.state !== 'SENDING') {
        return;
      }
      attempt.state = 'FAILED';
      attempt.failureCode = smtpFailureCode;
      await manager.getRepository(CustomerFollowUpDeliveryAttemptEntity).save(attempt);
      await markDeliveryFailure(manager, state, failedAt, state.enabled);
      await saveAuditEvent(manager, state.projectId, 'CUSTOMER_FOLLOW_UP_PING_FAILED', {
        attemptId: attempt.id,
        draftVersion: String(attempt.draftVersion),
        deliveryStatus: failedDeliveryStatus,
        errorCode: smtpFailureCode,
        attemptedAt: attempt.attemptedAt.toISOString(),
      });
    });
  }

  private async deliverClaimedManualPing(
    claimed: ClaimedManualPing,
  ): Promise<CustomerFollowUpPingDelivery> {
    try {
      await this.submitPing(claimed.rendered);
    } catch (error) {
      await this.finalizeManualDeliveryError(claimed, error);
    }
    return this.finalizeManualSuccess(claimed);
  }

  private async reconcileExpiredManualAttempts(
    manager: EntityManager,
    projectId: string,
    now: Date,
  ): Promise<readonly CustomerFollowUpDeliveryAttemptEntity[]> {
    const attemptRepository = manager.getRepository(CustomerFollowUpDeliveryAttemptEntity);
    const activeAttempts = await attemptRepository.find({
      where: { projectId, state: 'SENDING' },
      order: { attemptedAt: 'DESC', createdAt: 'DESC', id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    for (const activeAttempt of activeAttempts) {
      const leaseExpiresAt = new Date(activeAttempt.attemptedAt.getTime() + manualDeliveryLeaseMs);
      if (leaseExpiresAt > now) continue;
      activeAttempt.state = 'UNKNOWN';
      activeAttempt.failureCode = unknownDeliveryCode;
      await attemptRepository.save(activeAttempt);
      await saveAuditEvent(manager, projectId, 'CUSTOMER_FOLLOW_UP_PING_UNKNOWN', {
        attemptId: activeAttempt.id,
        draftVersion: String(activeAttempt.draftVersion),
        deliveryStatus: 'UNKNOWN',
        errorCode: unknownDeliveryCode,
        attemptedAt: activeAttempt.attemptedAt.toISOString(),
        reconciledAt: now.toISOString(),
      });
    }
    return activeAttempts;
  }

  private async finalizeManualUnknown(claimed: ClaimedManualPing): Promise<void> {
    const reconciledAt = new Date();
    await this.dataSource.transaction(async (manager) => {
      const attempt = await manager.getRepository(CustomerFollowUpDeliveryAttemptEntity).findOne({
        where: { id: claimed.attemptId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!attempt || attempt.state !== 'SENDING') {
        return;
      }
      attempt.state = 'UNKNOWN';
      attempt.failureCode = unknownDeliveryCode;
      await manager.getRepository(CustomerFollowUpDeliveryAttemptEntity).save(attempt);
      await saveAuditEvent(manager, attempt.projectId, 'CUSTOMER_FOLLOW_UP_PING_UNKNOWN', {
        attemptId: attempt.id,
        draftVersion: String(attempt.draftVersion),
        deliveryStatus: 'UNKNOWN',
        errorCode: unknownDeliveryCode,
        attemptedAt: attempt.attemptedAt.toISOString(),
        reconciledAt: reconciledAt.toISOString(),
      });
    });
  }

  private async finalizeManualDeliveryError(
    claimed: ClaimedManualPing,
    error: unknown,
  ): Promise<never> {
    if (error instanceof CustomerMailBoundaryError && error.code !== 'OUTCOME_UNKNOWN') {
      await this.finalizeManualFailure(claimed);
      throw new ServiceUnavailableException({
        code: 'FOLLOW_UP_DELIVERY_FAILED',
        message: 'Az ügyfél-ping küldése ismert kézbesítési hiba miatt sikertelen.',
      });
    }
    await this.finalizeManualUnknown(claimed);
    throw new ServiceUnavailableException({
      code: 'FOLLOW_UP_DELIVERY_UNKNOWN',
      message: 'Az ügyfél-ping kézbesítési eredménye bizonytalan. Ellenőrizd a postafiókot az újraküldés előtt.',
    });
  }

  private async claimDueState(id: string, now: Date): Promise<ClaimedManualPing | null> {
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
      let rendered: RenderedCustomerFollowUpPing;
      let reference: DiscoveryFollowUpEntity | null;
      try {
        ({ reference, rendered } = await renderCurrentPing(manager, project, state));
      } catch (error) {
        if (!(error instanceof ConflictException)) {
          throw error;
        }
        state.nextPingAt = null;
        await manager.getRepository(CustomerFollowUpEntity).save(state);
        return null;
      }

      const attemptRepository = manager.getRepository(CustomerFollowUpDeliveryAttemptEntity);
      const activeAttempt = await attemptRepository.findOne({
        where: { projectId: state.projectId, state: 'SENDING' },
        lock: { mode: 'pessimistic_write' },
      });
      if (activeAttempt) {
        return null;
      }
      const latestAttempt = await findLatestManualAttempt(manager, state.projectId);
      const claimedAt = nextAttemptTimestamp(now, latestAttempt);
      const attemptId = randomUUID();
      state.nextPingAt = null;
      await manager.getRepository(CustomerFollowUpEntity).save(state);
      await attemptRepository.save({
        id: attemptId,
        projectId: state.projectId,
        draftVersion: state.draftVersion,
        referencedFollowUpId: reference?.id ?? null,
        referencedFollowUpVersion: reference?.version ?? null,
        state: 'SENDING',
        recipientEmail: rendered.recipientEmail,
        subjectLength: rendered.subject.length,
        textLength: rendered.text.length,
        failureCode: null,
        createdAt: claimedAt,
        attemptedAt: claimedAt,
        sentAt: null,
      });
      return {
        attemptId,
        state,
        rendered,
        referencedFollowUpId: reference?.id ?? null,
        referencedFollowUpVersion: reference?.version ?? null,
        attemptedAt: claimedAt,
      };
    });
  }

  private async deliverClaimedScheduledPing(
    claimed: ClaimedManualPing,
    completedAt: Date,
  ): Promise<CustomerFollowUpEntity> {
    try {
      await this.submitPing(claimed.rendered);
    } catch (error) {
      return this.finalizeScheduledDeliveryError(claimed, completedAt, error);
    }
    return this.finalizeScheduledSuccess(claimed, completedAt);
  }

  private async finalizeScheduledSuccess(
    claimed: ClaimedManualPing,
    sentAt: Date,
  ): Promise<CustomerFollowUpEntity> {
    return this.dataSource.transaction(async (manager) => {
      const { attempt, state } = await requireClaimedScheduledState(manager, claimed);
      attempt.state = 'SENT';
      attempt.sentAt = sentAt;
      await manager.getRepository(CustomerFollowUpDeliveryAttemptEntity).save(attempt);
      await markDeliverySuccess(manager, state, sentAt, state.enabled);
      await saveAuditEvent(manager, state.projectId, 'CUSTOMER_FOLLOW_UP_PING_SENT', {
        attemptId: attempt.id,
        deliveryKind: 'SCHEDULED',
        draftVersion: String(attempt.draftVersion),
        referencedFollowUpId: attempt.referencedFollowUpId ?? 'NONE',
        referencedFollowUpVersion: attempt.referencedFollowUpVersion === null
          ? 'NONE'
          : String(attempt.referencedFollowUpVersion),
        deliveryStatus: sentDeliveryStatus,
        subjectLength: String(attempt.subjectLength),
        textLength: String(attempt.textLength),
        attemptedAt: attempt.attemptedAt.toISOString(),
        sentAt: sentAt.toISOString(),
      });
      return state;
    });
  }

  private async finalizeScheduledDeliveryError(
    claimed: ClaimedManualPing,
    failedAt: Date,
    error: unknown,
  ): Promise<CustomerFollowUpEntity> {
    const unknown = !(error instanceof CustomerMailBoundaryError)
      || error.code === 'OUTCOME_UNKNOWN';
    return this.dataSource.transaction(async (manager) => {
      const { attempt, state } = await requireClaimedScheduledState(manager, claimed);
      attempt.state = unknown ? 'UNKNOWN' : 'FAILED';
      attempt.failureCode = unknown ? unknownDeliveryCode : smtpFailureCode;
      await manager.getRepository(CustomerFollowUpDeliveryAttemptEntity).save(attempt);
      state.lastPingAt = failedAt;
      if (unknown) {
        state.nextPingAt = null;
        await manager.getRepository(CustomerFollowUpEntity).save(state);
      } else {
        await markDeliveryFailure(manager, state, failedAt, state.enabled);
      }
      await saveAuditEvent(
        manager,
        state.projectId,
        unknown ? 'CUSTOMER_FOLLOW_UP_PING_UNKNOWN' : 'CUSTOMER_FOLLOW_UP_PING_FAILED',
        {
          attemptId: attempt.id,
          deliveryKind: 'SCHEDULED',
          draftVersion: String(attempt.draftVersion),
          deliveryStatus: unknown ? 'UNKNOWN' : failedDeliveryStatus,
          errorCode: attempt.failureCode,
          attemptedAt: attempt.attemptedAt.toISOString(),
        },
      );
      return state;
    });
  }

  private requireMailer(): void {
    if (!this.mailer.isConfigured()) {
      throw new ServiceUnavailableException(
        'Customer email delivery is not configured on this API.',
      );
    }
  }

  private async submitPing(rendered: RenderedCustomerFollowUpPing): Promise<void> {
    const result = await this.mailer.submit(immutableOutboundCustomerMessage({
      recipientAddress: rendered.recipientEmail,
      subject: rendered.subject,
      textContent: rendered.text,
    }));
    if (result.acceptance === 'REJECTED') {
      throw new CustomerMailBoundaryError('SUBMISSION_REJECTED');
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

async function requireClaimedScheduledState(
  manager: EntityManager,
  claimed: ClaimedManualPing,
): Promise<{
  readonly attempt: CustomerFollowUpDeliveryAttemptEntity;
  readonly state: CustomerFollowUpEntity;
}> {
  const attempt = await manager.getRepository(CustomerFollowUpDeliveryAttemptEntity).findOne({
    where: { id: claimed.attemptId },
    lock: { mode: 'pessimistic_write' },
  });
  const state = await manager.getRepository(CustomerFollowUpEntity).findOne({
    where: { id: claimed.state.id },
    lock: { mode: 'pessimistic_write' },
  });
  if (!attempt || !state || attempt.state !== 'SENDING') {
    throw new ConflictException('A Customer follow-up ping kézbesítési állapota megváltozott.');
  }
  return { attempt, state };
}

async function initialDiscoveryFollowUpStatus(): Promise<string> {
  const playbook = await loadGeneralPlaybookV1();
  const status = playbook.statuses.followUp[0];
  if (!status) {
    throw new InternalServerErrorException('Canonical Discovery follow-up status is unavailable.');
  }
  return status;
}

async function requireOpenReference(
  manager: EntityManager,
  projectId: string,
  followUpId: string,
): Promise<DiscoveryFollowUpEntity> {
  const followUp = await manager.getRepository(DiscoveryFollowUpEntity).findOneBy({
    id: followUpId,
    projectId,
  });
  if (!followUp || followUp.status !== (await initialDiscoveryFollowUpStatus())) {
    throw new ConflictException({
      code: 'FOLLOW_UP_REFERENCE_INVALID',
      message: 'A hivatkozott Discovery follow-up már nem nyitott vagy nem ehhez a projekthez tartozik. Válassz egy aktuális nyitott kérdést.',
    });
  }
  return followUp;
}

async function renderCurrentPing(
  manager: EntityManager,
  project: Project,
  state: CustomerFollowUpEntity,
): Promise<{
  readonly reference: DiscoveryFollowUpEntity | null;
  readonly rendered: RenderedCustomerFollowUpPing;
}> {
  if (!state.messageDraft) {
    throw new ConflictException({
      code: 'FOLLOW_UP_DRAFT_REQUIRED',
      message: 'Előbb ments egy nem üres Customer follow-up ping üzenetet.',
    });
  }
  const reference = state.referencedFollowUpId
    ? await requireOpenReference(manager, project.id, state.referencedFollowUpId)
    : null;
  return {
    reference,
    rendered: renderCustomerFollowUpPing(project, state.messageDraft, reference),
  };
}

function requireCurrentDraftVersion(state: CustomerFollowUpEntity, expectedVersion: number): void {
  if (state.draftVersion !== expectedVersion) {
    throw new ConflictException({
      code: 'FOLLOW_UP_DRAFT_STALE',
      message: 'A Customer follow-up ping piszkozata időközben megváltozott. Töltsd újra az aktuális változatot.',
    });
  }
}

function clearPreview(state: CustomerFollowUpEntity): void {
  state.previewTokenDigest = null;
  state.previewFingerprint = null;
  state.previewExpiresAt = null;
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function pingFingerprint(
  state: CustomerFollowUpEntity,
  rendered: RenderedCustomerFollowUpPing,
  reference: DiscoveryFollowUpEntity | null,
): string {
  return digest(JSON.stringify({
    draftVersion: state.draftVersion,
    messageDraft: state.messageDraft,
    referencedFollowUpId: reference?.id ?? null,
    referencedFollowUpVersion: reference?.version ?? null,
    recipientName: rendered.recipientName,
    recipientEmail: rendered.recipientEmail,
    subject: rendered.subject,
    text: rendered.text,
  }));
}

function toReferenceOption(value: DiscoveryFollowUpEntity): CustomerFollowUpReferenceOption {
  return {
    id: value.id,
    question: value.question,
    nextStep: value.nextStep,
    dueDate: value.dueDate,
    version: value.version,
  };
}

function createDefaultState(projectId: string): CustomerFollowUpEntity {
  return {
    id: randomUUID(),
    projectId,
    messageDraft: null,
    referencedFollowUpId: null,
    draftVersion: 1,
    previewTokenDigest: null,
    previewFingerprint: null,
    previewExpiresAt: null,
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

function nextAttemptTimestamp(
  requestedAt: Date,
  latestAttempt: CustomerFollowUpDeliveryAttemptEntity | null,
): Date {
  if (!latestAttempt || latestAttempt.attemptedAt < requestedAt) return requestedAt;
  return new Date(latestAttempt.attemptedAt.getTime() + 1);
}

function rejectArchivedProject(project: Project): void {
  if (project.status === 'ARCHIVED') {
    throw new ConflictException('Archived projects cannot send customer emails.');
  }
}

function findLatestManualAttempt(
  manager: EntityManager,
  projectId: string,
): Promise<CustomerFollowUpDeliveryAttemptEntity | null> {
  return manager.getRepository(CustomerFollowUpDeliveryAttemptEntity).findOne({
    where: { projectId },
    order: { attemptedAt: 'DESC', createdAt: 'DESC', id: 'ASC' },
  });
}

function toState(
  value: CustomerFollowUpEntity,
  latestManualAttempt: CustomerFollowUpDeliveryAttemptEntity | null = null,
): CustomerFollowUpState {
  return {
    projectId: value.projectId,
    messageDraft: value.messageDraft,
    referencedFollowUpId: value.referencedFollowUpId,
    draftVersion: value.draftVersion,
    enabled: value.enabled,
    intervalMinutes: value.intervalMinutes,
    expiresAt: toIsoOrNull(value.expiresAt, 'follow-up expiresAt'),
    lastPingAt: toIsoOrNull(value.lastPingAt, 'follow-up lastPingAt'),
    nextPingAt: toIsoOrNull(value.nextPingAt, 'follow-up nextPingAt'),
    lastDeliveryStatus: value.lastDeliveryStatus,
    lastDeliveryError: toSafeDeliveryError(value.lastDeliveryError),
    latestManualAttempt: latestManualAttempt ? toManualAttempt(latestManualAttempt) : null,
  };
}

function toManualAttempt(value: CustomerFollowUpDeliveryAttemptEntity): CustomerFollowUpManualAttempt {
  return {
    attemptId: value.id,
    state: value.state,
    draftVersion: value.draftVersion,
    referencedFollowUpId: value.referencedFollowUpId,
    referencedFollowUpVersion: value.referencedFollowUpVersion,
    failureCode: toSafeManualFailureCode(value.failureCode),
    attemptedAt: value.attemptedAt.toISOString(),
    sentAt: value.sentAt?.toISOString() ?? null,
  };
}

function toSafeManualFailureCode(value: string | null): string | null {
  if (value === null || value === smtpFailureCode || value === unknownDeliveryCode) return value;
  return 'DELIVERY_FAILED';
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
