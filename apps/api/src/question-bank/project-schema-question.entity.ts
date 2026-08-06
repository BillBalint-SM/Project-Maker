import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'project_schema_questions' })
export class ProjectSchemaQuestionEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'project_schema_id', type: 'uuid' })
  projectSchemaId!: string;

  @Column({ name: 'base_question_id', type: 'uuid' })
  baseQuestionId!: string;

  @Column({ name: 'bank_version', type: 'integer' })
  bankVersion!: number;

  @Column({ type: 'boolean' })
  required!: boolean;

  @Column({ type: 'boolean' })
  blocking!: boolean;

  @Column({ name: 'display_order', type: 'integer' })
  order!: number;
}
