import { Column, Entity, PrimaryColumn } from 'typeorm';

import type { AnswerValue } from '@project-maker/contracts';

@Entity({ name: 'round_answers' })
export class RoundAnswerEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'round_id', type: 'uuid' })
  roundId!: string;

  @Column({ name: 'snapshot_id', type: 'uuid' })
  snapshotId!: string;

  @Column({ type: 'jsonb' })
  value!: AnswerValue;

  @Column({ name: 'answered_at', type: 'timestamptz' })
  answeredAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
