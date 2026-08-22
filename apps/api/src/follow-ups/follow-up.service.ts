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
  CorrespondenceMailboxIdentity,
  CustomerFollowUpReferenceOption,
  CustomerFollowUpManualAttempt,
  CustomerFollowUpPingDelivery,
  CustomerFollowUpPingPreview,
  CustomerFollowUpState,
  FollowUpDeliveryStatus,
  MailSubmissionResult,
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
import { hasCustomerReceiptEvidence } from '../customer-replies/customer-receipt-evidence';
import { CustomerCorrespondenceEntity } from '../interview-customer-handoffs/customer-correspondence.entity';
import { CustomerOutboundAttemptEntity } from '../interview-customer-handoffs/customer-outbound-attempt.entity';
import { CustomerOutboundCommunicationEntity } from '../interview-customer-handoffs/customer-outbound-communication.entity';
import {
  appendCanonicalOutboundAttempt,
  createCanonicalOutbound,
} from '../interview-customer-handoffs/customer-outbound-persistence';
import { DiscoveryFollowUpEntity } from '../discovery-follow-ups/discovery-follow-up.entity';
import {
  CustomerMailBoundaryError,
  type CustomerOutboundMail,
  customerOutboundMailToken,
  immutableOutboundCustomerMessage,
} from '../mail-delivery/customer-mail-boundary';
import {
  customerMailDigest,
  customerReplyToAddress,
  dedicatedCustomerSender,
  type ResolvedCustomerSender,
} from '../mail-delivery/customer-mail-identity';
import { CustomerFollowUpEntity } from './follow-up.entity';
import { CustomerFollowUpDeliveryAttemptEntity } from './follow-up-delivery-attempt.entity';
import {
  renderCustomerFollowUpPing,
  type RenderedCustomerFollowUpPing,
} from './customer-follow-up-ping.renderer';
import {
  minimumFollowUpIntervalMinutes,
  maximumFollowUpIntervalMinutes,
} from './dto/update-follow-up.dto';
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

