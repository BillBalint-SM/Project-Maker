import { Column, Entity, PrimaryColumn } from 'typeorm';

import type {
  MarkdownRevisionReason,
  MarkdownRevisionSourceSnapshot,
} from '@project-maker/contracts';

export const markdownRevisionReasonValues: readonly MarkdownRevisionReason[] = [
  'MANUAL',
  'MILESTONE',
];

@Entity({ name: 'markdown_revisions' })
export class MarkdownRevisionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ type: 'integer' })
  version!: number;

  @Column({
    type: 'enum',
    enum: markdownRevisionReasonValues,
    enumName: 'markdown_revision_reason',
  })
  reason!: MarkdownRevisionReason;

  @Column({ name: 'milestone', type: 'varchar', length: 255, nullable: true })
  milestone!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'source_snapshot', type: 'jsonb' })
  sourceSnapshot!: MarkdownRevisionSourceSnapshot;

  @Column({ name: 'change_summary', type: 'text' })
  changeSummary!: string;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'previous_revision_id', type: 'uuid', nullable: true })
  previousRevisionId!: string | null;

  @Column({ name: 'template_id', type: 'uuid', nullable: true })
  templateId!: string | null;

  @Column({ name: 'template_name', type: 'varchar', length: 255, nullable: true })
  templateName!: string | null;

  @Column({ name: 'template_version', type: 'integer', nullable: true })
  templateVersion!: number | null;
}
