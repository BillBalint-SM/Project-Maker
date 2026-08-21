import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type AuditPayload = Readonly<Record<string, string>>;

@Entity({ name: 'audit_events' })
export class AuditEvent {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid', nullable: true })
  projectId!: string | null;

  @Column({ name: 'event_type', type: 'varchar', length: 100 })
  eventType!: string;

  @Column({ type: 'jsonb', default: () => "'{}'::jsonb" })
  payload!: AuditPayload;

  @Column({ name: 'actor_id', type: 'varchar', length: 100, default: 'system' })
  actorId!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
