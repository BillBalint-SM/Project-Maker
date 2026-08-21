import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'insight_evidence' })
export class InsightEvidenceEntity {
  @PrimaryColumn({ name: 'insight_id', type: 'uuid' })
  insightId!: string;

  @PrimaryColumn({ name: 'evidence_id', type: 'uuid' })
  evidenceId!: string;

  @Column({ name: 'display_order', type: 'integer' })
  order!: number;
}
