import { Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'question_reference_files' })
export class QuestionReferenceFileEntity {
  @PrimaryColumn({ name: 'question_id', type: 'uuid' })
  questionId!: string;

  @PrimaryColumn({ name: 'file_id', type: 'uuid' })
  fileId!: string;
}
