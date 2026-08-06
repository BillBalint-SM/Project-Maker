import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerFollowUps0004CustomerFollowUps1786176000000
  implements MigrationInterface
{
  name = 'CustomerFollowUps0004CustomerFollowUps1786176000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "follow_up_delivery_status" AS ENUM ('NEVER', 'SENT', 'FAILED')
    `);

    await queryRunner.query(`
      CREATE TABLE "customer_follow_ups" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL,
        "enabled" boolean NOT NULL DEFAULT false,
        "interval_minutes" integer NOT NULL DEFAULT 10080,
        "expires_at" timestamptz,
        "last_ping_at" timestamptz,
        "next_ping_at" timestamptz,
        "last_delivery_status" "follow_up_delivery_status" NOT NULL DEFAULT 'NEVER',
        "last_delivery_error" varchar(100),
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_customer_follow_ups_project_id" UNIQUE ("project_id"),
        CONSTRAINT "chk_customer_follow_ups_interval_minutes" CHECK (
          "interval_minutes" > 0 AND "interval_minutes" <= 525600
        ),
        CONSTRAINT "chk_customer_follow_ups_next_ping_enabled" CHECK (
          "enabled" OR "next_ping_at" IS NULL
        ),
        CONSTRAINT "chk_customer_follow_ups_delivery_error" CHECK (
          "last_delivery_error" IS NULL OR "last_delivery_status" = 'FAILED'
        ),
        CONSTRAINT "fk_customer_follow_ups_project"
          FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE FUNCTION "set_customer_follow_ups_updated_at"()
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
      CREATE TRIGGER "trg_customer_follow_ups_updated_at"
      BEFORE UPDATE ON "customer_follow_ups"
      FOR EACH ROW
      EXECUTE FUNCTION "set_customer_follow_ups_updated_at"()
    `);

    await queryRunner.query(
      'CREATE INDEX "idx_customer_follow_ups_due" ON "customer_follow_ups" ("enabled", "next_ping_at") WHERE "enabled" = true AND "next_ping_at" IS NOT NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "idx_customer_follow_ups_due"');
    await queryRunner.query('DROP TRIGGER "trg_customer_follow_ups_updated_at" ON "customer_follow_ups"');
    await queryRunner.query('DROP TABLE "customer_follow_ups"');
    await queryRunner.query('DROP FUNCTION "set_customer_follow_ups_updated_at"()');
    await queryRunner.query('DROP TYPE "follow_up_delivery_status"');
  }
}
