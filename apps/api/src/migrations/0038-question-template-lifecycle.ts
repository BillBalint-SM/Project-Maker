import type { MigrationInterface, QueryRunner } from 'typeorm';

export class QuestionTemplateLifecycle0038QuestionTemplateLifecycle1789113600000
  implements MigrationInterface
{
  name = 'QuestionTemplateLifecycle0038QuestionTemplateLifecycle1789113600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "question_templates"
      ADD COLUMN "focused_project_id" uuid,
      ADD COLUMN "deleted_at" timestamptz,
      ADD CONSTRAINT "fk_question_templates_focused_project"
        FOREIGN KEY ("focused_project_id") REFERENCES "projects"("id") ON DELETE SET NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN "question_template_id" uuid,
      ADD CONSTRAINT "fk_projects_question_template"
        FOREIGN KEY ("question_template_id") REFERENCES "question_templates"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "question_templates" DROP CONSTRAINT "uq_question_templates_name"
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_question_templates_active_name"
      ON "question_templates" ("name") WHERE "deleted_at" IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "uq_question_templates_active_name"`);
    await queryRunner.query(`ALTER TABLE "question_templates" ADD CONSTRAINT "uq_question_templates_name" UNIQUE ("name")`);
    await queryRunner.query(`ALTER TABLE "projects" DROP CONSTRAINT "fk_projects_question_template"`);
    await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "question_template_id"`);
    await queryRunner.query(`ALTER TABLE "question_templates" DROP CONSTRAINT "fk_question_templates_focused_project"`);
    await queryRunner.query(`ALTER TABLE "question_templates" DROP COLUMN "deleted_at", DROP COLUMN "focused_project_id"`);
  }
}
