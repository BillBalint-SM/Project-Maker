import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CorrelatedCustomerReplies0020CorrelatedCustomerReplies1787558400000
  implements MigrationInterface
{
  name = 'CorrelatedCustomerReplies0020CorrelatedCustomerReplies1787558400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer_mailbox_change_inbox"
      ADD COLUMN "recipient_addresses" jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD COLUMN "attachment_count" integer NOT NULL DEFAULT 0,
      ADD COLUMN "attachments" jsonb NOT NULL DEFAULT '[]'::jsonb,
      ADD CONSTRAINT "chk_customer_mailbox_change_recipients" CHECK (jsonb_typeof("recipient_addresses") = 'array'),
      ADD CONSTRAINT "chk_customer_mailbox_change_attachments" CHECK (
        "attachment_count" >= 0 AND jsonb_typeof("attachments") = 'array' AND jsonb_array_length("attachments") <= 20
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "customer_inbound_messages" (
        "id" uuid PRIMARY KEY,
        "mailbox_address" varchar(320) NOT NULL REFERENCES "customer_mailbox_sync"("mailbox_address") ON DELETE RESTRICT,
        "provider_message_reference" varchar(500) NOT NULL,
        "internet_message_id" text,
        "correspondence_id" uuid REFERENCES "customer_correspondences"("id") ON DELETE RESTRICT,
        "project_id" uuid REFERENCES "projects"("id") ON DELETE RESTRICT,
        "correlation_state" varchar(20) NOT NULL,
        "correlation_evidence" varchar(40) NOT NULL,
        "sender_address" varchar(320),
        "sender_classification" varchar(30) NOT NULL,
        "recipient_addresses" jsonb NOT NULL,
        "subject" text,
        "text_content" text NOT NULL,
        "visible_text" text NOT NULL,
        "quoted_text" text,
        "received_at" timestamptz NOT NULL,
        "attachment_count" integer NOT NULL,
        "attachments" jsonb NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_customer_inbound_provider_message" UNIQUE ("mailbox_address", "provider_message_reference"),
        CONSTRAINT "chk_customer_inbound_correlation" CHECK (
          ("correlation_state" = 'MATCHED' AND "correspondence_id" IS NOT NULL AND "project_id" IS NOT NULL AND "correlation_evidence" = 'TOKENIZED_REPLY_TO')
          OR ("correlation_state" = 'UNMATCHED' AND "correspondence_id" IS NULL AND "project_id" IS NULL AND "correlation_evidence" = 'NO_VALID_REPLY_TOKEN')
        ),
        CONSTRAINT "chk_customer_inbound_sender" CHECK ("sender_classification" IN ('CUSTOMER_CONTACT', 'UNRECOGNIZED')),
        CONSTRAINT "chk_customer_inbound_recipients" CHECK (jsonb_typeof("recipient_addresses") = 'array'),
        CONSTRAINT "chk_customer_inbound_attachments" CHECK (
          "attachment_count" >= 0 AND jsonb_typeof("attachments") = 'array' AND jsonb_array_length("attachments") <= 20
        )
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_customer_inbound_correspondence_received"
      ON "customer_inbound_messages" ("correspondence_id", "received_at", "provider_message_reference")
      WHERE "correspondence_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE FUNCTION "protect_customer_inbound_message"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Customer inbound messages are append-only' USING ERRCODE = '55000';
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_customer_inbound_message_immutable"
      BEFORE UPDATE OR DELETE ON "customer_inbound_messages"
      FOR EACH ROW EXECUTE FUNCTION "protect_customer_inbound_message"()
    `);
    await queryRunner.query(`
      UPDATE "customer_mailbox_sync"
      SET "delta_checkpoint" = NULL,
          "state" = 'INITIALIZING',
          "failure_code" = NULL,
          "lease_token" = NULL,
          "lease_expires_at" = NULL
      WHERE "baseline_established"
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const retained = await queryRunner.query(
      'SELECT COUNT(*)::text AS "count" FROM "customer_inbound_messages"',
    ) as Array<{ count: string }>;
    if ((retained[0]?.count ?? '0') !== '0') {
      throw new Error('Migration 0020 cannot remove retained Customer inbound messages.');
    }
    await queryRunner.query('DROP TRIGGER "trg_customer_inbound_message_immutable" ON "customer_inbound_messages"');
    await queryRunner.query('DROP FUNCTION "protect_customer_inbound_message"()');
    await queryRunner.query('DROP TABLE "customer_inbound_messages"');
    await queryRunner.query(`
      ALTER TABLE "customer_mailbox_change_inbox"
      DROP CONSTRAINT "chk_customer_mailbox_change_attachments",
      DROP CONSTRAINT "chk_customer_mailbox_change_recipients",
      DROP COLUMN "attachments",
      DROP COLUMN "attachment_count",
      DROP COLUMN "recipient_addresses"
    `);
  }
}
