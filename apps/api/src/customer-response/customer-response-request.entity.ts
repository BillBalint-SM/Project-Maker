import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import type { CustomerResponseDeliveryState, CustomerResponseRequestState } from '@project-maker/contracts';

@Entity({ name: 'customer_response_requests' })
export class CustomerResponseRequestEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'project_id', type: 'uuid' }) projectId!: string;
  @Column({ name: 'preview_id', type: 'uuid', unique: true }) previewId!: string;
  @Column({ type: 'varchar', length: 20 }) state!: CustomerResponseRequestState;
  @Column({ name: 'delivery_state', type: 'varchar', length: 20 }) deliveryState!: CustomerResponseDeliveryState;
  @Column({ name: 'token_digest', type: 'varchar', length: 64, unique: true }) tokenDigest!: string;
  @Column({ name: 'recipient_name', type: 'varchar', length: 255 }) recipientName!: string;
  @Column({ name: 'recipient_email', type: 'varchar', length: 320 }) recipientEmail!: string;
  @Column({ type: 'text' }) subject!: string;
  @Column({ name: 'text_content', type: 'text' }) textContent!: string;
  @Column({ name: 'html_content', type: 'text' }) htmlContent!: string;
  @Column({ name: 'expires_at', type: 'timestamptz' }) expiresAt!: Date;
  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true }) revokedAt!: Date | null;
  @Column({ name: 'outbound_communication_id', type: 'uuid', nullable: true, unique: true }) outboundCommunicationId!: string | null;
  @Column({ name: 'correspondence_id', type: 'uuid', nullable: true, unique: true }) correspondenceId!: string | null;
  @Column({ name: 'failure_code', type: 'varchar', length: 100, nullable: true }) failureCode!: string | null;
  @Column({ name: 'attempted_at', type: 'timestamptz', nullable: true }) attemptedAt!: Date | null;
  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true }) sentAt!: Date | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
