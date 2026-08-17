import type { MigrationInterface, QueryRunner } from 'typeorm';

export class M365InterviewHandoff0017M365InterviewHandoff1787299200000 implements MigrationInterface {
  name = 'M365InterviewHandoff0017M365InterviewHandoff1787299200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN "last_customer_sender_name" varchar(255),
      ADD COLUMN "last_customer_sender_address" varchar(320)
    `);
    await queryRunner.query(`
      CREATE TABLE "customer_outbound_communications" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE RESTRICT,
        "source_type" varchar(40) NOT NULL CHECK ("source_type" = 'INTERVIEW_HANDOFF'),
        "source_id" uuid NOT NULL UNIQUE REFERENCES "interview_customer_handoffs"("id") ON DELETE RESTRICT,
        "sender_name" varchar(255) NOT NULL CHECK (btrim("sender_name") <> ''),
        "sender_address" varchar(320) NOT NULL CHECK (lower("sender_address") ~ '^[^@[:space:]]+@pte\\.hu$'),
        "recipient_name" varchar(255) NOT NULL,
        "recipient_address" varchar(320) NOT NULL,
        "subject" text NOT NULL,
        "html_content" text NOT NULL,
        "text_content" text NOT NULL,
        "source_content_version" integer NOT NULL CHECK ("source_content_version" > 0),
        "preview_digest" varchar(64) NOT NULL,
        "reply_to_address" varchar(320) NOT NULL,
        "reply_token_hash" varchar(64) NOT NULL UNIQUE,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "customer_correspondences" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE RESTRICT,
        "outbound_communication_id" uuid NOT NULL UNIQUE REFERENCES "customer_outbound_communications"("id") ON DELETE RESTRICT,
        "predecessor_id" uuid REFERENCES "customer_correspondences"("id") ON DELETE RESTRICT,
        "status" varchar(40) NOT NULL DEFAULT 'Válaszra vár',
        "unread_message_count" integer NOT NULL DEFAULT 0 CHECK ("unread_message_count" >= 0),
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_customer_correspondence_status" CHECK ("status" IN ('Válaszra vár', 'Új válasz', 'Feldolgozás alatt', 'Lezárva'))
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "customer_outbound_attempts" (
        "id" uuid PRIMARY KEY,
        "outbound_communication_id" uuid NOT NULL REFERENCES "customer_outbound_communications"("id") ON DELETE RESTRICT,
        "result" varchar(20) NOT NULL CHECK ("result" IN ('ACCEPTED', 'REJECTED', 'UNKNOWN')),
        "failure_code" varchar(100),
        "message_reference" varchar(500),
        "attempted_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "interview_customer_handoffs"
      ADD COLUMN "sender_name" varchar(255),
      ADD COLUMN "sender_address" varchar(320),
      ADD COLUMN "reply_to_address" varchar(320),
      ADD COLUMN "reply_token_hash" varchar(64),
      ADD COLUMN "mail_system_acceptance" varchar(20),
      ADD COLUMN "message_reference" varchar(500),
      ADD COLUMN "correspondence_id" uuid REFERENCES "customer_correspondences"("id") ON DELETE RESTRICT,
      ADD COLUMN "outbound_communication_id" uuid UNIQUE REFERENCES "customer_outbound_communications"("id") ON DELETE RESTRICT,
      ADD CONSTRAINT "chk_handoff_sender_snapshot" CHECK (
        ("sender_name" IS NULL AND "sender_address" IS NULL)
        OR (length(btrim("sender_name")) > 0 AND lower("sender_address") ~ '^[^@[:space:]]+@pte\\.hu$')
      ),
      ADD CONSTRAINT "chk_handoff_mail_acceptance" CHECK ("mail_system_acceptance" IS NULL OR "mail_system_acceptance" IN ('ACCEPTED', 'REJECTED'))
    `);
    await queryRunner.query('CREATE UNIQUE INDEX "uq_handoff_reply_token_hash" ON "interview_customer_handoffs" ("reply_token_hash") WHERE "reply_token_hash" IS NOT NULL');
    await queryRunner.query(`
      CREATE FUNCTION "protect_customer_mail_history"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Customer mail history is immutable' USING ERRCODE = '55000';
      END;
      $$
    `);
    await queryRunner.query('CREATE TRIGGER "trg_customer_outbound_immutable" BEFORE UPDATE OR DELETE ON "customer_outbound_communications" FOR EACH ROW EXECUTE FUNCTION "protect_customer_mail_history"()');
    await queryRunner.query('CREATE TRIGGER "trg_customer_outbound_attempt_immutable" BEFORE UPDATE OR DELETE ON "customer_outbound_attempts" FOR EACH ROW EXECUTE FUNCTION "protect_customer_mail_history"()');
    await queryRunner.query(`
      CREATE FUNCTION "protect_customer_correspondence_anchors"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE'
          OR NEW."id" IS DISTINCT FROM OLD."id"
          OR NEW."project_id" IS DISTINCT FROM OLD."project_id"
          OR NEW."outbound_communication_id" IS DISTINCT FROM OLD."outbound_communication_id"
          OR NEW."predecessor_id" IS DISTINCT FROM OLD."predecessor_id"
          OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
        THEN
          RAISE EXCEPTION 'Customer correspondence anchors are immutable' USING ERRCODE = '55000';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query('CREATE TRIGGER "trg_customer_correspondence_anchors_immutable" BEFORE UPDATE OR DELETE ON "customer_correspondences" FOR EACH ROW EXECUTE FUNCTION "protect_customer_correspondence_anchors"()');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query('SELECT COUNT(*)::text AS "count" FROM "customer_outbound_communications"') as Array<{ count: string }>;
    if ((rows[0]?.count ?? '0') !== '0') throw new Error('Migration 0017 cannot remove customer correspondence history.');
    await queryRunner.query('DROP INDEX "uq_handoff_reply_token_hash"');
    await queryRunner.query(`ALTER TABLE "interview_customer_handoffs" DROP COLUMN "outbound_communication_id", DROP COLUMN "correspondence_id", DROP COLUMN "message_reference", DROP COLUMN "mail_system_acceptance", DROP COLUMN "reply_token_hash", DROP COLUMN "reply_to_address", DROP COLUMN "sender_address", DROP COLUMN "sender_name"`);
    await queryRunner.query('DROP TABLE "customer_outbound_attempts"');
    await queryRunner.query('DROP TABLE "customer_correspondences"');
    await queryRunner.query('DROP TABLE "customer_outbound_communications"');
    await queryRunner.query('DROP FUNCTION "protect_customer_correspondence_anchors"()');
    await queryRunner.query('DROP FUNCTION "protect_customer_mail_history"()');
    await queryRunner.query('ALTER TABLE "projects" DROP COLUMN "last_customer_sender_address", DROP COLUMN "last_customer_sender_name"');
  }
}
