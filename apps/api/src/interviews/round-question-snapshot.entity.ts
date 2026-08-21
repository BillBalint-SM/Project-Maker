import { Column, Entity, PrimaryColumn } from 'typeorm';

import type { BaseQuestionType } from '@project-maker/contracts';
import { baseQuestionTypeValues } from '../question-bank/base-question.entity';

@Entity({ name: 'round_question_snapshots' })
export class RoundQuestionSnapshotEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'round_id', type: 'uuid' })
  roundId!: string;

  @Column({ name: 'base_question_id', type: 'uuid', nullable: true })
  baseQuestionId!: string | null;

  @Column({ name: 'stable_key', type: 'varchar', length: 100 })
  stableKey!: string;

  @Column({ type: 'varchar', length: 255 })
  topic!: string;

  @Column({ name: 'control_point', type: 'text' })
  controlPoint!: string;

  @Column({ type: 'text' })
  text!: string;

  @Column({ type: 'enum', enum: baseQuestionTypeValues, enumName: 'base_question_type' })
  type!: BaseQuestionType;

  @Column({ type: 'boolean' })
  required!: boolean;

  @Column({ type: 'boolean' })
  blocking!: boolean;

  @Column({ name: 'display_order', type: 'integer' })
  order!: number;

  @Column({ type: 'text', nullable: true })
  hint!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  options!: string[] | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
