import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'customer_outbound_attempts' })
export class CustomerOutboundAttemptEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'outbound_communication_id', type: 'uuid' }) outboundCommunicationId!: string;
  @Column({ type: 'varchar', length: 20 }) result!: 'ACCEPTED' | 'REJECTED' | 'UNKNOWN';
  @Column({ name: 'failure_code', type: 'varchar', length: 100, nullable: true }) failureCode!: string | null;
  @Column({ name: 'message_reference', type: 'varchar', length: 500, nullable: true }) messageReference!: string | null;
  @CreateDateColumn({ name: 'attempted_at', type: 'timestamptz' }) attemptedAt!: Date;
}
