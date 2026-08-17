import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import type { HandoffVersionStatus } from '@project-maker/contracts';

const handoffVersionStatusValues: readonly HandoffVersionStatus[] = [
  'DRAFT',
  'SENDING',
  'SENT',
  'FAILED',
  'UNKNOWN',
];

@Entity({ name: 'interview_customer_handoffs' })
export class InterviewCustomerHandoffEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ name: 'round_id', type: 'uuid' })
  roundId!: string;

  @Column({ type: 'integer' })
  version!: number;

  @Column({ name: 'supersedes_handoff_id', type: 'uuid', nullable: true })
  supersedesHandoffId!: string | null;

  @Column({
    type: 'enum',
    enum: handoffVersionStatusValues,
    enumName: 'interview_handoff_state',
  })
  state!: HandoffVersionStatus;

  @Column({ name: 'modification_summary', type: 'text', nullable: true })
  modificationSummary!: string | null;

  @Column({ name: 'recipient_name', type: 'varchar', length: 255, nullable: true })
  recipientName!: string | null;

  @Column({ name: 'recipient_email', type: 'varchar', length: 320, nullable: true })
  recipientEmail!: string | null;

  @Column({ name: 'internal_owner_name', type: 'varchar', length: 255, nullable: true })
  internalOwnerName!: string | null;

  @Column({ type: 'text', nullable: true })
  subject!: string | null;

  @Column({ name: 'html_content', type: 'text', nullable: true })
  htmlContent!: string | null;

  @Column({ name: 'text_content', type: 'text', nullable: true })
  textContent!: string | null;

  @Column({ name: 'preview_digest', type: 'varchar', length: 64, nullable: true })
  previewDigest!: string | null;

  @Column({ name: 'source_content_version', type: 'integer', nullable: true })
  sourceContentVersion!: number | null;

  @Column({ name: 'failure_code', type: 'varchar', length: 100, nullable: true })
  failureCode!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @Column({ name: 'attempted_at', type: 'timestamptz', nullable: true })
  attemptedAt!: Date | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;
}
