import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

import { projectStatuses, type ProjectStatus } from '@project-maker/contracts/runtime';

@Entity({ name: 'projects' })
export class Project {
  @PrimaryColumn('uuid')
  id!: string;

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

  @Column({ name: 'next_action', type: 'text', nullable: true })
  nextAction!: string | null;

  @Column({ name: 'due_date', type: 'timestamptz', nullable: true })
  dueAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
