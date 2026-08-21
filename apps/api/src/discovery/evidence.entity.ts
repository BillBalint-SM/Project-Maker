import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

import type { EvidenceSourceKind } from '@project-maker/contracts';

@Entity({ name: 'evidence' })
export class EvidenceEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ name: 'source_kind', type: 'varchar', length: 40 })
  sourceKind!: EvidenceSourceKind;

  @Column({ type: 'varchar', length: 500 })
  title!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ name: 'round_id', type: 'uuid', nullable: true })
  roundId!: string | null;

  @Column({ name: 'snapshot_id', type: 'uuid', nullable: true })
  snapshotId!: string | null;

  @Column({ name: 'attachment_id', type: 'uuid', nullable: true })
  attachmentId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
