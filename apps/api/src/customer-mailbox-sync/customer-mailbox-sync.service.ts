import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  CustomerMailboxChange,
  CustomerMailboxCheckpoint,
  CustomerMailboxSyncState,
  CustomerMailboxSyncStatus,
} from '@project-maker/contracts';
import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';

import {
  CustomerMailBoundaryError,
  type CustomerMailboxChanges,
  customerMailboxChangesToken,
} from '../mail-delivery/customer-mail-boundary';
import { CustomerMailboxSyncEntity } from './customer-mailbox-sync.entity';

export const customerMailboxClockToken = 'CUSTOMER_MAILBOX_CLOCK';
export interface CustomerMailboxClock {
  now(): Date;
}
@Injectable()
export class CustomerMailboxSyncService implements OnModuleInit, OnModuleDestroy {
  private static readonly leaseDurationMs = 2 * 60_000;
  private readonly logger = new Logger(CustomerMailboxSyncService.name);
  private readonly pollIntervalMs: number;
  private pollHandle: NodeJS.Timeout | null = null;
  private refreshPromise: Promise<CustomerMailboxSyncStatus> | null = null;

  constructor(
    @InjectRepository(CustomerMailboxSyncEntity)
    private readonly syncRepository: Repository<CustomerMailboxSyncEntity>,
    private readonly dataSource: DataSource,
    @Inject(customerMailboxChangesToken)
    private readonly mailbox: CustomerMailboxChanges,
    @Inject(customerMailboxClockToken)
    private readonly clock: CustomerMailboxClock,
    private readonly config: ConfigService,
  ) {
    this.pollIntervalMs = pollInterval(config.get<string>('CUSTOMER_MAILBOX_SYNC_POLL_INTERVAL_MS'));
  }

  onModuleInit(): void {
    if (!this.mailbox.isConfigured()) return;
    this.pollHandle = setInterval(() => {
      void this.runScheduledRefresh();
    }, this.pollIntervalMs);
    this.pollHandle.unref();
  }

  onModuleDestroy(): void {
    if (!this.pollHandle) return;
    clearInterval(this.pollHandle);
    this.pollHandle = null;
  }

  async runScheduledRefresh(): Promise<void> {
    try {
      await this.refresh();
    } catch {
      this.logger.warn('Customer mailbox synchronization failed.');
    }
  }

  async status(): Promise<CustomerMailboxSyncStatus> {
    const mailboxAddress = this.mailboxAddress();
    if (!mailboxAddress || !this.mailbox.isConfigured()) {
      return emptyStatus(mailboxAddress, 'NOT_CONFIGURED');
    }
    const state = await this.syncRepository.findOneBy({ mailboxAddress });
    const now = this.clock.now();
    return state
      ? toStatus(
          state,
          this.refreshPromise !== null || hasActiveLease(state, now),
          now,
          this.delayedAfterMs(),
        )
      : emptyStatus(mailboxAddress, 'INITIALIZING');
  }

