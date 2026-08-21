import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'customer_response_answers' })
export class CustomerResponseAnswerEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'submission_id', type: 'uuid' }) submissionId!: string;
  @Column({ name: 'prompt_id', type: 'uuid' }) promptId!: string;
  @Column({ name: 'display_order', type: 'integer' }) order!: number;
  @Column({ type: 'text' }) answer!: string;
  @Column({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
