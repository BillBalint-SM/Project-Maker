import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'project_question_schemas' })
export class ProjectQuestionSchemaEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'project_id', type: 'uuid' })
  projectId!: string;

  @Column({ name: 'schema_version', type: 'integer' })
  schemaVersion!: number;

  @Column({ name: 'bank_version', type: 'integer' })
  bankVersion!: number;

  @Column({ name: 'published_at', type: 'timestamptz' })
  publishedAt!: Date;

  @Column({ name: 'question_template_id', type: 'uuid', nullable: true })
  questionTemplateId!: string | null;

  @Column({ name: 'question_template_name', type: 'varchar', length: 255, nullable: true })
  questionTemplateName!: string | null;

  @Column({ name: 'question_template_version', type: 'integer', nullable: true })
  questionTemplateVersion!: number | null;

  @Column({ type: 'varchar', length: 50 })
  source!: string;
}
