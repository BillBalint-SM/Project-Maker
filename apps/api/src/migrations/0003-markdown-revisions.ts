import type { MigrationInterface, QueryRunner } from 'typeorm';

export class MarkdownRevisions0003MarkdownRevisions1786089600000
  implements MigrationInterface
{
  name = 'MarkdownRevisions0003MarkdownRevisions1786089600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "markdown_revision_reason" AS ENUM ('MANUAL', 'MILESTONE')
    `);

    await queryRunner.query(`
      CREATE TABLE "markdown_revisions" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL,
        "version" integer NOT NULL,
        "reason" "markdown_revision_reason" NOT NULL,
        "milestone" varchar(255),
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "source_snapshot" jsonb NOT NULL,
        "change_summary" text NOT NULL,
        "content" text NOT NULL,
        "previous_revision_id" uuid,
        CONSTRAINT "uq_markdown_revisions_project_version" UNIQUE ("project_id", "version"),
        CONSTRAINT "uq_markdown_revisions_project_id_id" UNIQUE ("project_id", "id"),
        CONSTRAINT "chk_markdown_revisions_version" CHECK ("version" > 0),
        CONSTRAINT "chk_markdown_revisions_milestone" CHECK (
          "milestone" IS NULL OR btrim("milestone") <> ''
        ),
        CONSTRAINT "chk_markdown_revisions_source_snapshot_object" CHECK (
          jsonb_typeof("source_snapshot") = 'object'
        ),
        CONSTRAINT "chk_markdown_revisions_change_summary_not_blank" CHECK (
          btrim("change_summary") <> ''
        ),
        CONSTRAINT "chk_markdown_revisions_content_not_blank" CHECK (
          btrim("content") <> ''
        ),
        CONSTRAINT "chk_markdown_revisions_previous_not_self" CHECK (
          "previous_revision_id" IS NULL OR "previous_revision_id" <> "id"
        ),
        CONSTRAINT "fk_markdown_revisions_project"
          FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_markdown_revisions_previous"
          FOREIGN KEY ("project_id", "previous_revision_id")
          REFERENCES "markdown_revisions"("project_id", "id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE FUNCTION "reject_immutable_markdown_revision_change"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION 'Markdown revisions are immutable' USING ERRCODE = '55000';
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_markdown_revisions_immutable"
      BEFORE UPDATE OR DELETE ON "markdown_revisions"
      FOR EACH ROW
      EXECUTE FUNCTION "reject_immutable_markdown_revision_change"()
    `);

    await queryRunner.query(
      'CREATE INDEX "idx_markdown_revisions_project_created" ON "markdown_revisions" ("project_id", "created_at" DESC, "version" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_markdown_revisions_previous" ON "markdown_revisions" ("previous_revision_id") WHERE "previous_revision_id" IS NOT NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TRIGGER "trg_markdown_revisions_immutable" ON "markdown_revisions"');
    await queryRunner.query('DROP TABLE "markdown_revisions"');
    await queryRunner.query('DROP FUNCTION "reject_immutable_markdown_revision_change"()');
    await queryRunner.query('DROP TYPE "markdown_revision_reason"');
  }
}
