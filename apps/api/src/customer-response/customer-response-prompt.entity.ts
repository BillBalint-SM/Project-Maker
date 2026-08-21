import { Column, Entity, PrimaryColumn } from 'typeorm';
import type { CustomerResponsePromptSourceKind } from '@project-maker/contracts';

@Entity({ name: 'customer_response_prompts' })
export class CustomerResponsePromptEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'request_id', type: 'uuid' }) requestId!: string;
  @Column({ name: 'display_order', type: 'integer' }) order!: number;
  @Column({ name: 'source_kind', type: 'varchar', length: 30 }) sourceKind!: CustomerResponsePromptSourceKind;
  @Column({ name: 'source_id', type: 'uuid' }) sourceId!: string;
  @Column({ name: 'source_version', type: 'integer', nullable: true }) sourceVersion!: number | null;
  @Column({ type: 'varchar', length: 255 }) topic!: string;
  @Column({ type: 'text' }) text!: string;
}
