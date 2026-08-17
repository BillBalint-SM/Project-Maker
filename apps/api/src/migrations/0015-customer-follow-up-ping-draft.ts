import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerFollowUpPingDraft0015CustomerFollowUpPingDraft1787126400000
  implements MigrationInterface
{
  name = 'CustomerFollowUpPingDraft0015CustomerFollowUpPingDraft1787126400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer_follow_ups"
      ADD COLUMN "message_draft" text,
      ADD COLUMN "referenced_follow_up_id" uuid,
      ADD COLUMN "draft_version" integer NOT NULL DEFAULT 1,
      ADD COLUMN "preview_token_digest" varchar(64),
      ADD COLUMN "preview_fingerprint" varchar(64),
      ADD COLUMN "preview_expires_at" timestamptz,
      ADD CONSTRAINT "chk_customer_follow_ups_message_draft" CHECK (
        "message_draft" IS NULL
        OR (btrim("message_draft") <> '' AND char_length("message_draft") <= 10000)
      ),
      ADD CONSTRAINT "chk_customer_follow_ups_draft_version" CHECK ("draft_version" > 0)
    `);
    await queryRunner.query(`
      ALTER TABLE "discovery_follow_ups"
      ADD CONSTRAINT "uq_discovery_follow_ups_id_project" UNIQUE ("id", "project_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_follow_ups"
      ADD CONSTRAINT "fk_customer_follow_ups_reference_project"
      FOREIGN KEY ("referenced_follow_up_id", "project_id")
      REFERENCES "discovery_follow_ups"("id", "project_id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      CREATE TABLE "customer_follow_up_delivery_attempts" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL,
        "draft_version" integer NOT NULL,
        "referenced_follow_up_id" uuid,
        "referenced_follow_up_version" integer,
        "state" varchar(20) NOT NULL,
        "recipient_email" varchar(320) NOT NULL,
        "subject_length" integer NOT NULL,
        "text_length" integer NOT NULL,
        "failure_code" varchar(100),
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "attempted_at" timestamptz NOT NULL,
        "sent_at" timestamptz,
        CONSTRAINT "chk_customer_follow_up_attempt_state"
          CHECK ("state" IN ('SENDING', 'SENT', 'FAILED', 'UNKNOWN')),
        CONSTRAINT "chk_customer_follow_up_attempt_versions"
          CHECK ("draft_version" > 0 AND ("referenced_follow_up_version" IS NULL OR "referenced_follow_up_version" > 0)),
        CONSTRAINT "chk_customer_follow_up_attempt_lengths"
          CHECK ("subject_length" >= 0 AND "text_length" >= 0),
        CONSTRAINT "chk_customer_follow_up_attempt_sent_at"
          CHECK (("state" = 'SENT' AND "sent_at" IS NOT NULL) OR ("state" <> 'SENT' AND "sent_at" IS NULL)),
        CONSTRAINT "fk_customer_follow_up_attempt_project"
          FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_customer_follow_up_attempt_reference_project"
          FOREIGN KEY ("referenced_follow_up_id", "project_id")
          REFERENCES "discovery_follow_ups"("id", "project_id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_customer_follow_up_attempt_active"
      ON "customer_follow_up_delivery_attempts" ("project_id", "draft_version")
      WHERE "state" = 'SENDING'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'LOCK TABLE "customer_follow_ups", "customer_follow_up_delivery_attempts" IN ACCESS EXCLUSIVE MODE',
    );
    const rows = (await queryRunner.query(`
      SELECT
        (SELECT COUNT(*)::text
         FROM "customer_follow_ups"
         WHERE "message_draft" IS NOT NULL
            OR "referenced_follow_up_id" IS NOT NULL
            OR "draft_version" <> 1
            OR "preview_token_digest" IS NOT NULL
            OR "preview_fingerprint" IS NOT NULL
            OR "preview_expires_at" IS NOT NULL) AS "draftActivityCount",
        (SELECT COUNT(*)::text FROM "customer_follow_up_delivery_attempts") AS "attemptCount"
    `)) as Array<{ draftActivityCount: string; attemptCount: string }>;
    const draftActivityCount = rows[0]?.draftActivityCount ?? '0';
    const attemptCount = rows[0]?.attemptCount ?? '0';
    if (draftActivityCount !== '0' || attemptCount !== '0') {
      throw new Error(
        `Migration 0015 cannot remove retained Customer follow-up ping activity (drafts=${draftActivityCount}, attempts=${attemptCount}).`,
      );
    }

    await queryRunner.query('DROP INDEX "uq_customer_follow_up_attempt_active"');
    await queryRunner.query('DROP TABLE "customer_follow_up_delivery_attempts"');
    await queryRunner.query(
      'ALTER TABLE "customer_follow_ups" DROP CONSTRAINT "fk_customer_follow_ups_reference_project"',
    );
    await queryRunner.query(
      'ALTER TABLE "discovery_follow_ups" DROP CONSTRAINT "uq_discovery_follow_ups_id_project"',
    );
    await queryRunner.query(`
      ALTER TABLE "customer_follow_ups"
      DROP CONSTRAINT "chk_customer_follow_ups_draft_version",
      DROP CONSTRAINT "chk_customer_follow_ups_message_draft",
      DROP COLUMN "draft_version",
      DROP COLUMN "referenced_follow_up_id",
      DROP COLUMN "message_draft",
      DROP COLUMN "preview_expires_at",
      DROP COLUMN "preview_fingerprint",
      DROP COLUMN "preview_token_digest"
    `);
  }
}
