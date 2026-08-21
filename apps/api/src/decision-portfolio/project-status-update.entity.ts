import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import type { ProjectHealth } from '@project-maker/contracts';

@Entity({ name: 'project_status_updates' })
export class ProjectStatusUpdateEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'project_id', type: 'uuid' }) projectId!: string;
  @Column({ type: 'integer' }) version!: number;
  @Column({ type: 'varchar', length: 20 }) health!: ProjectHealth;
  @Column({ type: 'varchar', length: 2000 }) summary!: string;
  @Column({ type: 'varchar', length: 4000, nullable: true }) changes!: string | null;
  @Column({ type: 'varchar', length: 4000, nullable: true }) risks!: string | null;
  @Column({ name: 'next_step', type: 'varchar', length: 2000 }) nextStep!: string;
  @Column({ name: 'actor_id', type: 'varchar', length: 100 }) actorId!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt!: Date;
}
