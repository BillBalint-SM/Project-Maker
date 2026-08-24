import type { MigrationInterface, QueryRunner } from 'typeorm';

export class QuestionTemplateLibrary0037QuestionTemplateLibrary1789027200000
  implements MigrationInterface
{
  name = 'QuestionTemplateLibrary0037QuestionTemplateLibrary1789027200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "question_templates" (
        "id" uuid PRIMARY KEY,
        "name" varchar(255) NOT NULL,
        "draft_questions" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_question_templates_name" UNIQUE ("name"),
        CONSTRAINT "chk_question_templates_name" CHECK (btrim("name") <> ''),
        CONSTRAINT "chk_question_templates_draft_questions" CHECK (
          jsonb_typeof("draft_questions") = 'array' AND jsonb_array_length("draft_questions") > 0
        )
      )
    `);
    await queryRunner.query(`
      CREATE FUNCTION "set_question_templates_updated_at"()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        NEW."updated_at" = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_question_templates_updated_at"
      BEFORE UPDATE ON "question_templates"
      FOR EACH ROW EXECUTE FUNCTION "set_question_templates_updated_at"()
    `);
    await queryRunner.query(`
      CREATE TABLE "question_template_versions" (
        "id" uuid PRIMARY KEY,
        "template_id" uuid NOT NULL,
        "version" integer NOT NULL,
        "name" varchar(255) NOT NULL,
        "questions" jsonb NOT NULL,
        "published_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_question_template_versions_template_version" UNIQUE ("template_id", "version"),
        CONSTRAINT "chk_question_template_versions_version" CHECK ("version" > 0),
        CONSTRAINT "chk_question_template_versions_name" CHECK (btrim("name") <> ''),
        CONSTRAINT "chk_question_template_versions_questions" CHECK (
          jsonb_typeof("questions") = 'array' AND jsonb_array_length("questions") > 0
        ),
        CONSTRAINT "fk_question_template_versions_template"
          FOREIGN KEY ("template_id") REFERENCES "question_templates"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE FUNCTION "reject_question_template_version_change"()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Published Question Template versions are immutable' USING ERRCODE = '55000';
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_question_template_versions_immutable"
      BEFORE UPDATE OR DELETE ON "question_template_versions"
      FOR EACH ROW EXECUTE FUNCTION "reject_question_template_version_change"()
    `);
    await queryRunner.query(`
      ALTER TABLE "project_question_schemas"
      ADD COLUMN "question_template_id" uuid,
      ADD COLUMN "question_template_name" varchar(255),
      ADD COLUMN "question_template_version" integer,
      ADD CONSTRAINT "chk_project_question_schemas_template_provenance" CHECK (
        ("question_template_id" IS NULL AND "question_template_name" IS NULL AND "question_template_version" IS NULL)
        OR
        ("question_template_id" IS NOT NULL AND "question_template_name" IS NOT NULL
          AND btrim("question_template_name") <> '' AND "question_template_version" > 0)
      ),
      ADD CONSTRAINT "fk_project_question_schemas_question_template_version"
        FOREIGN KEY ("question_template_id", "question_template_version")
        REFERENCES "question_template_versions"("template_id", "version") ON DELETE RESTRICT
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const activity = await queryRunner.query(`
      SELECT 1 FROM "question_templates"
      UNION ALL SELECT 1 FROM "project_question_schemas" WHERE "question_template_id" IS NOT NULL
      LIMIT 1
    `);
    if (activity.length > 0) {
      throw new Error('Migration 0037 cannot remove persisted Question Template activity.');
    }
    await queryRunner.query(`ALTER TABLE "project_question_schemas" DROP CONSTRAINT "fk_project_question_schemas_question_template_version"`);
    await queryRunner.query(`ALTER TABLE "project_question_schemas" DROP CONSTRAINT "chk_project_question_schemas_template_provenance"`);
    await queryRunner.query(`ALTER TABLE "project_question_schemas" DROP COLUMN "question_template_version", DROP COLUMN "question_template_name", DROP COLUMN "question_template_id"`);
    await queryRunner.query(`DROP TRIGGER "trg_question_template_versions_immutable" ON "question_template_versions"`);
    await queryRunner.query(`DROP FUNCTION "reject_question_template_version_change"()`);
    await queryRunner.query(`DROP TABLE "question_template_versions"`);
    await queryRunner.query(`DROP TRIGGER "trg_question_templates_updated_at" ON "question_templates"`);
    await queryRunner.query(`DROP FUNCTION "set_question_templates_updated_at"()`);
    await queryRunner.query(`DROP TABLE "question_templates"`);
  }
}
