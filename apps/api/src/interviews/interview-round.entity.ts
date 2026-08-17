import { Column, Entity, PrimaryColumn } from 'typeorm';

import type { InterviewRoundStatus, InterviewRoundType } from '@project-maker/contracts';

export const interviewRoundTypeValues: readonly InterviewRoundType[] = [
  'INITIAL_INTAKE',
  'STAKEHOLDER',
  'CLARIFICATION',
];

export const interviewRoundStatusValues: readonly InterviewRoundStatus[] = [
  'OPEN',
  'ENDED',
];

@Entity({ name: 'interview_rounds' })
export class InterviewRoundEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ name: 'project_schema_id', type: 'uuid' })
  projectSchemaId!: string;

  @Column({ type: 'enum', enum: interviewRoundTypeValues, enumName: 'interview_round_type' })
  type!: InterviewRoundType;

  @Column({
    type: 'enum',
    enum: interviewRoundStatusValues,
    enumName: 'interview_round_status',
  })
  status!: InterviewRoundStatus;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  endedAt!: Date | null;

  @Column({ name: 'content_version', type: 'integer', default: 1 })
  contentVersion!: number;

  @Column({ type: 'varchar', length: 50 })
  source!: string;
}
