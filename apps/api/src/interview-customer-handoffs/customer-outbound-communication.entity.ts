import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'customer_outbound_communications' })
export class CustomerOutboundCommunicationEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'project_id', type: 'uuid' }) projectId!: string;
  @Column({ name: 'source_type', type: 'varchar', length: 40 }) sourceType!: 'INTERVIEW_HANDOFF' | 'CUSTOMER_FOLLOW_UP_PING' | 'CUSTOMER_RESPONSE_REQUEST';
  @Column({ name: 'source_id', type: 'uuid', unique: true }) sourceId!: string;
  @Column({ name: 'sender_name', type: 'varchar', length: 255 }) senderName!: string;
  @Column({ name: 'sender_address', type: 'varchar', length: 320 }) senderAddress!: string;
  @Column({ name: 'recipient_name', type: 'varchar', length: 255 }) recipientName!: string;
  @Column({ name: 'recipient_address', type: 'varchar', length: 320 }) recipientAddress!: string;
  @Column({ type: 'text' }) subject!: string;
  @Column({ name: 'html_content', type: 'text' }) htmlContent!: string;
  @Column({ name: 'text_content', type: 'text' }) textContent!: string;
  @Column({ name: 'source_content_version', type: 'integer' }) sourceContentVersion!: number;
  @Column({ name: 'preview_digest', type: 'varchar', length: 64 }) previewDigest!: string;
  @Column({ name: 'reply_to_address', type: 'varchar', length: 320 }) replyToAddress!: string;
  @Column({ name: 'reply_token_hash', type: 'varchar', length: 64, unique: true }) replyTokenHash!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
