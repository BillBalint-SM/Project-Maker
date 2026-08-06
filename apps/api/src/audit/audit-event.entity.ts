import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type AuditPayload = Readonly<Record<string, string>>;

@Entity({ name: 'audit_events' })
export class AuditEvent {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload!: AuditPayload;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
