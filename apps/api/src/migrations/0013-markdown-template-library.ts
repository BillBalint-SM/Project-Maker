import type { MigrationInterface, QueryRunner } from 'typeorm';

const defaultTemplateId = '00000000-0000-4000-8000-000000000013';
const defaultVersionId = '00000000-0000-4000-8000-000000000113';
const defaultContent = `# Projekt specifikáció — {{project.name}}

{{revision.metadata}}

{{project.context}}

{{project.schema?}}

{{project.initialIntake?}}

{{project.readiness?}}

{{project.decisionReview?}}`;

export class MarkdownTemplateLibrary0013MarkdownTemplateLibrary1786953600000
  implements MigrationInterface
{
  name = 'MarkdownTemplateLibrary0013MarkdownTemplateLibrary1786953600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "markdown_templates" (
        "id" uuid PRIMARY KEY,
        "name" varchar(255) NOT NULL,
        "draft_content" text NOT NULL,
        "is_default" boolean NOT NULL DEFAULT false,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_markdown_templates_name" UNIQUE ("name"),
        CONSTRAINT "chk_markdown_templates_name_not_blank" CHECK (btrim("name") <> ''),
        CONSTRAINT "chk_markdown_templates_draft_not_blank" CHECK (btrim("draft_content") <> '')
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_markdown_templates_single_default"
      ON "markdown_templates" ("is_default") WHERE "is_default" = true
    `);
    await queryRunner.query(`
      CREATE FUNCTION "set_markdown_templates_updated_at"()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        NEW."updated_at" = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_markdown_templates_updated_at"
      BEFORE UPDATE ON "markdown_templates"
      FOR EACH ROW EXECUTE FUNCTION "set_markdown_templates_updated_at"()
    `);
    await queryRunner.query(`
      CREATE TABLE "markdown_template_versions" (
        "id" uuid PRIMARY KEY,
        "template_id" uuid NOT NULL,
        "version" integer NOT NULL,
        "content" text NOT NULL,
        "published_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_markdown_template_versions_template_version" UNIQUE ("template_id", "version"),
        CONSTRAINT "chk_markdown_template_versions_version_positive" CHECK ("version" > 0),
        CONSTRAINT "chk_markdown_template_versions_content_not_blank" CHECK (btrim("content") <> ''),
        CONSTRAINT "fk_markdown_template_versions_template"
          FOREIGN KEY ("template_id") REFERENCES "markdown_templates"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE FUNCTION "reject_immutable_markdown_template_version_change"()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Published Markdown template versions are immutable' USING ERRCODE = '55000';
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_markdown_template_versions_immutable"
      BEFORE UPDATE OR DELETE ON "markdown_template_versions"
      FOR EACH ROW EXECUTE FUNCTION "reject_immutable_markdown_template_version_change"()
    `);
    await queryRunner.query(`ALTER TABLE "projects" ADD COLUMN "markdown_template_id" uuid`);
    await queryRunner.query(`
      ALTER TABLE "projects" ADD CONSTRAINT "fk_projects_markdown_template"
      FOREIGN KEY ("markdown_template_id") REFERENCES "markdown_templates"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      ALTER TABLE "markdown_revisions"
      ADD COLUMN "template_id" uuid,
      ADD COLUMN "template_name" varchar(255),
      ADD COLUMN "template_version" integer,
      ADD CONSTRAINT "chk_markdown_revisions_template_provenance" CHECK (
        ("template_id" IS NULL AND "template_name" IS NULL AND "template_version" IS NULL)
        OR
        ("template_id" IS NOT NULL AND btrim("template_name") <> '' AND "template_version" > 0)
      )
    `);
    await queryRunner.query(
      `INSERT INTO "markdown_templates" ("id", "name", "draft_content", "is_default") VALUES ($1, $2, $3, true)`,
      [defaultTemplateId, 'Alapértelmezett projektterv', defaultContent],
    );
    await queryRunner.query(
      `INSERT INTO "markdown_template_versions" ("id", "template_id", "version", "content") VALUES ($1, $2, 1, $3)`,
      [defaultVersionId, defaultTemplateId, defaultContent],
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('LOCK TABLE "projects", "markdown_revisions", "markdown_templates" IN ACCESS EXCLUSIVE MODE');
    const rows = await queryRunner.query(
      `SELECT 1 FROM "projects" WHERE "markdown_template_id" IS NOT NULL
       UNION ALL SELECT 1 FROM "markdown_revisions" WHERE "template_id" IS NOT NULL
       UNION ALL SELECT 1 FROM "markdown_templates" WHERE "id" <> $1 LIMIT 1`,
      [defaultTemplateId],
    );
    if (rows.length > 0) {
      throw new Error('Migration 0013 cannot remove persisted Markdown template activity.');
    }
    await queryRunner.query('ALTER TABLE "markdown_revisions" DROP CONSTRAINT "chk_markdown_revisions_template_provenance"');
    await queryRunner.query('ALTER TABLE "markdown_revisions" DROP COLUMN "template_version", DROP COLUMN "template_name", DROP COLUMN "template_id"');
    await queryRunner.query('ALTER TABLE "projects" DROP CONSTRAINT "fk_projects_markdown_template"');
    await queryRunner.query('ALTER TABLE "projects" DROP COLUMN "markdown_template_id"');
    await queryRunner.query('DROP TRIGGER "trg_markdown_template_versions_immutable" ON "markdown_template_versions"');
    await queryRunner.query('DROP FUNCTION "reject_immutable_markdown_template_version_change"()');
    await queryRunner.query('DROP TABLE "markdown_template_versions"');
    await queryRunner.query('DROP TRIGGER "trg_markdown_templates_updated_at" ON "markdown_templates"');
    await queryRunner.query('DROP FUNCTION "set_markdown_templates_updated_at"()');
    await queryRunner.query('DROP TABLE "markdown_templates"');
  }
}
