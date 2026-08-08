import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import {
  discoveryFollowUpCategories,
  type DiscoveryFollowUpCategory,
} from '@project-maker/contracts/discovery-follow-ups';

@Entity({ name: 'discovery_follow_ups' })
export class DiscoveryFollowUpEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({
    type: 'enum',
    enum: discoveryFollowUpCategories,
    enumName: 'discovery_follow_up_category',
  })
  category!: DiscoveryFollowUpCategory;

  @Column({ type: 'text' })
  question!: string;

  @Column({ type: 'varchar', length: 255 })
  owner!: string;

  @Column({ name: 'due_date', type: 'date' })
  dueDate!: string;

  @Column({ type: 'varchar', length: 100 })
  status!: string;

  @Column({ name: 'next_step', type: 'text' })
  nextStep!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
