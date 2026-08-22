import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

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
  // Workflow authority: this tells the handoff UI whether the logical version
  // can be retried or superseded. The immutable outbound-attempt history is
  // authoritative for individual mail-system outcomes and diagnostics.
  state!: HandoffVersionStatus;

  @Column({ name: 'modification_summary', type: 'text', nullable: true })
  modificationSummary!: string | null;

  @Column({ name: 'correspondence_id', type: 'uuid', nullable: true })
  correspondenceId!: string | null;

  @Column({ name: 'outbound_communication_id', type: 'uuid', nullable: true })
  outboundCommunicationId!: string | null;

  // This is domain ownership, not a mail snapshot. It remains readable after
  // a handoff has been sent even when the project's current owner changes.
  @Column({
    name: 'internal_owner_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  internalOwnerName!: string | null;

  // Nullable legacy snapshot fields preserve handoffs from before a complete
  // canonical outbound identity existed. New writes use outbound/correspondence.
  @Column({
    name: 'recipient_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  legacyRecipientName!: string | null;
  @Column({
    name: 'recipient_email',
    type: 'varchar',
    length: 320,
    nullable: true,
  })
  legacyRecipientEmail!: string | null;
  @Column({ name: 'sender_name', type: 'varchar', length: 255, nullable: true })
  legacySenderName!: string | null;
  @Column({
    name: 'sender_address',
    type: 'varchar',
    length: 320,
    nullable: true,
  })
  legacySenderAddress!: string | null;
  @Column({
    name: 'reply_to_address',
    type: 'varchar',
    length: 320,
    nullable: true,
  })
  legacyReplyToAddress!: string | null;
  @Column({
    name: 'reply_token_hash',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  legacyReplyTokenHash!: string | null;
  @Column({
    name: 'mail_system_acceptance',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  legacyMailSystemAcceptance!: 'ACCEPTED' | 'REJECTED' | null;
  @Column({
    name: 'message_reference',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  legacyMessageReference!: string | null;
  @Column({ name: 'subject', type: 'text', nullable: true }) legacySubject!:
    | string
    | null;
  @Column({ name: 'html_content', type: 'text', nullable: true })
  legacyHtmlContent!: string | null;
  @Column({ name: 'text_content', type: 'text', nullable: true })
  legacyTextContent!: string | null;
  @Column({
    name: 'preview_digest',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  legacyPreviewDigest!: string | null;
  @Column({ name: 'source_content_version', type: 'integer', nullable: true })
  legacySourceContentVersion!: number | null;
  @Column({
    name: 'failure_code',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  legacyFailureCode!: string | null;
  @Column({ name: 'attempted_at', type: 'timestamptz', nullable: true })
  legacyAttemptedAt!: Date | null;
  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  legacySentAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
