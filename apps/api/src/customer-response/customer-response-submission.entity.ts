import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'customer_response_submissions' })
export class CustomerResponseSubmissionEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'request_id', type: 'uuid', unique: true }) requestId!: string;
  @Column({ name: 'idempotency_key', type: 'uuid', unique: true }) idempotencyKey!: string;
  @Column({ name: 'submitted_at', type: 'timestamptz' }) submittedAt!: Date;
  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true }) reviewedAt!: Date | null;
  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true }) reviewedBy!: string | null;
}
