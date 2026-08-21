import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DeliveryAndGit0030DeliveryAndGit1788422400000 implements MigrationInterface {
  name = 'DeliveryAndGit0030DeliveryAndGit1788422400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('ALTER TABLE "audit_events" ALTER COLUMN "project_id" DROP NOT NULL');
    await queryRunner.query(`
      CREATE TABLE "delivery_packages" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL UNIQUE REFERENCES "projects"("id") ON DELETE RESTRICT,
        "specification_revision_id" uuid NOT NULL REFERENCES "markdown_revisions"("id") ON DELETE RESTRICT,
        "specification_version" integer NOT NULL CHECK ("specification_version" > 0),
        "version" integer NOT NULL CHECK ("version" > 0),
        "items" jsonb NOT NULL CHECK (jsonb_typeof("items") = 'array'),
        "created_by" varchar(100) NOT NULL,
        "updated_by" varchar(100) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "git_setups" (
        "id" uuid PRIMARY KEY,
        "name" varchar(255) NOT NULL,
        "remote_url" text NOT NULL,
        "branch" varchar(255) NOT NULL,
        "authentication_mode" varchar(20) NOT NULL CHECK ("authentication_mode" IN ('HTTPS_TOKEN', 'SSH_KEY')),
        "username" varchar(255),
        "credential_ciphertext" text NOT NULL,
        "repository_web_url" text,
        "version" integer NOT NULL CHECK ("version" > 0),
        "created_by" varchar(100) NOT NULL,
        "updated_by" varchar(100) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_git_setups_name" CHECK (btrim("name") <> ''),
        CONSTRAINT "chk_git_setups_remote" CHECK (btrim("remote_url") <> ''),
        CONSTRAINT "chk_git_setups_branch" CHECK (btrim("branch") <> '')
      )
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "uq_git_setups_name" ON "git_setups" (lower(btrim("name")))');
    await queryRunner.query(`
      CREATE TABLE "delivery_handoffs" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE RESTRICT,
        "delivery_package_id" uuid NOT NULL REFERENCES "delivery_packages"("id") ON DELETE RESTRICT,
        "package_version" integer NOT NULL CHECK ("package_version" > 0),
        "git_setup_id" uuid REFERENCES "git_setups"("id") ON DELETE SET NULL,
        "preview_id" uuid NOT NULL UNIQUE,
        "target_digest" varchar(64) NOT NULL,
        "target_snapshot" jsonb NOT NULL,
        "package_snapshot" jsonb NOT NULL,
        "artifact_path" text NOT NULL,
        "artifact_content" text NOT NULL,
        "artifact_digest" varchar(64) NOT NULL,
        "commit_message" varchar(255) NOT NULL,
        "state" varchar(20) NOT NULL CHECK ("state" IN ('PENDING', 'PUSHING', 'SENT', 'FAILED', 'CONFLICT')),
        "expected_commit_sha" varchar(64),
        "commit_sha" varchar(64),
        "repository_backlink" text,
        "failure_code" varchar(100),
        "attempt_count" integer NOT NULL DEFAULT 0 CHECK ("attempt_count" >= 0),
        "created_by" varchar(100) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("delivery_package_id", "package_version", "target_digest")
      )
    `);
    await queryRunner.query(`
      CREATE FUNCTION "protect_delivery_handoff_snapshot"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE'
          OR NEW."id" IS DISTINCT FROM OLD."id"
          OR NEW."project_id" IS DISTINCT FROM OLD."project_id"
          OR NEW."delivery_package_id" IS DISTINCT FROM OLD."delivery_package_id"
          OR NEW."package_version" IS DISTINCT FROM OLD."package_version"
          OR NEW."preview_id" IS DISTINCT FROM OLD."preview_id"
          OR NEW."target_digest" IS DISTINCT FROM OLD."target_digest"
          OR NEW."target_snapshot" IS DISTINCT FROM OLD."target_snapshot"
          OR NEW."package_snapshot" IS DISTINCT FROM OLD."package_snapshot"
          OR NEW."artifact_path" IS DISTINCT FROM OLD."artifact_path"
          OR NEW."artifact_content" IS DISTINCT FROM OLD."artifact_content"
          OR NEW."artifact_digest" IS DISTINCT FROM OLD."artifact_digest"
          OR NEW."commit_message" IS DISTINCT FROM OLD."commit_message"
          OR NEW."created_by" IS DISTINCT FROM OLD."created_by"
          OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
        THEN
          RAISE EXCEPTION 'Delivery handoff snapshot is immutable' USING ERRCODE = '55000';
        END IF;
        NEW."updated_at" = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query('CREATE TRIGGER "trg_delivery_handoff_snapshot" BEFORE UPDATE OR DELETE ON "delivery_handoffs" FOR EACH ROW EXECUTE FUNCTION "protect_delivery_handoff_snapshot"()');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const retained = await queryRunner.query(`
      SELECT
        (SELECT COUNT(*) FROM "delivery_packages") +
        (SELECT COUNT(*) FROM "delivery_handoffs") +
        (SELECT COUNT(*) FROM "git_setups") AS "count"
    `) as Array<{ count: string }>;
    if (Number(retained[0]?.count ?? 0) > 0) {
      throw new Error('Migration 0030 cannot remove retained Delivery or Git data.');
    }
    await queryRunner.query('DROP TRIGGER "trg_delivery_handoff_snapshot" ON "delivery_handoffs"');
    await queryRunner.query('DROP FUNCTION "protect_delivery_handoff_snapshot"()');
    await queryRunner.query('DROP TABLE "delivery_handoffs"');
    await queryRunner.query('DROP TABLE "git_setups"');
    await queryRunner.query('DROP TABLE "delivery_packages"');
    await queryRunner.query(`DELETE FROM "audit_events" WHERE "project_id" IS NULL`);
    await queryRunner.query('ALTER TABLE "audit_events" ALTER COLUMN "project_id" SET NOT NULL');
  }
}
