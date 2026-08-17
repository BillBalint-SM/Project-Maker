import type { MigrationInterface, QueryRunner } from 'typeorm';

export class M365CustomerFollowUpPing0018M365CustomerFollowUpPing1787385600000
  implements MigrationInterface
{
  name = 'M365CustomerFollowUpPing0018M365CustomerFollowUpPing1787385600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer_follow_ups"
      ADD COLUMN "preview_sender_name" varchar(255),
      ADD COLUMN "preview_sender_address" varchar(320),
      ADD CONSTRAINT "chk_follow_up_preview_sender" CHECK (
        ("preview_sender_name" IS NULL AND "preview_sender_address" IS NULL)
        OR (length(btrim("preview_sender_name")) > 0 AND lower("preview_sender_address") ~ '^[^@[:space:]]+@pte\\.hu$')
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_outbound_communications"
      DROP CONSTRAINT "customer_outbound_communications_source_id_fkey",
      DROP CONSTRAINT "customer_outbound_communications_source_type_check",
      ADD CONSTRAINT "chk_customer_outbound_source_type"
        CHECK ("source_type" IN ('INTERVIEW_HANDOFF', 'CUSTOMER_FOLLOW_UP_PING'))
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_correspondences"
      ADD COLUMN "source_follow_up_id" uuid,
      ADD COLUMN "source_follow_up_version" integer,
      ADD CONSTRAINT "fk_correspondence_follow_up_project"
        FOREIGN KEY ("source_follow_up_id", "project_id")
        REFERENCES "discovery_follow_ups"("id", "project_id") ON DELETE RESTRICT,
      ADD CONSTRAINT "chk_correspondence_follow_up_source" CHECK (
        ("source_follow_up_id" IS NULL AND "source_follow_up_version" IS NULL)
        OR ("source_follow_up_id" IS NOT NULL AND "source_follow_up_version" > 0)
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_follow_up_delivery_attempts"
      ADD COLUMN "outbound_communication_id" uuid REFERENCES "customer_outbound_communications"("id") ON DELETE RESTRICT,
      ADD COLUMN "correspondence_id" uuid REFERENCES "customer_correspondences"("id") ON DELETE RESTRICT,
      ADD COLUMN "mail_system_acceptance" varchar(20),
      ADD COLUMN "message_reference" varchar(500),
      ADD CONSTRAINT "chk_follow_up_mail_acceptance"
        CHECK ("mail_system_acceptance" IS NULL OR "mail_system_acceptance" IN ('ACCEPTED', 'REJECTED')),
      ADD CONSTRAINT "chk_follow_up_mail_identity" CHECK (
        ("outbound_communication_id" IS NULL AND "correspondence_id" IS NULL)
        OR ("outbound_communication_id" IS NOT NULL AND "correspondence_id" IS NOT NULL)
      ),
      ADD CONSTRAINT "uq_follow_up_outbound_communication" UNIQUE ("outbound_communication_id"),
      ADD CONSTRAINT "uq_follow_up_correspondence" UNIQUE ("correspondence_id")
    `);
    await queryRunner.query(`
      CREATE FUNCTION "validate_customer_outbound_source"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."source_type" = 'INTERVIEW_HANDOFF' THEN
          IF NOT EXISTS (SELECT 1 FROM "interview_customer_handoffs" WHERE "id" = NEW."source_id" AND "project_id" = NEW."project_id") THEN
            RAISE EXCEPTION 'Interview handoff outbound source does not exist' USING ERRCODE = '23503';
          END IF;
        ELSIF NEW."source_type" = 'CUSTOMER_FOLLOW_UP_PING' THEN
          IF NOT EXISTS (SELECT 1 FROM "customer_follow_up_delivery_attempts" WHERE "id" = NEW."source_id" AND "project_id" = NEW."project_id") THEN
            RAISE EXCEPTION 'Customer follow-up outbound source does not exist' USING ERRCODE = '23503';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query('CREATE TRIGGER "trg_validate_customer_outbound_source" BEFORE INSERT ON "customer_outbound_communications" FOR EACH ROW EXECUTE FUNCTION "validate_customer_outbound_source"()');
    await queryRunner.query(`
      CREATE FUNCTION "protect_follow_up_mail_identity"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF OLD."outbound_communication_id" IS NOT NULL AND (
          NEW."outbound_communication_id" IS DISTINCT FROM OLD."outbound_communication_id"
          OR NEW."correspondence_id" IS DISTINCT FROM OLD."correspondence_id"
          OR NEW."project_id" IS DISTINCT FROM OLD."project_id"
          OR NEW."draft_version" IS DISTINCT FROM OLD."draft_version"
          OR NEW."referenced_follow_up_id" IS DISTINCT FROM OLD."referenced_follow_up_id"
          OR NEW."referenced_follow_up_version" IS DISTINCT FROM OLD."referenced_follow_up_version"
          OR NEW."recipient_email" IS DISTINCT FROM OLD."recipient_email"
          OR NEW."subject_length" IS DISTINCT FROM OLD."subject_length"
          OR NEW."text_length" IS DISTINCT FROM OLD."text_length"
        ) THEN
          RAISE EXCEPTION 'Customer follow-up mail identity is immutable' USING ERRCODE = '55000';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query('CREATE TRIGGER "trg_follow_up_mail_identity_immutable" BEFORE UPDATE ON "customer_follow_up_delivery_attempts" FOR EACH ROW EXECUTE FUNCTION "protect_follow_up_mail_identity"()');
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "protect_customer_correspondence_anchors"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE'
          OR NEW."id" IS DISTINCT FROM OLD."id"
          OR NEW."project_id" IS DISTINCT FROM OLD."project_id"
          OR NEW."outbound_communication_id" IS DISTINCT FROM OLD."outbound_communication_id"
          OR NEW."predecessor_id" IS DISTINCT FROM OLD."predecessor_id"
          OR NEW."source_follow_up_id" IS DISTINCT FROM OLD."source_follow_up_id"
          OR NEW."source_follow_up_version" IS DISTINCT FROM OLD."source_follow_up_version"
          OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
        THEN
          RAISE EXCEPTION 'Customer correspondence anchors are immutable' USING ERRCODE = '55000';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const rows = await queryRunner.query(`SELECT COUNT(*)::text AS "count" FROM "customer_outbound_communications" WHERE "source_type" = 'CUSTOMER_FOLLOW_UP_PING'`) as Array<{ count: string }>;
    if ((rows[0]?.count ?? '0') !== '0') {
      throw new Error('Migration 0018 cannot remove Customer follow-up correspondence history.');
    }
    await queryRunner.query('DROP TRIGGER "trg_validate_customer_outbound_source" ON "customer_outbound_communications"');
    await queryRunner.query('DROP FUNCTION "validate_customer_outbound_source"()');
    await queryRunner.query('DROP TRIGGER "trg_follow_up_mail_identity_immutable" ON "customer_follow_up_delivery_attempts"');
    await queryRunner.query('DROP FUNCTION "protect_follow_up_mail_identity"()');
    await queryRunner.query(`ALTER TABLE "customer_follow_up_delivery_attempts" DROP CONSTRAINT "chk_follow_up_mail_identity", DROP CONSTRAINT "chk_follow_up_mail_acceptance", DROP COLUMN "message_reference", DROP COLUMN "mail_system_acceptance", DROP COLUMN "correspondence_id", DROP COLUMN "outbound_communication_id"`);
    await queryRunner.query(`ALTER TABLE "customer_correspondences" DROP CONSTRAINT "chk_correspondence_follow_up_source", DROP CONSTRAINT "fk_correspondence_follow_up_project", DROP COLUMN "source_follow_up_version", DROP COLUMN "source_follow_up_id"`);
    await queryRunner.query(`ALTER TABLE "customer_outbound_communications" DROP CONSTRAINT "chk_customer_outbound_source_type", ADD CONSTRAINT "customer_outbound_communications_source_type_check" CHECK ("source_type" = 'INTERVIEW_HANDOFF'), ADD CONSTRAINT "customer_outbound_communications_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "interview_customer_handoffs"("id") ON DELETE RESTRICT`);
    await queryRunner.query(`ALTER TABLE "customer_follow_ups" DROP CONSTRAINT "chk_follow_up_preview_sender", DROP COLUMN "preview_sender_address", DROP COLUMN "preview_sender_name"`);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "protect_customer_correspondence_anchors"() RETURNS trigger LANGUAGE plpgsql AS $$
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
  }
}
