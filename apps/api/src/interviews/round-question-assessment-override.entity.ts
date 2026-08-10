import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'round_question_assessment_overrides' })
export class RoundQuestionAssessmentOverrideEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'round_id', type: 'uuid' })
  roundId!: string;

  @Column({ name: 'snapshot_id', type: 'uuid' })
  snapshotId!: string;

  @Column({ type: 'varchar', length: 100 })
  status!: string;

  @Column({ type: 'text', nullable: true })
  rationale!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
