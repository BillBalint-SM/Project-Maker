import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type CustomerFollowUpAttemptState = 'SENDING' | 'SENT' | 'FAILED' | 'UNKNOWN';

@Entity({ name: 'customer_follow_up_delivery_attempts' })
export class CustomerFollowUpDeliveryAttemptEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ name: 'draft_version', type: 'integer' })
  draftVersion!: number;

  @Column({ name: 'referenced_follow_up_id', type: 'uuid', nullable: true })
  referencedFollowUpId!: string | null;

  @Column({ name: 'referenced_follow_up_version', type: 'integer', nullable: true })
  referencedFollowUpVersion!: number | null;

  @Column({ type: 'varchar', length: 20 })
  state!: CustomerFollowUpAttemptState;

  @Column({ name: 'recipient_email', type: 'varchar', length: 320 })
  recipientEmail!: string;

  @Column({ name: 'subject_length', type: 'integer' })
  subjectLength!: number;

  @Column({ name: 'text_length', type: 'integer' })
  textLength!: number;

  @Column({ name: 'failure_code', type: 'varchar', length: 100, nullable: true })
  failureCode!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'attempted_at', type: 'timestamptz' })
  attemptedAt!: Date;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt!: Date | null;

  @Column({ name: 'outbound_communication_id', type: 'uuid', nullable: true, unique: true })
  outboundCommunicationId!: string | null;

  @Column({ name: 'correspondence_id', type: 'uuid', nullable: true, unique: true })
  correspondenceId!: string | null;

  @Column({ name: 'mail_system_acceptance', type: 'varchar', length: 20, nullable: true })
  mailSystemAcceptance!: 'ACCEPTED' | 'REJECTED' | null;

  @Column({ name: 'message_reference', type: 'varchar', length: 500, nullable: true })
  messageReference!: string | null;
}
