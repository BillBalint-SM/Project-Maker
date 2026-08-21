import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

import type { FormalDecisionOutcome } from '@project-maker/contracts';

@Entity({ name: 'formal_decisions' })
export class FormalDecisionEntity {
  @PrimaryColumn('uuid') id!: string;
  @Column({ name: 'project_id', type: 'uuid' }) projectId!: string;
  @Column({ type: 'integer' }) version!: number;
  @Column({ type: 'varchar', length: 30 }) outcome!: FormalDecisionOutcome;
  @Column({ name: 'decision_date', type: 'date' }) decisionDate!: string;
  @Column({ name: 'decision_maker', type: 'varchar', length: 255 }) decisionMaker!: string;
  @Column({ type: 'varchar', length: 4000 }) rationale!: string;
  @Column({ type: 'varchar', length: 4000, nullable: true }) conditions!: string | null;
  @Column({ name: 'review_date', type: 'date', nullable: true }) reviewDate!: string | null;
  @Column({ name: 'reference_decision_review', type: 'boolean', default: false }) referenceDecisionReview!: boolean;
  @Column({ name: 'insight_ids', type: 'jsonb', default: () => "'[]'::jsonb" }) insightIds!: string[];
  @Column({ name: 'specification_revision_id', type: 'uuid', nullable: true }) specificationRevisionId!: string | null;
  @Column({ name: 'actor_id', type: 'varchar', length: 100 }) actorId!: string;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt!: Date;
}
