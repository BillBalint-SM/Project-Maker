import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'markdown_templates' })
export class MarkdownTemplateEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'draft_content', type: 'text' })
  draftContent!: string;

  @Column({ name: 'is_default', type: 'boolean' })
  isDefault!: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'markdown_template_versions' })
export class MarkdownTemplateVersionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'template_id', type: 'uuid' })
  templateId!: string;

  @Column({ type: 'integer' })
  version!: number;

  @Column({ type: 'text' })
  content!: string;

  @Column({ name: 'published_at', type: 'timestamptz' })
  publishedAt!: Date;
}