  refresh(): Promise<CustomerMailboxSyncStatus> {
    if (this.refreshPromise) return this.refreshPromise;
    this.refreshPromise = this.performRefresh().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async performRefresh(): Promise<CustomerMailboxSyncStatus> {
    const mailboxAddress = this.mailboxAddress();
    if (!mailboxAddress || !this.mailbox.isConfigured()) {
      return emptyStatus(mailboxAddress, 'NOT_CONFIGURED');
    }

    const attemptedAt = this.clock.now();
    const leaseToken = randomUUID();
    const claim = await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO "customer_mailbox_sync" (
           "mailbox_address", "state", "last_attempted_sync_at"
         ) VALUES ($1, 'INITIALIZING', $2)
         ON CONFLICT ("mailbox_address") DO NOTHING`,
        [mailboxAddress, attemptedAt],
      );
      const repository = manager.getRepository(CustomerMailboxSyncEntity);
      const state = await repository.findOne({
        where: { mailboxAddress },
        lock: { mode: 'pessimistic_write' },
      });
      if (!state) throw new Error('Customer mailbox synchronization state is unavailable.');
      if (hasActiveLease(state, attemptedAt)) return { claimed: false as const, state };
      state.state = 'INITIALIZING';
      state.lastAttemptedSyncAt = attemptedAt;
      state.failureCode = null;
      state.leaseToken = leaseToken;
      state.leaseExpiresAt = new Date(
        attemptedAt.getTime() + CustomerMailboxSyncService.leaseDurationMs,
      );
      return { claimed: true as const, state: await repository.save(state) };
    });
    if (!claim.claimed) return this.waitForActiveRefresh(mailboxAddress);
    const state = claim.state;
    const changes: CustomerMailboxChange[] = [];

    try {
      let checkpoint: CustomerMailboxCheckpoint | null = state.deltaCheckpoint
        ? { value: state.deltaCheckpoint }
        : null;
      for (;;) {
        const page = await this.mailbox.readChanges(checkpoint);
        if (state.baselineEstablished) changes.push(...page.changes);
        if (page.nextPageCheckpoint) {
          checkpoint = page.nextPageCheckpoint;
          continue;
        }
        if (!page.completedCheckpoint) {
          throw new CustomerMailBoundaryError('TEMPORARY_FAILURE');
        }
        state.deltaCheckpoint = page.completedCheckpoint.value;
        break;
      }
      state.baselineEstablished = true;
      state.state = 'CURRENT';
      state.lastSuccessfulSyncAt = this.clock.now();
      state.failureCode = null;
    } catch (error) {
      const failure = error instanceof CustomerMailBoundaryError ? error.code : 'TEMPORARY_FAILURE';
      state.state = failureState(failure);
      state.failureCode = failure;
    }
    const retainedChanges = state.state === 'CURRENT' ? changes : [];
    const completion = await this.dataSource.transaction(async (manager) => {
      const result = await manager.getRepository(CustomerMailboxSyncEntity).update(
        { mailboxAddress, leaseToken },
        {
          deltaCheckpoint: state.deltaCheckpoint,
          baselineEstablished: state.baselineEstablished,
          state: state.state,
          lastSuccessfulSyncAt: state.lastSuccessfulSyncAt,
          lastAttemptedSyncAt: state.lastAttemptedSyncAt,
          failureCode: state.failureCode,
          leaseToken: null,
          leaseExpiresAt: null,
        },
      );
      if (result.affected === 0) return result;
      for (const change of retainedChanges) {
        if (change.changeType !== 'UPSERTED') continue;
        await manager.query(
          `INSERT INTO "customer_mailbox_change_inbox" (
             "mailbox_address", "message_reference", "internet_message_id", "in_reply_to",
             "sender_address", "subject", "text_content", "received_at", "observed_at"
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           ON CONFLICT ("mailbox_address", "message_reference") DO NOTHING`,
          [
            mailboxAddress,
            change.messageReference,
            change.internetMessageId,
            change.inReplyTo,
            change.senderAddress,
            change.subject,
            change.textContent,
            change.receivedAt,
            this.clock.now(),
          ],
        );
      }
      return result;
    });
    const saved = await this.syncRepository.findOneBy({ mailboxAddress });
    if (!saved) throw new Error('Customer mailbox synchronization state is unavailable.');
    if (completion.affected === 0) {
      return toStatus(
        saved,
        hasActiveLease(saved, this.clock.now()),
        this.clock.now(),
        this.delayedAfterMs(),
      );
    }
    return toStatus(saved, false, this.clock.now(), this.delayedAfterMs());
  }

  private mailboxAddress(): string | null {
    return this.config.get<string>('CUSTOMER_MAILBOX_ADDRESS')?.trim() || null;
  }

  private async waitForActiveRefresh(mailboxAddress: string): Promise<CustomerMailboxSyncStatus> {
    const waitDeadline = Date.now() + 30_000;
    for (;;) {
      const state = await this.syncRepository.findOneBy({ mailboxAddress });
      if (!state) return emptyStatus(mailboxAddress, 'INITIALIZING');
      const leaseActive = hasActiveLease(state, this.clock.now());
      if (!leaseActive || Date.now() >= waitDeadline) {
        return toStatus(state, leaseActive, this.clock.now(), this.delayedAfterMs());
      }
      await wait(25);
    }
  }

  private delayedAfterMs(): number {
    return Math.max(2 * 60_000, this.pollIntervalMs * 2);
  }
}

function hasActiveLease(state: CustomerMailboxSyncEntity, now: Date): boolean {
  return state.leaseToken !== null && state.leaseExpiresAt !== null && state.leaseExpiresAt > now;
}

function failureState(code: string): CustomerMailboxSyncState {
  if (code === 'CONFIGURATION_ERROR') return 'CONFIGURATION_ERROR';
  if (code === 'AUTHENTICATION_ERROR') return 'AUTHORIZATION_ERROR';
  return 'UNAVAILABLE';
}

function pollInterval(configuredValue: string | undefined): number {
  const parsed = Number(configuredValue ?? '60000');
  return Number.isSafeInteger(parsed) && parsed >= 100 ? parsed : 60_000;
}

async function wait(durationMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, durationMs));
}

function emptyStatus(
  mailboxAddress: string | null,
  state: CustomerMailboxSyncState,
): CustomerMailboxSyncStatus {
  return {
    mailboxAddress,
    state,
    baselineEstablished: false,
    lastSuccessfulSyncAt: null,
    refreshInProgress: false,
  };
}

function toStatus(
  state: CustomerMailboxSyncEntity,
  refreshInProgress: boolean,
  now: Date,
  delayedAfterMs: number,
): CustomerMailboxSyncStatus {
  const projectedState =
    state.state === 'CURRENT' &&
    state.lastSuccessfulSyncAt &&
    now.getTime() - state.lastSuccessfulSyncAt.getTime() > delayedAfterMs
      ? 'DELAYED'
      : state.state;
  return {
    mailboxAddress: state.mailboxAddress,
    state: projectedState,
    baselineEstablished: state.baselineEstablished,
    lastSuccessfulSyncAt: state.lastSuccessfulSyncAt?.toISOString() ?? null,
    refreshInProgress,
  };
}