interface ClaimedCustomerFollowUpPing {
  readonly attemptId: string;
  readonly state: CustomerFollowUpEntity;
  readonly rendered: RenderedCustomerFollowUpPing;
  readonly referencedFollowUpId: string | null;
  readonly referencedFollowUpVersion: number | null;
  readonly attemptedAt: Date;
  readonly outbound: CustomerOutboundCommunicationEntity;
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
    private readonly configService: ConfigService,
  ) {
    this.pollIntervalMs =
      createFollowUpConfiguration(configService).pollIntervalMs;
  }

  onModuleInit(): void {
    // Every API process may poll in a multi-replica deployment. Due rows are
    // selected again under a PostgreSQL row lock before mail-gateway submission, so only one
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
      const existing = await manager
        .getRepository(CustomerFollowUpEntity)
        .findOneBy({ projectId });
      await this.reconcileExpiredManualAttempts(manager, projectId, new Date());
      const latestManualAttempt = await findLatestManualAttempt(
        manager,
        projectId,
      );
      return await toState(
        manager,
        existing ?? createDefaultState(projectId),
        latestManualAttempt,
        await hasCustomerReceiptEvidence(
          manager,
          latestManualAttempt?.correspondenceId ?? null,
        ),
      );
    });
  }

  async update(
    projectId: string,
    input: UpdateFollowUpDto,
  ): Promise<CustomerFollowUpState> {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException(
        'Follow-up update must include at least one field.',
      );
    }
    validateInterval(input.intervalMinutes);
    const now = new Date();

    return this.dataSource.transaction(async (manager) => {
      const project = await this.findProject(manager, projectId, true);
      rejectArchivedProject(project);
      const state = await findOrCreateLockedState(manager, projectId);
      const intervalMinutes = input.intervalMinutes ?? state.intervalMinutes;
      const enabled = input.enabled ?? state.enabled;
      const expiresAt = parseExpiresAt(
        input.expiresAt,
        state.expiresAt,
        now,
        enabled,
      );
      if (enabled) {
        this.requireMailer();
        await renderCurrentPing(manager, project, state);
      }

      state.enabled = enabled;
      state.intervalMinutes = intervalMinutes;
      state.expiresAt = expiresAt;
      state.nextPingAt = enabled ? addMinutes(now, intervalMinutes) : null;
      state.pausedRemainingMilliseconds = null;
      if (!enabled) {
        state.nextPingAt = null;
      }
      const saved = await manager
        .getRepository(CustomerFollowUpEntity)
        .save(state);
      await saveAuditEvent(manager, projectId, 'FOLLOW_UP_SETTINGS_UPDATED', {
        enabled: String(saved.enabled),
        intervalMinutes: String(saved.intervalMinutes),
        expiresAt: saved.expiresAt ? saved.expiresAt.toISOString() : 'NONE',
      });
      const latestAttempt = await findLatestManualAttempt(manager, projectId);
      return await toState(
        manager,
        saved,
        latestAttempt,
        await hasCustomerReceiptEvidence(
          manager,
          latestAttempt?.correspondenceId ?? null,
        ),
      );
    });
  }

  async listReferenceOptions(
    projectId: string,
  ): Promise<readonly CustomerFollowUpReferenceOption[]> {
    await this.findProject(this.dataSource.manager, projectId, false);
    const openStatus = await initialDiscoveryFollowUpStatus();
    const followUps = await this.dataSource.manager
      .getRepository(DiscoveryFollowUpEntity)
      .find({
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
      throw new BadRequestException(
        'The Customer follow-up message cannot be empty.',
      );
    }

    const now = new Date();
    return this.dataSource.transaction(async (manager) => {
      const project = await this.findProject(manager, projectId, true);
      rejectArchivedProject(project);
      const state = await findOrCreateLockedState(manager, projectId);
      if (state.draftVersion !== input.expectedVersion) {
        throw new ConflictException({
          code: 'FOLLOW_UP_DRAFT_STALE',
          message:
            'The Customer follow-up draft changed. Reload the current version or keep your local text.',
        });
      }
      const referencedFollowUp = input.referencedFollowUpId
        ? await requireOpenReference(
            manager,
            projectId,
            input.referencedFollowUpId,
          )
        : null;

      state.messageDraft = messageDraft;
      state.referencedFollowUpId = referencedFollowUp?.id ?? null;
      state.draftVersion += 1;
      clearPreview(state);
      const latestAttempt = await findLatestManualAttempt(manager, projectId);
      if (
        state.enabled &&
        state.nextPingAt === null &&
        latestAttempt?.state !== 'SENDING' &&
        latestAttempt?.state !== 'UNKNOWN'
      ) {
        state.nextPingAt = addMinutes(now, state.intervalMinutes);
      }
      const saved = await manager
        .getRepository(CustomerFollowUpEntity)
        .save(state);
      await saveAuditEvent(
        manager,
        projectId,
        'CUSTOMER_FOLLOW_UP_DRAFT_UPDATED',
        {
          draftVersion: String(saved.draftVersion),
          hasReference: String(referencedFollowUp !== null),
          messageLength: String(messageDraft.length),
        },
      );
      return await toState(
        manager,
        saved,
        latestAttempt,
        await hasCustomerReceiptEvidence(
          manager,
          latestAttempt?.correspondenceId ?? null,
        ),
      );
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
      const { reference, rendered } = await renderCurrentPing(
        manager,
        project,
        state,
      );
      const sender = dedicatedCustomerSender(this.configService);
      const previewToken = randomBytes(32).toString('base64url');
      const expiresAt = new Date(now.getTime() + previewLifetimeMs);
      state.previewTokenDigest = digest(previewToken);
      state.previewSenderName = sender.name;
      state.previewSenderAddress = sender.address;
      state.previewFingerprint = pingFingerprint(
        state,
        rendered,
        reference,
        sender,
      );
      state.previewExpiresAt = expiresAt;
      await manager.getRepository(CustomerFollowUpEntity).save(state);
      return {
        ...rendered,
        senderName: sender.name,
        senderAddress: sender.address,
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
    const claim = await this.dataSource.transaction(
      async (
        manager,
      ): Promise<
        ClaimedCustomerFollowUpPing | DuplicateRiskAcknowledgementRequired
      > => {
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
            message:
              'The preview expired or has already been used. Generate a new preview before sending.',
          });
        }
        const { reference, rendered } = await renderCurrentPing(
          manager,
          project,
          state,
        );
        if (!state.previewSenderName || !state.previewSenderAddress) {
          throw new ConflictException({
            code: 'FOLLOW_UP_PREVIEW_STALE',
            message: 'The sender identity is missing from the preview.',
          });
        }
        const sender = {
          name: state.previewSenderName,
          address: state.previewSenderAddress,
        };
        if (
          pingFingerprint(state, rendered, reference, sender) !==
          state.previewFingerprint
        ) {
          clearPreview(state);
          await manager.getRepository(CustomerFollowUpEntity).save(state);
          throw new ConflictException({
            code: 'FOLLOW_UP_PREVIEW_STALE',
            message:
              'The recipient, draft, or referenced follow-up changed. Review a new preview before sending.',
          });
        }
        const attemptRepository = manager.getRepository(
          CustomerFollowUpDeliveryAttemptEntity,
        );
        const activeAttempts = await this.reconcileExpiredManualAttempts(
          manager,
          projectId,
          attemptedAt,
        );
        if (activeAttempts.some((attempt) => attempt.state === 'SENDING')) {
          throw new ConflictException({
            code: 'FOLLOW_UP_DELIVERY_IN_PROGRESS',
            message:
              'The Customer follow-up is already being sent. Wait for the delivery outcome.',
          });
        }
        const latestAttempt =
          activeAttempts[0] ??
          (await attemptRepository.findOne({
            where: {
              projectId,
            },
            order: { attemptedAt: 'DESC', createdAt: 'DESC', id: 'ASC' },
          }));
        if (
          latestAttempt?.state === 'UNKNOWN' &&
          input.acknowledgeDuplicateRiskForAttemptId !== latestAttempt.id
        ) {
          return { requiresDuplicateRiskAcknowledgement: true };
        }
        const claimedAt = nextAttemptTimestamp(attemptedAt, latestAttempt);
        const attemptId = randomUUID();
        const attempt = await attemptRepository.save({
          id: attemptId,
          projectId,
          draftVersion: state.draftVersion,
          referencedFollowUpId: reference?.id ?? null,
          referencedFollowUpVersion: reference?.version ?? null,
          state: 'SENDING',
          createdAt: claimedAt,
          attemptedAt: claimedAt,
          outboundCommunicationId: null,
          correspondenceId: null,
        });
        const outbound = await createPingCorrespondence(
          manager,
          this.configService,
          project,
          attempt,
          rendered,
          sender,
          reference,
        );
        clearPreview(state);
        await manager.getRepository(CustomerFollowUpEntity).save(state);
        return {
          attemptId,
          state,
          rendered,
          referencedFollowUpId: reference?.id ?? null,
          referencedFollowUpVersion: reference?.version ?? null,
          attemptedAt: claimedAt,
          outbound,
        };
      },
    );

    if ('requiresDuplicateRiskAcknowledgement' in claim) {
      throw new ConflictException({
        code: 'FOLLOW_UP_DELIVERY_UNKNOWN',
        message:
          'The previous delivery outcome cannot be confirmed. Check the mailbox and retry only after acknowledging the duplicate-delivery risk.',
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
    const claimed = await this.dataSource.transaction(
      async (manager): Promise<ClaimedCustomerFollowUpPing> => {
        const project = await this.findProject(manager, projectId, true);
        rejectArchivedProject(project);
        const state = await findOrCreateLockedState(manager, projectId);
        const attemptRepository = manager.getRepository(
          CustomerFollowUpDeliveryAttemptEntity,
        );
        const latestAttempt = await attemptRepository.findOne({
          where: { projectId },
          order: { attemptedAt: 'DESC', createdAt: 'DESC', id: 'ASC' },
          lock: { mode: 'pessimistic_write' },
        });
        if (!latestAttempt || latestAttempt.id !== input.attemptId) {
          throw new ConflictException({
            code: 'FOLLOW_UP_RETRY_STALE',
            message:
              'The delivery state changed. Reload the current state.',
          });
        }
        if (
          await hasCustomerReceiptEvidence(
            manager,
            latestAttempt.correspondenceId,
          )
        ) {
          throw new ConflictException({
            code: 'FOLLOW_UP_RECEIPT_EVIDENCE',
            message:
              'A Customer reply confirms receipt; this logical delivery must not be sent again.',
          });
        }
        if (
          latestAttempt.state === 'UNKNOWN' &&
          !input.acknowledgeDuplicateRisk
        ) {
          throw new ConflictException({
            code: 'FOLLOW_UP_DUPLICATE_RISK_ACKNOWLEDGEMENT_REQUIRED',
            message:
              'The previous delivery outcome is uncertain. A retry requires explicit acknowledgement of the duplicate-delivery risk.',
          });
        }
        if (
          latestAttempt.state !== 'FAILED' &&
          latestAttempt.state !== 'UNKNOWN'
        ) {
          throw new ConflictException({
            code: 'FOLLOW_UP_RETRY_NOT_AVAILABLE',
            message: 'This delivery attempt cannot be retried.',
          });
        }
        const { reference, rendered } = await renderCurrentPing(
          manager,
          project,
          state,
        );
        const currentReferenceId = reference?.id ?? null;
        const currentReferenceVersion = reference?.version ?? null;
        const storedOutbound = latestAttempt.outboundCommunicationId
          ? await manager
              .getRepository(CustomerOutboundCommunicationEntity)
              .findOneBy({ id: latestAttempt.outboundCommunicationId })
          : null;
        const storedRecipient =
          storedOutbound?.recipientAddress ?? latestAttempt.legacyRecipientEmail;
        if (
          state.draftVersion !== latestAttempt.draftVersion ||
          currentReferenceId !== latestAttempt.referencedFollowUpId ||
          currentReferenceVersion !== latestAttempt.referencedFollowUpVersion ||
          (storedRecipient !== null &&
            rendered.recipientEmail !== storedRecipient)
        ) {
          throw new ConflictException({
            code: 'FOLLOW_UP_RETRY_STALE',
            message:
              'The recipient, draft, or referenced follow-up changed. Generate a new preview.',
          });
        }
        const claimedAt = nextAttemptTimestamp(attemptedAt, latestAttempt);
        if (
          (latestAttempt.outboundCommunicationId === null) !==
          (latestAttempt.correspondenceId === null)
        ) {
          throw new ConflictException({
            code: 'FOLLOW_UP_RETRY_STALE',
            message:
              'The durable mail identity of the previous delivery is incomplete.',
          });
        }
        const outbound = latestAttempt.outboundCommunicationId
          ? storedOutbound
          : await createPingCorrespondence(
              manager,
              this.configService,
              project,
              latestAttempt,
              rendered,
              dedicatedCustomerSender(this.configService),
              reference,
            );
        if (!outbound)
          throw new InternalServerErrorException(
            'The durable outbound communication record is missing.',
          );
        latestAttempt.state = 'SENDING';
        latestAttempt.attemptedAt = claimedAt;
        await attemptRepository.save(latestAttempt);
        return {
          attemptId: latestAttempt.id,
          state,
          rendered,
          referencedFollowUpId: currentReferenceId,
          referencedFollowUpVersion: currentReferenceVersion,
          attemptedAt: claimedAt,
          outbound,
        };
      },
    );

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
      const claimed = await this.claimDueState(
        candidate.id,
        candidate.projectId,
        now,
      );
      if (!claimed) continue;
      const state = await this.deliverClaimedScheduledPing(claimed, now);
      processedStates.push(
        await toState(
          this.dataSource.manager,
          state,
          await findLatestManualAttempt(
            this.dataSource.manager,
            state.projectId,
          ),
        ),
      );
    }
    return processedStates;
  }

  private async finalizeManualSuccess(
    claimed: ClaimedCustomerFollowUpPing,
    result: MailSubmissionResult,
  ): Promise<CustomerFollowUpPingDelivery> {
    const sentAt = new Date();
    return this.dataSource.transaction(async (manager) => {
      const state = await manager
        .getRepository(CustomerFollowUpEntity)
        .findOne({
          where: { id: claimed.state.id },
          lock: { mode: 'pessimistic_write' },
        });
      if (!state) {
        throw new NotFoundException('Customer follow-up state not found.');
      }
      const attempt = await manager
        .getRepository(CustomerFollowUpDeliveryAttemptEntity)
        .findOne({
          where: { id: claimed.attemptId },
          lock: { mode: 'pessimistic_write' },
        });
      if (!attempt || attempt.state !== 'SENDING') {
        throw new ConflictException(
          'The Customer follow-up delivery state changed.',
        );
      }
      attempt.state = 'SENT';
      await manager
        .getRepository(CustomerFollowUpDeliveryAttemptEntity)
        .save(attempt);
      await recordOutboundAttempt(
        manager,
        attempt,
        'ACCEPTED',
        null,
        result.messageReference,
      );
      await markDeliverySuccess(manager, state, sentAt, state.enabled);
      await saveAuditEvent(
        manager,
        state.projectId,
        'CUSTOMER_FOLLOW_UP_PING_SENT',
        {
          attemptId: attempt.id,
          draftVersion: String(attempt.draftVersion),
          referencedFollowUpId: attempt.referencedFollowUpId ?? 'NONE',
          referencedFollowUpVersion:
            attempt.referencedFollowUpVersion === null
              ? 'NONE'
              : String(attempt.referencedFollowUpVersion),
          deliveryStatus: sentDeliveryStatus,
          subjectLength: String(claimed.rendered.subject.length),
          textLength: String(claimed.rendered.text.length),
          attemptedAt: attempt.attemptedAt.toISOString(),
          sentAt: sentAt.toISOString(),
        },
      );
      return {
        attemptId: attempt.id,
        state: 'SENT',
        draftVersion: attempt.draftVersion,
        referencedFollowUpId: attempt.referencedFollowUpId,
        referencedFollowUpVersion: attempt.referencedFollowUpVersion,
        sentAt: sentAt.toISOString(),
        correspondenceId: attempt.correspondenceId!,
        mailSystemAcceptance: 'ACCEPTED',
        messageReference: result.messageReference,
      };
    });
  }

  private async finalizeManualFailure(
    claimed: ClaimedCustomerFollowUpPing,
    result?: {
      readonly acceptance: 'ACCEPTED' | 'REJECTED';
      readonly messageReference: string | null;
    },
  ): Promise<void> {
    const failedAt = new Date();
    await this.dataSource.transaction(async (manager) => {
      const state = await manager
        .getRepository(CustomerFollowUpEntity)
        .findOne({
          where: { id: claimed.state.id },
          lock: { mode: 'pessimistic_write' },
        });
      const attempt = await manager
        .getRepository(CustomerFollowUpDeliveryAttemptEntity)
        .findOne({
          where: { id: claimed.attemptId },
          lock: { mode: 'pessimistic_write' },
        });
      if (!attempt || !state || attempt.state !== 'SENDING') {
        return;
      }
      attempt.state = 'FAILED';
      await manager
        .getRepository(CustomerFollowUpDeliveryAttemptEntity)
        .save(attempt);
      await recordOutboundAttempt(
        manager,
        attempt,
        'REJECTED',
        smtpFailureCode,
        result?.messageReference ?? null,
      );
      await markDeliveryFailure(manager, state, failedAt, state.enabled);
      await saveAuditEvent(
        manager,
        state.projectId,
        'CUSTOMER_FOLLOW_UP_PING_FAILED',
        {
          attemptId: attempt.id,
          draftVersion: String(attempt.draftVersion),
          deliveryStatus: failedDeliveryStatus,
          errorCode: smtpFailureCode,
          attemptedAt: attempt.attemptedAt.toISOString(),
        },
      );
    });
  }

  private async deliverClaimedManualPing(
    claimed: ClaimedCustomerFollowUpPing,
  ): Promise<CustomerFollowUpPingDelivery> {
    try {
      const result = await this.submitPing(claimed.outbound);
      if (result.acceptance === 'REJECTED') {
        await this.finalizeManualFailure(claimed, result);
        throw new ServiceUnavailableException({
          code: 'FOLLOW_UP_DELIVERY_FAILED',
          message:
            'The Customer follow-up failed because of a confirmed delivery error.',
        });
      }
      return this.finalizeManualSuccess(claimed, result);
    } catch (error) {
      if (error instanceof ServiceUnavailableException) throw error;
      return this.finalizeManualDeliveryError(claimed, error);
    }
  }

  private async reconcileExpiredManualAttempts(
    manager: EntityManager,
    projectId: string,
    now: Date,
  ): Promise<readonly CustomerFollowUpDeliveryAttemptEntity[]> {
    const attemptRepository = manager.getRepository(
      CustomerFollowUpDeliveryAttemptEntity,
    );
    const activeAttempts = await attemptRepository.find({
      where: { projectId, state: 'SENDING' },
      order: { attemptedAt: 'DESC', createdAt: 'DESC', id: 'ASC' },
      lock: { mode: 'pessimistic_write' },
    });
    for (const activeAttempt of activeAttempts) {
      const leaseExpiresAt = new Date(
        activeAttempt.attemptedAt.getTime() + manualDeliveryLeaseMs,
      );
      if (leaseExpiresAt > now) continue;
      activeAttempt.state = 'UNKNOWN';
      await attemptRepository.save(activeAttempt);
      await recordOutboundAttempt(
        manager,
        activeAttempt,
        'UNKNOWN',
        unknownDeliveryCode,
        null,
      );
      await saveAuditEvent(
        manager,
        projectId,
        'CUSTOMER_FOLLOW_UP_PING_UNKNOWN',
        {
          attemptId: activeAttempt.id,
          draftVersion: String(activeAttempt.draftVersion),
          deliveryStatus: 'UNKNOWN',
          errorCode: unknownDeliveryCode,
          attemptedAt: activeAttempt.attemptedAt.toISOString(),
          reconciledAt: now.toISOString(),
        },
      );
    }
    return activeAttempts;
  }

  private async finalizeManualUnknown(
    claimed: ClaimedCustomerFollowUpPing,
  ): Promise<void> {
    const reconciledAt = new Date();
    await this.dataSource.transaction(async (manager) => {
      const state = await manager
        .getRepository(CustomerFollowUpEntity)
        .findOne({
          where: { id: claimed.state.id },
          lock: { mode: 'pessimistic_write' },
        });
      if (!state) {
        return;
      }
      const attempt = await manager
        .getRepository(CustomerFollowUpDeliveryAttemptEntity)
        .findOne({
          where: { id: claimed.attemptId },
          lock: { mode: 'pessimistic_write' },
        });
      if (!attempt || attempt.state !== 'SENDING') {
        return;
      }
      attempt.state = 'UNKNOWN';
      await manager
        .getRepository(CustomerFollowUpDeliveryAttemptEntity)
        .save(attempt);
      await recordOutboundAttempt(
        manager,
        attempt,
        'UNKNOWN',
        unknownDeliveryCode,
        null,
      );
      state.nextPingAt = null;
      await manager.getRepository(CustomerFollowUpEntity).save(state);
      await saveAuditEvent(
        manager,
        attempt.projectId,
        'CUSTOMER_FOLLOW_UP_PING_UNKNOWN',
        {
          attemptId: attempt.id,
          draftVersion: String(attempt.draftVersion),
          deliveryStatus: 'UNKNOWN',
          errorCode: unknownDeliveryCode,
          attemptedAt: attempt.attemptedAt.toISOString(),
          reconciledAt: reconciledAt.toISOString(),
        },
      );
    });
  }

  private async finalizeManualDeliveryError(
    claimed: ClaimedCustomerFollowUpPing,
    error: unknown,
  ): Promise<never> {
    if (
      error instanceof CustomerMailBoundaryError &&
      error.code !== 'OUTCOME_UNKNOWN'
    ) {
      await this.finalizeManualFailure(claimed);
      throw new ServiceUnavailableException({
        code: 'FOLLOW_UP_DELIVERY_FAILED',
        message:
          'The Customer follow-up failed because of a confirmed delivery error.',
      });
    }
    await this.finalizeManualUnknown(claimed);
    throw new ServiceUnavailableException({
      code: 'FOLLOW_UP_DELIVERY_UNKNOWN',
      message:
        'The Customer follow-up delivery outcome is uncertain. Check the mailbox before retrying.',
    });
  }

  private async claimDueState(
    id: string,
    projectId: string,
    now: Date,
  ): Promise<ClaimedCustomerFollowUpPing | null> {
    return this.dataSource.transaction(async (manager) => {
      const project = await this.findProject(manager, projectId, true);
      const state = await manager
        .getRepository(CustomerFollowUpEntity)
        .findOne({
          where: { id, projectId },
          lock: { mode: 'pessimistic_write' },
        });
      if (
        !state ||
        !state.enabled ||
        !state.nextPingAt ||
        state.nextPingAt > now
      ) {
        return null;
      }
      if (state.expiresAt && state.expiresAt <= now) {
        state.enabled = false;
        state.nextPingAt = null;
        await manager.getRepository(CustomerFollowUpEntity).save(state);
        return null;
      }

      if (project.status === 'ARCHIVED') {
        return null;
      }
      let rendered: RenderedCustomerFollowUpPing;
      let reference: DiscoveryFollowUpEntity | null;
      try {
        ({ reference, rendered } = await renderCurrentPing(
          manager,
          project,
          state,
          true,
        ));
      } catch (error) {
        if (!(error instanceof ConflictException)) {
          throw error;
        }
        state.nextPingAt = null;
        await manager.getRepository(CustomerFollowUpEntity).save(state);
        return null;
      }

      const attemptRepository = manager.getRepository(
        CustomerFollowUpDeliveryAttemptEntity,
      );
      const activeAttempt = await attemptRepository.findOne({
        where: { projectId: state.projectId, state: 'SENDING' },
        lock: { mode: 'pessimistic_write' },
      });
      if (activeAttempt) {
        return null;
      }
      const latestAttempt = await findLatestManualAttempt(
        manager,
        state.projectId,
      );
      if (latestAttempt?.state === 'UNKNOWN') {
        state.nextPingAt = null;
        await manager.getRepository(CustomerFollowUpEntity).save(state);
        return null;
      }
      const claimedAt = nextAttemptTimestamp(now, latestAttempt);
      const attemptId = randomUUID();
      state.nextPingAt = null;
      await manager.getRepository(CustomerFollowUpEntity).save(state);
      const attempt = await attemptRepository.save({
        id: attemptId,
        projectId: state.projectId,
        draftVersion: state.draftVersion,
        referencedFollowUpId: reference?.id ?? null,
        referencedFollowUpVersion: reference?.version ?? null,
        state: 'SENDING',
        createdAt: claimedAt,
        attemptedAt: claimedAt,
        outboundCommunicationId: null,
        correspondenceId: null,
      });
      const sender = dedicatedCustomerSender(this.configService);
      const outbound = await createPingCorrespondence(
        manager,
        this.configService,
        project,
        attempt,
        rendered,
        sender,
        reference,
      );
      return {
        attemptId,
        state,
        rendered,
        referencedFollowUpId: reference?.id ?? null,
        referencedFollowUpVersion: reference?.version ?? null,
        attemptedAt: claimedAt,
        outbound,
      };
    });
  }

  private async deliverClaimedScheduledPing(
    claimed: ClaimedCustomerFollowUpPing,
    completedAt: Date,
  ): Promise<CustomerFollowUpEntity> {
    try {
      const result = await this.submitPing(claimed.outbound);
      if (result.acceptance === 'REJECTED') {
        return this.finalizeScheduledDeliveryError(
          claimed,
          completedAt,
          new CustomerMailBoundaryError('SUBMISSION_REJECTED'),
          result,
        );
      }
      return this.finalizeScheduledSuccess(claimed, completedAt, result);
    } catch (error) {
      return this.finalizeScheduledDeliveryError(claimed, completedAt, error);
    }
  }

  async senderIdentity(
    projectId: string,
  ): Promise<CorrespondenceMailboxIdentity> {
    return this.dataSource.transaction(async (manager) => {
      await this.findProject(manager, projectId, false);
      const dedicated = dedicatedCustomerSender(this.configService);
      return {
        name: dedicated.name,
        address: dedicated.address,
      };
    });
  }

  private async finalizeScheduledSuccess(
    claimed: ClaimedCustomerFollowUpPing,
    sentAt: Date,
    result: MailSubmissionResult,
  ): Promise<CustomerFollowUpEntity> {
    return this.dataSource.transaction(async (manager) => {
      const { attempt, state } = await requireClaimedScheduledState(
        manager,
        claimed,
      );
      attempt.state = 'SENT';
      await manager
        .getRepository(CustomerFollowUpDeliveryAttemptEntity)
        .save(attempt);
      await recordOutboundAttempt(
        manager,
        attempt,
        'ACCEPTED',
        null,
        result.messageReference,
      );
      await markDeliverySuccess(manager, state, sentAt, state.enabled);
      await saveAuditEvent(
        manager,
        state.projectId,
        'CUSTOMER_FOLLOW_UP_PING_SENT',
        {
          attemptId: attempt.id,
          deliveryKind: 'SCHEDULED',
          draftVersion: String(attempt.draftVersion),
          referencedFollowUpId: attempt.referencedFollowUpId ?? 'NONE',
          referencedFollowUpVersion:
            attempt.referencedFollowUpVersion === null
              ? 'NONE'
              : String(attempt.referencedFollowUpVersion),
          deliveryStatus: sentDeliveryStatus,
          subjectLength: String(claimed.rendered.subject.length),
          textLength: String(claimed.rendered.text.length),
          attemptedAt: attempt.attemptedAt.toISOString(),
          sentAt: sentAt.toISOString(),
        },
      );
      return state;
    });
  }

  private async finalizeScheduledDeliveryError(
    claimed: ClaimedCustomerFollowUpPing,
    failedAt: Date,
    error: unknown,
    result?: {
      readonly acceptance: 'ACCEPTED' | 'REJECTED';
      readonly messageReference: string | null;
    },
  ): Promise<CustomerFollowUpEntity> {
    const unknown =
      !(error instanceof CustomerMailBoundaryError) ||
      error.code === 'OUTCOME_UNKNOWN';
    return this.dataSource.transaction(async (manager) => {
      const { attempt, state } = await requireClaimedScheduledState(
        manager,
        claimed,
      );
      attempt.state = unknown ? 'UNKNOWN' : 'FAILED';
      await manager
        .getRepository(CustomerFollowUpDeliveryAttemptEntity)
        .save(attempt);
      await recordOutboundAttempt(
        manager,
        attempt,
        unknown ? 'UNKNOWN' : 'REJECTED',
        unknown ? unknownDeliveryCode : smtpFailureCode,
        result?.messageReference ?? null,
      );
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
        unknown
          ? 'CUSTOMER_FOLLOW_UP_PING_UNKNOWN'
          : 'CUSTOMER_FOLLOW_UP_PING_FAILED',
        {
          attemptId: attempt.id,
          deliveryKind: 'SCHEDULED',
          draftVersion: String(attempt.draftVersion),
          deliveryStatus: unknown ? 'UNKNOWN' : failedDeliveryStatus,
          errorCode: unknown ? unknownDeliveryCode : smtpFailureCode,
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

  private submitPing(
    outbound: CustomerOutboundCommunicationEntity,
  ): Promise<MailSubmissionResult> {
    return this.mailer.submit(
      immutableOutboundCustomerMessage({
        senderName: outbound.senderName,
        senderAddress: outbound.senderAddress,
        recipientAddress: outbound.recipientAddress,
        replyToAddress: outbound.replyToAddress,
        subject: outbound.subject,
        textContent: outbound.textContent,
        ...(outbound.htmlContent ? { htmlContent: outbound.htmlContent } : {}),
      }),
    );
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

async function createPingCorrespondence(
  manager: EntityManager,
  config: ConfigService,
  project: Project,
  attempt: CustomerFollowUpDeliveryAttemptEntity,
  rendered: RenderedCustomerFollowUpPing,
  sender: ResolvedCustomerSender,
  reference: DiscoveryFollowUpEntity | null,
): Promise<CustomerOutboundCommunicationEntity> {
  const token = randomBytes(24).toString('hex');
  const replyToAddress = customerReplyToAddress(
    dedicatedCustomerSender(config).address,
    token,
  );
  const previewDigest = customerMailDigest(
    JSON.stringify({
      draftVersion: attempt.draftVersion,
      referencedFollowUpId: reference?.id ?? null,
      referencedFollowUpVersion: reference?.version ?? null,
      senderName: sender.name,
      senderAddress: sender.address.toLowerCase(),
      recipientName: rendered.recipientName,
      recipientEmail: rendered.recipientEmail.toLowerCase(),
      subject: rendered.subject,
      text: rendered.text,
    }),
  );
  const { outbound, correspondence } = await createCanonicalOutbound(manager, {
    projectId: project.id,
    sourceType: 'CUSTOMER_FOLLOW_UP_PING',
    sourceId: attempt.id,
    senderName: sender.name,
    senderAddress: sender.address,
    recipientName: rendered.recipientName,
    recipientAddress: rendered.recipientEmail,
    subject: rendered.subject,
    htmlContent: '',
    textContent: rendered.text,
    sourceContentVersion: attempt.draftVersion,
    previewDigest,
    replyToAddress,
    replyTokenHash: customerMailDigest(token),
    sourceFollowUpId: reference?.id ?? null,
    sourceFollowUpVersion: reference?.version ?? null,
  });
  attempt.outboundCommunicationId = outbound.id;
  attempt.correspondenceId = correspondence.id;
  await manager
    .getRepository(CustomerFollowUpDeliveryAttemptEntity)
    .save(attempt);
  return outbound;
}

async function requireOutbound(
  manager: EntityManager,
  outboundCommunicationId: string | null,
): Promise<CustomerOutboundCommunicationEntity> {
  if (!outboundCommunicationId) {
    throw new ConflictException(
      'The durable mail identity of the previous delivery is missing.',
    );
  }
  const outbound = await manager
    .getRepository(CustomerOutboundCommunicationEntity)
    .findOneBy({
      id: outboundCommunicationId,
    });
  if (!outbound) {
    throw new ConflictException(
      'The durable outbound communication record for the previous delivery is missing.',
    );
  }
  return outbound;
}

async function recordOutboundAttempt(
  manager: EntityManager,
  attempt: CustomerFollowUpDeliveryAttemptEntity,
  result: 'ACCEPTED' | 'REJECTED' | 'UNKNOWN',
  failureCode: string | null,
  messageReference: string | null,
): Promise<void> {
  if (!attempt.outboundCommunicationId) return;
  await appendCanonicalOutboundAttempt(
    manager,
    attempt.outboundCommunicationId,
    result,
    failureCode,
    messageReference,
  );
}

async function requireClaimedScheduledState(
  manager: EntityManager,
  claimed: ClaimedCustomerFollowUpPing,
): Promise<{
  readonly attempt: CustomerFollowUpDeliveryAttemptEntity;
  readonly state: CustomerFollowUpEntity;
}> {
  const attempt = await manager
    .getRepository(CustomerFollowUpDeliveryAttemptEntity)
    .findOne({
      where: { id: claimed.attemptId },
      lock: { mode: 'pessimistic_write' },
    });
  const state = await manager.getRepository(CustomerFollowUpEntity).findOne({
    where: { id: claimed.state.id },
    lock: { mode: 'pessimistic_write' },
  });
  if (!attempt || !state || attempt.state !== 'SENDING') {
    throw new ConflictException(
      'The Customer follow-up delivery state changed.',
    );
  }
  return { attempt, state };
}

async function initialDiscoveryFollowUpStatus(): Promise<string> {
  const playbook = await loadGeneralPlaybookV1();
  const status = playbook.statuses.followUp[0];
  if (!status) {
    throw new InternalServerErrorException(
      'Canonical Discovery follow-up status is unavailable.',
    );
  }
  return status;
}

async function requireOpenReference(
  manager: EntityManager,
  projectId: string,
  followUpId: string,
  lock = false,
): Promise<DiscoveryFollowUpEntity> {
  const followUp = await manager
    .getRepository(DiscoveryFollowUpEntity)
    .findOne({
      where: { id: followUpId, projectId },
      lock: lock ? { mode: 'pessimistic_write' } : undefined,
    });
  if (
    !followUp ||
    followUp.status !== (await initialDiscoveryFollowUpStatus())
  ) {
    throw new ConflictException({
      code: 'FOLLOW_UP_REFERENCE_INVALID',
      message:
        'The referenced Discovery follow-up is no longer open or does not belong to this Project. Select a current open follow-up.',
    });
  }
  return followUp;
}

async function renderCurrentPing(
  manager: EntityManager,
  project: Project,
  state: CustomerFollowUpEntity,
  lockReference = false,
): Promise<{
  readonly reference: DiscoveryFollowUpEntity | null;
  readonly rendered: RenderedCustomerFollowUpPing;
}> {
  if (!state.messageDraft) {
    throw new ConflictException({
      code: 'FOLLOW_UP_DRAFT_REQUIRED',
      message: 'Save a non-empty Customer follow-up message first.',
    });
  }
  const reference = state.referencedFollowUpId
    ? await requireOpenReference(
        manager,
        project.id,
        state.referencedFollowUpId,
        lockReference,
      )
    : null;
  return {
    reference,
    rendered: renderCustomerFollowUpPing(
      project,
      state.messageDraft,
      reference,
    ),
  };
}

function requireCurrentDraftVersion(
  state: CustomerFollowUpEntity,
  expectedVersion: number,
): void {
  if (state.draftVersion !== expectedVersion) {
    throw new ConflictException({
      code: 'FOLLOW_UP_DRAFT_STALE',
      message:
        'The Customer follow-up draft changed. Reload the current version.',
    });
  }
}

function clearPreview(state: CustomerFollowUpEntity): void {
  state.previewTokenDigest = null;
  state.previewFingerprint = null;
  state.previewExpiresAt = null;
  state.previewSenderName = null;
  state.previewSenderAddress = null;
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function pingFingerprint(
  state: CustomerFollowUpEntity,
  rendered: RenderedCustomerFollowUpPing,
  reference: DiscoveryFollowUpEntity | null,
  sender: ResolvedCustomerSender,
): string {
  return digest(
    JSON.stringify({
      draftVersion: state.draftVersion,
      messageDraft: state.messageDraft,
      referencedFollowUpId: reference?.id ?? null,
      referencedFollowUpVersion: reference?.version ?? null,
      recipientName: rendered.recipientName,
      recipientEmail: rendered.recipientEmail,
      subject: rendered.subject,
      text: rendered.text,
      senderName: sender.name,
      senderAddress: sender.address.toLowerCase(),
    }),
  );
}

function toReferenceOption(
  value: DiscoveryFollowUpEntity,
): CustomerFollowUpReferenceOption {
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
    previewSenderName: null,
    previewSenderAddress: null,
    enabled: false,
    intervalMinutes: defaultFollowUpIntervalMinutes,
    expiresAt: null,
    lastPingAt: null,
    nextPingAt: null,
    pausedRemainingMilliseconds: null,
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
  await saveNextDeliveryCadence(manager, state, now, enabled);
}

async function markDeliveryFailure(
  manager: EntityManager,
  state: CustomerFollowUpEntity,
  now: Date,
  enabled: boolean,
): Promise<void> {
  state.lastPingAt = now;
  await saveNextDeliveryCadence(manager, state, now, enabled);
}

async function saveNextDeliveryCadence(
  manager: EntityManager,
  state: CustomerFollowUpEntity,
  now: Date,
  enabled: boolean,
): Promise<void> {
  const archived = enabled && await manager.getRepository(Project).existsBy({
    id: state.projectId,
    status: 'ARCHIVED',
  });
  state.nextPingAt = enabled && !archived
    ? addMinutes(now, state.intervalMinutes)
    : null;
  state.pausedRemainingMilliseconds = archived
    ? state.intervalMinutes * 60_000
    : null;
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
    throw new BadRequestException(
      'intervalMinutes must be an integer from 1 to 525600.',
    );
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
  if (!latestAttempt || latestAttempt.attemptedAt < requestedAt)
    return requestedAt;
  return new Date(latestAttempt.attemptedAt.getTime() + 1);
}

function rejectArchivedProject(project: Project): void {
  if (project.status === 'ARCHIVED') {
    throw new ConflictException(
      'Archived projects cannot send customer emails.',
    );
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

async function toState(
  manager: EntityManager,
  value: CustomerFollowUpEntity,
  latestManualAttempt: CustomerFollowUpDeliveryAttemptEntity | null = null,
  receiptEvidence = false,
): Promise<CustomerFollowUpState> {
  const latestOutcome = latestManualAttempt?.outboundCommunicationId
    ? await manager.getRepository(CustomerOutboundAttemptEntity).findOne({
        where: {
          outboundCommunicationId: latestManualAttempt.outboundCommunicationId,
        },
        order: { attemptedAt: 'DESC', id: 'DESC' },
      })
    : null;
  const lastDeliveryStatus =
    latestOutcome?.result === 'ACCEPTED'
      ? sentDeliveryStatus
      : latestOutcome?.result === 'REJECTED'
        ? failedDeliveryStatus
        : value.lastDeliveryStatus;
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
    lastDeliveryStatus,
    lastDeliveryError:
      latestOutcome?.result === 'REJECTED'
        ? toSafeDeliveryError(latestOutcome.failureCode)
        : latestOutcome
          ? null
          : toSafeDeliveryError(value.lastDeliveryError),
    latestManualAttempt: latestManualAttempt
      ? toManualAttempt(latestManualAttempt, latestOutcome, receiptEvidence)
      : null,
  };
}

function toManualAttempt(
  value: CustomerFollowUpDeliveryAttemptEntity,
  outcome: CustomerOutboundAttemptEntity | null,
  receiptEvidence: boolean,
): CustomerFollowUpManualAttempt {
  const failureCode = outcome
    ? outcome.failureCode
    : value.legacyFailureCode;
  const sentAt = outcome
    ? outcome.result === 'ACCEPTED'
      ? outcome.attemptedAt
      : null
    : value.legacySentAt;
  return {
    attemptId: value.id,
    state: value.state,
    draftVersion: value.draftVersion,
    referencedFollowUpId: value.referencedFollowUpId,
    referencedFollowUpVersion: value.referencedFollowUpVersion,
    failureCode: toSafeManualFailureCode(failureCode),
    attemptedAt: value.attemptedAt.toISOString(),
    sentAt: sentAt?.toISOString() ?? null,
    receiptEvidence,
  };
}

function toSafeManualFailureCode(value: string | null): string | null {
  if (
    value === null ||
    value === smtpFailureCode ||
    value === unknownDeliveryCode
  )
    return value;
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
