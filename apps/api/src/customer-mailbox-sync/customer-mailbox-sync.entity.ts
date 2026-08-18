import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import type { CustomerMailboxSyncState } from '@project-maker/contracts';

@Entity({ name: 'customer_mailbox_sync' })
export class CustomerMailboxSyncEntity {
  @PrimaryColumn({ name: 'mailbox_address', type: 'varchar', length: 320 })
  mailboxAddress!: string;

  @Column({ name: 'delta_checkpoint', type: 'text', nullable: true })
  deltaCheckpoint!: string | null;

  @Column({ name: 'baseline_established', type: 'boolean', default: false })
  baselineEstablished!: boolean;

  @Column({ type: 'varchar', length: 40 })
  state!: CustomerMailboxSyncState;

  @Column({ name: 'last_successful_sync_at', type: 'timestamptz', nullable: true })
  lastSuccessfulSyncAt!: Date | null;

  @Column({ name: 'last_attempted_sync_at', type: 'timestamptz', nullable: true })
  lastAttemptedSyncAt!: Date | null;

  @Column({ name: 'failure_code', type: 'varchar', length: 40, nullable: true })
  failureCode!: string | null;

  @Column({ name: 'lease_token', type: 'uuid', nullable: true })
  leaseToken!: string | null;

  @Column({ name: 'lease_expires_at', type: 'timestamptz', nullable: true })
  leaseExpiresAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
