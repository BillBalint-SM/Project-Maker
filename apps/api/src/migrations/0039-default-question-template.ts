import type { MigrationInterface, QueryRunner } from 'typeorm';

const defaultTemplateId = '00000000-0000-4000-8000-000000000039';
const defaultVersionId = '00000000-0000-4000-8000-000000000139';
const defaultTemplateName = 'Complete General Discovery';
const defaultQuestions = Array.from({ length: 30 }, (_, index) => ({
  stableKey: `general-${String(index + 1).padStart(3, '0')}`,
}));

export class DefaultQuestionTemplate0039DefaultQuestionTemplate1789200000000
  implements MigrationInterface
{
  name = 'DefaultQuestionTemplate0039DefaultQuestionTemplate1789200000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO "question_templates" ("id", "name", "draft_questions")
       SELECT $1::uuid, $2::varchar(255), $3::jsonb
       WHERE NOT EXISTS (
         SELECT 1 FROM "question_templates"
         WHERE "id" = $1::uuid OR ("deleted_at" IS NULL AND "name" = $2::varchar(255))
       )`,
      [defaultTemplateId, defaultTemplateName, JSON.stringify(defaultQuestions)],
    );
    await queryRunner.query(
      `INSERT INTO "question_template_versions" ("id", "template_id", "version", "name", "questions")
       SELECT $2::uuid, "id", 1, "name", "draft_questions"
       FROM "question_templates"
       WHERE "id" = $1::uuid
         AND NOT EXISTS (
           SELECT 1 FROM "question_template_versions"
           WHERE "template_id" = $1::uuid AND "version" = 1
         )`,
      [defaultTemplateId, defaultVersionId],
    );
  }

  async down(): Promise<void> {
    throw new Error('Migration 0039 is forward-only because Projects may retain its template version.');
  }
}
