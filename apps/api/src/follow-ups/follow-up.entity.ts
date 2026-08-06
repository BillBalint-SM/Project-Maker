import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import type { FollowUpDeliveryStatus } from '@project-maker/contracts';

const followUpDeliveryStatusValues: readonly FollowUpDeliveryStatus[] = [
  'NEVER',
  'SENT',
  'FAILED',
];

@Entity({ name: 'customer_follow_ups' })
export class CustomerFollowUpEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid', unique: true })
  projectId!: string;

  @Column({ type: 'boolean', default: false })
  enabled!: boolean;

  @Column({ name: 'interval_minutes', type: 'integer' })
  intervalMinutes!: number;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt!: Date | null;

  @Column({ name: 'last_ping_at', type: 'timestamptz', nullable: true })
  lastPingAt!: Date | null;

  @Column({ name: 'next_ping_at', type: 'timestamptz', nullable: true })
  nextPingAt!: Date | null;

  @Column({
    name: 'last_delivery_status',
    type: 'enum',
    enum: followUpDeliveryStatusValues,
    enumName: 'follow_up_delivery_status',
    default: 'NEVER',
  })
  lastDeliveryStatus!: FollowUpDeliveryStatus;

  @Column({ name: 'last_delivery_error', type: 'varchar', length: 100, nullable: true })
  lastDeliveryError!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
