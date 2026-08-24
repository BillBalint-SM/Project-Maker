import type { ProjectSchemaQuestionInput } from '@project-maker/contracts';
import { Column, CreateDateColumn, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'question_templates' })
export class QuestionTemplateEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ name: 'draft_questions', type: 'jsonb' })
  draftQuestions!: ProjectSchemaQuestionInput[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}

@Entity({ name: 'question_template_versions' })
export class QuestionTemplateVersionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'template_id', type: 'uuid' })
  templateId!: string;

  @Column({ type: 'integer' })
  version!: number;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'jsonb' })
  questions!: ProjectSchemaQuestionInput[];

  @Column({ name: 'published_at', type: 'timestamptz' })
  publishedAt!: Date;
}
