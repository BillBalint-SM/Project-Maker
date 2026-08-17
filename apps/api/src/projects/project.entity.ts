import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import { projectStatuses, type NextActionOwnerRole, type ProjectStatus } from '@project-maker/contracts/runtime';

@Entity({ name: 'projects' })
export class Project {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'creation_request_id', type: 'uuid', nullable: true, unique: true })
  creationRequestId!: string | null;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'customer_contact_name', type: 'varchar', length: 255 })
  customerContactName!: string;

  @Column({ name: 'customer_contact_email', type: 'varchar', length: 320 })
  customerContactEmail!: string;

  @Column({
    type: 'enum',
    enum: projectStatuses,
    enumName: 'project_status',
    default: 'DRAFT',
  })
  status!: ProjectStatus;

  @Column({ name: 'ball_owner', type: 'varchar', length: 255, nullable: true })
  ballOwner!: string | null;

  @Column({ name: 'internal_owner_name', type: 'varchar', length: 255, nullable: true })
  internalOwnerName!: string | null;

  @Column({ name: 'last_customer_sender_name', type: 'varchar', length: 255, nullable: true })
  lastCustomerSenderName!: string | null;

  @Column({ name: 'last_customer_sender_address', type: 'varchar', length: 320, nullable: true })
  lastCustomerSenderAddress!: string | null;

  @Column({
    name: 'next_action_owner_role',
    type: 'varchar',
    length: 30,
    nullable: true,
  })
  nextActionOwnerRole!: NextActionOwnerRole | null;

  @Column({ name: 'next_action', type: 'text', nullable: true })
  nextAction!: string | null;

  @Column({ name: 'due_date', type: 'timestamptz', nullable: true })
  dueAt!: Date | null;

  @Column({ name: 'business_value_rating', type: 'smallint', nullable: true })
  businessValueRating!: number | null;

  @Column({ name: 'strategic_alignment_rating', type: 'smallint', nullable: true })
  strategicAlignmentRating!: number | null;

  @Column({ name: 'urgency_rating', type: 'smallint', nullable: true })
  urgencyRating!: number | null;

  @Column({ name: 'confidence_rating', type: 'smallint', nullable: true })
  confidenceRating!: number | null;

  @Column({ name: 'complexity_rating', type: 'smallint', nullable: true })
  complexityRating!: number | null;

  @Column({ name: 'risk_rating', type: 'smallint', nullable: true })
  riskRating!: number | null;

  @Column({ name: 'markdown_template_id', type: 'uuid', nullable: true })
  markdownTemplateId!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
