import { Column, Entity, PrimaryColumn } from 'typeorm';

import type { BaseQuestionType } from '@project-maker/contracts';

export type BaseQuestionSource = 'CANONICAL_SEED' | 'SETTINGS_API';
export const baseQuestionTypeValues: readonly BaseQuestionType[] = [
  'TEXT',
  'LONG_TEXT',
  'SINGLE_SELECT',
  'MULTI_SELECT',
  'BOOLEAN',
  'NUMBER',
  'DATE',
];

@Entity({ name: 'base_questions' })
export class BaseQuestionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'stable_key', type: 'varchar', length: 100 })
  stableKey!: string;

  @Column({ name: 'bank_version', type: 'integer' })
  bankVersion!: number;

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

  @Column({ name: 'required_for_estimate', type: 'boolean' })
  requiredForEstimate!: boolean;

  @Column({ type: 'boolean' })
  blocking!: boolean;

  @Column({ name: 'display_order', type: 'integer' })
  order!: number;

  @Column({ type: 'boolean' })
  active!: boolean;

  @Column({ type: 'text', nullable: true })
  hint!: string | null;

  @Column({ type: 'jsonb', nullable: true })
  options!: string[] | null;

  @Column({
    type: 'enum',
    enum: ['CANONICAL_SEED', 'SETTINGS_API'],
    enumName: 'base_question_source',
  })
  source!: BaseQuestionSource;

  @Column({ name: 'published_at', type: 'timestamptz' })
  publishedAt!: Date;
}
