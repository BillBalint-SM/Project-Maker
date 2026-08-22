import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Moves the historical handoff mail snapshot into the canonical correspondence
 * records. Existing encrypted mailbox cursors are intentionally reset: the
 * sync worker recovers from its retained successful-sync cutoff and ingestion
 * stays idempotent on mailbox message identity.
 */
export class CanonicalCustomerMailPersistence0032CanonicalCustomerMailPersistence1788595200000
  implements MigrationInterface
{
  name =
    'CanonicalCustomerMailPersistence0032CanonicalCustomerMailPersistence1788595200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      INSERT INTO "customer_outbound_communications" (
        "id", "project_id", "source_type", "source_id", "sender_name", "sender_address",
        "recipient_name", "recipient_address", "subject", "html_content", "text_content",
        "source_content_version", "preview_digest", "reply_to_address", "reply_token_hash", "created_at"
      )
      SELECT gen_random_uuid(), handoff."project_id", 'INTERVIEW_HANDOFF', handoff."id",
        handoff."sender_name", handoff."sender_address", handoff."recipient_name", handoff."recipient_email",
        handoff."subject", handoff."html_content", handoff."text_content", handoff."source_content_version",
        handoff."preview_digest", handoff."reply_to_address", handoff."reply_token_hash", handoff."created_at"
      FROM "interview_customer_handoffs" handoff
      LEFT JOIN "customer_outbound_communications" outbound ON outbound."source_id" = handoff."id"
      WHERE outbound."id" IS NULL
        AND handoff."sender_name" IS NOT NULL AND handoff."sender_address" IS NOT NULL
        AND handoff."recipient_name" IS NOT NULL AND handoff."recipient_email" IS NOT NULL
        AND handoff."subject" IS NOT NULL AND handoff."html_content" IS NOT NULL AND handoff."text_content" IS NOT NULL
        AND handoff."source_content_version" IS NOT NULL AND handoff."preview_digest" IS NOT NULL
        AND handoff."reply_to_address" IS NOT NULL AND handoff."reply_token_hash" IS NOT NULL
    `);
    // Historical SENT handoffs are otherwise immutable. This is the one
    // controlled preservation backfill; migration transactions restore the
    // trigger if any following statement fails.
    await queryRunner.query(
      'ALTER TABLE "interview_customer_handoffs" DISABLE TRIGGER "trg_interview_customer_handoffs_protect_change"',
    );
    await queryRunner.query(`
      ALTER TABLE "interview_customer_handoffs"
      DROP CONSTRAINT "chk_interview_customer_handoffs_sent_at",
      ADD CONSTRAINT "chk_interview_customer_handoffs_sent_at" CHECK (
        "outbound_communication_id" IS NOT NULL
        OR ("state" = 'SENT' AND "sent_at" IS NOT NULL)
        OR ("state" <> 'SENT' AND "sent_at" IS NULL)
      )
    `);
    await queryRunner.query(`
      UPDATE "interview_customer_handoffs" handoff
      SET "outbound_communication_id" = outbound."id"
      FROM "customer_outbound_communications" outbound
      WHERE outbound."source_type" = 'INTERVIEW_HANDOFF' AND outbound."source_id" = handoff."id"
        AND handoff."outbound_communication_id" IS NULL
    `);
    await queryRunner.query(`
      CREATE TEMPORARY TABLE "canonical_handoff_correspondence" ON COMMIT DROP AS
      SELECT handoff."id" AS "handoff_id", gen_random_uuid() AS "correspondence_id"
      FROM "interview_customer_handoffs" handoff
      LEFT JOIN "customer_correspondences" correspondence
        ON correspondence."outbound_communication_id" = handoff."outbound_communication_id"
      WHERE handoff."outbound_communication_id" IS NOT NULL AND correspondence."id" IS NULL
    `);
    await queryRunner.query(`
      INSERT INTO "customer_correspondences" (
        "id", "project_id", "outbound_communication_id", "predecessor_id", "status", "unread_message_count", "created_at"
      )
      SELECT map."correspondence_id", handoff."project_id", handoff."outbound_communication_id",
        COALESCE(predecessor."correspondence_id", predecessor_map."correspondence_id"),
        'Válaszra vár', 0, handoff."created_at"
      FROM "interview_customer_handoffs" handoff
      JOIN "canonical_handoff_correspondence" map ON map."handoff_id" = handoff."id"
      LEFT JOIN "interview_customer_handoffs" predecessor ON predecessor."id" = handoff."supersedes_handoff_id"
      LEFT JOIN "canonical_handoff_correspondence" predecessor_map ON predecessor_map."handoff_id" = predecessor."id"
    `);
    await queryRunner.query(`
      UPDATE "interview_customer_handoffs" handoff
      SET "correspondence_id" = correspondence."id"
      FROM "customer_correspondences" correspondence
      WHERE correspondence."outbound_communication_id" = handoff."outbound_communication_id"
        AND handoff."correspondence_id" IS NULL
    `);
    await queryRunner.query(`
      INSERT INTO "customer_outbound_attempts" ("id", "outbound_communication_id", "result", "failure_code", "message_reference", "attempted_at")
      SELECT gen_random_uuid(), handoff."outbound_communication_id",
        CASE WHEN handoff."state" = 'SENT' THEN 'ACCEPTED' WHEN handoff."state" = 'FAILED' THEN 'REJECTED' ELSE 'UNKNOWN' END,
        handoff."failure_code", handoff."message_reference", COALESCE(handoff."attempted_at", handoff."updated_at", handoff."created_at")
      FROM "interview_customer_handoffs" handoff
      WHERE handoff."outbound_communication_id" IS NOT NULL AND handoff."state" <> 'DRAFT'
        AND NOT EXISTS (SELECT 1 FROM "customer_outbound_attempts" attempt WHERE attempt."outbound_communication_id" = handoff."outbound_communication_id")
    `);
    await queryRunner.query(`
      UPDATE "interview_customer_handoffs"
      SET "recipient_name" = NULL, "recipient_email" = NULL,
          "sender_name" = NULL, "sender_address" = NULL,
          "reply_to_address" = NULL, "reply_token_hash" = NULL,
          "mail_system_acceptance" = NULL, "message_reference" = NULL,
          "subject" = NULL, "html_content" = NULL, "text_content" = NULL,
          "preview_digest" = NULL, "source_content_version" = NULL,
          "failure_code" = NULL, "attempted_at" = NULL, "sent_at" = NULL
      WHERE "outbound_communication_id" IS NOT NULL
    `);
    await queryRunner.query(
      'ALTER TABLE "interview_customer_handoffs" ENABLE TRIGGER "trg_interview_customer_handoffs_protect_change"',
    );
    await queryRunner.query(`
      UPDATE "customer_mailbox_sync"
      SET "delta_checkpoint" = NULL, "baseline_established" = false,
          "state" = 'INITIALIZING', "failure_code" = NULL,
          "lease_token" = NULL, "lease_expires_at" = NULL
      WHERE "delta_checkpoint" IS NOT NULL
    `);
    // Attempts created before the correspondence gateway had no complete mail
    // snapshot. Their source state remains readable, but no synthetic outbound
    // message or reply identity is invented for them.
    await queryRunner.query(`
      INSERT INTO "customer_outbound_attempts" ("id", "outbound_communication_id", "result", "failure_code", "message_reference", "attempted_at")
      SELECT gen_random_uuid(), follow_up."outbound_communication_id",
        CASE WHEN follow_up."state" = 'SENT' THEN 'ACCEPTED' WHEN follow_up."state" = 'FAILED' THEN 'REJECTED' ELSE 'UNKNOWN' END,
        follow_up."failure_code", follow_up."message_reference", follow_up."attempted_at"
      FROM "customer_follow_up_delivery_attempts" follow_up
      WHERE follow_up."outbound_communication_id" IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM "customer_outbound_attempts" attempt WHERE attempt."outbound_communication_id" = follow_up."outbound_communication_id")
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_follow_up_delivery_attempts"
      DROP CONSTRAINT "chk_customer_follow_up_attempt_lengths",
      DROP CONSTRAINT "chk_customer_follow_up_attempt_sent_at",
      ADD CONSTRAINT "chk_customer_follow_up_attempt_sent_at" CHECK (
        "outbound_communication_id" IS NOT NULL
        OR (("state" = 'SENT' AND "sent_at" IS NOT NULL) OR ("state" <> 'SENT' AND "sent_at" IS NULL))
      ),
      ALTER COLUMN "recipient_email" DROP NOT NULL,
      ALTER COLUMN "subject_length" DROP NOT NULL,
      ALTER COLUMN "text_length" DROP NOT NULL
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "protect_follow_up_mail_identity"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD."outbound_communication_id" IS NOT NULL AND (
          NEW."outbound_communication_id" IS DISTINCT FROM OLD."outbound_communication_id"
          OR NEW."correspondence_id" IS DISTINCT FROM OLD."correspondence_id"
          OR NEW."project_id" IS DISTINCT FROM OLD."project_id"
          OR NEW."draft_version" IS DISTINCT FROM OLD."draft_version"
          OR NEW."referenced_follow_up_id" IS DISTINCT FROM OLD."referenced_follow_up_id"
          OR NEW."referenced_follow_up_version" IS DISTINCT FROM OLD."referenced_follow_up_version"
        ) THEN RAISE EXCEPTION 'Customer follow-up mail identity is immutable' USING ERRCODE = '55000'; END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      UPDATE "customer_follow_up_delivery_attempts"
      SET "recipient_email" = NULL, "subject_length" = NULL, "text_length" = NULL,
          "failure_code" = NULL, "sent_at" = NULL,
          "mail_system_acceptance" = NULL, "message_reference" = NULL
      WHERE "outbound_communication_id" IS NOT NULL
    `);
  }

  async down(): Promise<void> {
    throw new Error(
      'Canonical Customer-mail persistence is forward-only because it preserves retained correspondence history.',
    );
  }
}
