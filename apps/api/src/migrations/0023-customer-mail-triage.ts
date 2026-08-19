import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerMailTriage0023CustomerMailTriage1787817600000
  implements MigrationInterface
{
  name = 'CustomerMailTriage0023CustomerMailTriage1787817600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE INDEX "idx_customer_inbound_internet_message"
      ON "customer_inbound_messages" ("mailbox_address", "internet_message_id")
      WHERE "internet_message_id" IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE TABLE "customer_mail_triage" (
        "message_id" uuid PRIMARY KEY REFERENCES "customer_inbound_messages"("id") ON DELETE RESTRICT,
        "kind" varchar(40) NOT NULL DEFAULT 'UNMATCHED_CUSTOMER_MESSAGE',
        "state" varchar(20) NOT NULL DEFAULT 'OPEN',
        "version" integer NOT NULL DEFAULT 1 CHECK ("version" > 0),
        "project_id" uuid REFERENCES "projects"("id") ON DELETE RESTRICT,
        "correspondence_id" uuid REFERENCES "customer_correspondences"("id") ON DELETE RESTRICT,
        "resolved_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_customer_mail_triage_state" CHECK ("state" IN ('OPEN', 'LINKED', 'DISMISSED')),
        CONSTRAINT "chk_customer_mail_triage_kind" CHECK (
          "kind" IN ('UNMATCHED_CUSTOMER_MESSAGE', 'UNKNOWN_AUTOMATION')
        ),
        CONSTRAINT "chk_customer_mail_triage_resolution" CHECK (
          ("state" = 'OPEN' AND "project_id" IS NULL AND "correspondence_id" IS NULL AND "resolved_at" IS NULL)
          OR ("state" = 'LINKED' AND "project_id" IS NOT NULL AND "correspondence_id" IS NOT NULL AND "resolved_at" IS NOT NULL)
          OR ("state" = 'DISMISSED' AND "project_id" IS NULL AND "correspondence_id" IS NULL AND "resolved_at" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "customer_mail_system_events" (
        "id" uuid PRIMARY KEY,
        "mailbox_address" varchar(320) NOT NULL,
        "provider_message_reference" varchar(1024) NOT NULL,
        "internet_message_id" varchar(1024),
        "type" varchar(30) NOT NULL CHECK ("type" IN ('DELIVERY_REPORT', 'OUT_OF_OFFICE')),
        "project_id" uuid REFERENCES "projects"("id") ON DELETE RESTRICT,
        "correspondence_id" uuid REFERENCES "customer_correspondences"("id") ON DELETE RESTRICT,
        "occurred_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_customer_mail_system_event_provider"
          UNIQUE ("mailbox_address", "provider_message_reference")
      )
    `);
    await queryRunner.query(`
      INSERT INTO "customer_mail_triage" ("message_id")
      SELECT "id" FROM "customer_inbound_messages" WHERE "correlation_state" = 'UNMATCHED'
    `);
    await queryRunner.query(`
      CREATE TABLE "customer_mail_triage_actions" (
        "id" uuid PRIMARY KEY,
        "message_id" uuid NOT NULL REFERENCES "customer_inbound_messages"("id") ON DELETE RESTRICT,
        "command" varchar(20) NOT NULL CHECK ("command" IN ('LINK', 'DISMISS')),
        "project_id" uuid REFERENCES "projects"("id") ON DELETE RESTRICT,
        "correspondence_id" uuid REFERENCES "customer_correspondences"("id") ON DELETE RESTRICT,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_customer_mail_triage_action_target" CHECK (
          ("command" = 'LINK' AND "project_id" IS NOT NULL AND "correspondence_id" IS NOT NULL)
          OR ("command" = 'DISMISS' AND "project_id" IS NULL AND "correspondence_id" IS NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE FUNCTION "protect_customer_mail_triage_action"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Customer mail triage actions are immutable' USING ERRCODE = '55000';
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_customer_mail_triage_action_immutable"
      BEFORE UPDATE OR DELETE ON "customer_mail_triage_actions"
      FOR EACH ROW EXECUTE FUNCTION "protect_customer_mail_triage_action"()
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const systemEvents = await queryRunner.query(
      'SELECT COUNT(*)::text AS "count" FROM "customer_mail_system_events"',
    ) as Array<{ count: string }>;
    if ((systemEvents[0]?.count ?? '0') !== '0') {
      throw new Error('Migration 0023 cannot remove retained Customer mail-system events.');
    }
    const actions = await queryRunner.query(
      'SELECT COUNT(*)::text AS "count" FROM "customer_mail_triage_actions"',
    ) as Array<{ count: string }>;
    if ((actions[0]?.count ?? '0') !== '0') {
      throw new Error('Migration 0023 cannot remove retained Customer mail triage actions.');
    }
    await queryRunner.query(
      'DROP TRIGGER "trg_customer_mail_triage_action_immutable" ON "customer_mail_triage_actions"',
    );
    await queryRunner.query('DROP FUNCTION "protect_customer_mail_triage_action"()');
    await queryRunner.query('DROP TABLE "customer_mail_triage_actions"');
    await queryRunner.query('DROP TABLE "customer_mail_triage"');
    await queryRunner.query('DROP TABLE "customer_mail_system_events"');
    await queryRunner.query('DROP INDEX "idx_customer_inbound_internet_message"');
  }
}
