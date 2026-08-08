import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DiscoveryFollowUps0006DiscoveryFollowUps1786348800000
  implements MigrationInterface
{
  name = 'DiscoveryFollowUps0006DiscoveryFollowUps1786348800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "discovery_follow_up_category" AS ENUM (
        'BUSINESS', 'SCOPE', 'TECHNICAL', 'DATA',
        'INTEGRATION', 'SECURITY', 'OPERATIONS', 'OTHER'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "discovery_follow_ups" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL,
        "category" "discovery_follow_up_category" NOT NULL,
        "question" text NOT NULL,
        "owner" varchar(255) NOT NULL,
        "due_date" date NOT NULL,
        "status" varchar(100) NOT NULL,
        "next_step" text NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_discovery_follow_ups_question_not_blank"
          CHECK (btrim("question") <> ''),
        CONSTRAINT "chk_discovery_follow_ups_question_length"
          CHECK (char_length("question") <= 10000),
        CONSTRAINT "chk_discovery_follow_ups_owner_not_blank"
          CHECK (btrim("owner") <> ''),
        CONSTRAINT "chk_discovery_follow_ups_status_not_blank"
          CHECK (btrim("status") <> ''),
        CONSTRAINT "chk_discovery_follow_ups_next_step_not_blank"
          CHECK (btrim("next_step") <> ''),
        CONSTRAINT "chk_discovery_follow_ups_next_step_length"
          CHECK (char_length("next_step") <= 10000),
        CONSTRAINT "fk_discovery_follow_ups_project"
          FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE FUNCTION "set_discovery_follow_ups_updated_at"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        NEW."updated_at" = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_discovery_follow_ups_updated_at"
      BEFORE UPDATE ON "discovery_follow_ups"
      FOR EACH ROW
      EXECUTE FUNCTION "set_discovery_follow_ups_updated_at"()
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_discovery_follow_ups_project_due_created_id"
      ON "discovery_follow_ups" ("project_id", "due_date", "created_at", "id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX "idx_discovery_follow_ups_project_due_created_id"
    `);
    await queryRunner.query(`
      DROP TRIGGER "trg_discovery_follow_ups_updated_at" ON "discovery_follow_ups"
    `);
    await queryRunner.query(`DROP TABLE "discovery_follow_ups"`);
    await queryRunner.query(`DROP FUNCTION "set_discovery_follow_ups_updated_at"()`);
    await queryRunner.query(`DROP TYPE "discovery_follow_up_category"`);
  }
}
