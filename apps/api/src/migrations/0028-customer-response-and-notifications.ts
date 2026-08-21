import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerResponseAndNotifications0028CustomerResponseAndNotifications1788249600000
  implements MigrationInterface
{
  name = 'CustomerResponseAndNotifications0028CustomerResponseAndNotifications1788249600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "customer_response_requests" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE RESTRICT,
        "preview_id" uuid NOT NULL UNIQUE,
        "state" varchar(20) NOT NULL CHECK ("state" IN ('OPEN', 'SUBMITTED', 'REVOKED')),
        "delivery_state" varchar(20) NOT NULL CHECK ("delivery_state" IN ('SENDING', 'SENT', 'FAILED', 'UNKNOWN')),
        "token_digest" varchar(64) NOT NULL UNIQUE,
        "recipient_name" varchar(255) NOT NULL,
        "recipient_email" varchar(320) NOT NULL,
        "subject" text NOT NULL,
        "text_content" text NOT NULL,
        "html_content" text NOT NULL,
        "expires_at" timestamptz NOT NULL,
        "revoked_at" timestamptz,
        "outbound_communication_id" uuid UNIQUE REFERENCES "customer_outbound_communications"("id") ON DELETE RESTRICT,
        "correspondence_id" uuid UNIQUE REFERENCES "customer_correspondences"("id") ON DELETE RESTRICT,
        "failure_code" varchar(100),
        "attempted_at" timestamptz,
        "sent_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_customer_response_expiry" CHECK ("expires_at" > "created_at"),
        CONSTRAINT "chk_customer_response_revocation" CHECK (
          ("state" = 'REVOKED' AND "revoked_at" IS NOT NULL) OR
          ("state" <> 'REVOKED' AND "revoked_at" IS NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "customer_response_prompts" (
        "id" uuid PRIMARY KEY,
        "request_id" uuid NOT NULL REFERENCES "customer_response_requests"("id") ON DELETE RESTRICT,
        "display_order" integer NOT NULL CHECK ("display_order" BETWEEN 1 AND 20),
        "source_kind" varchar(30) NOT NULL CHECK ("source_kind" IN ('ROUND_PROMPT', 'DISCOVERY_FOLLOW_UP')),
        "source_id" uuid NOT NULL,
        "source_version" integer,
        "topic" varchar(255) NOT NULL,
        "text" text NOT NULL CHECK (btrim("text") <> ''),
        UNIQUE ("request_id", "display_order"),
        UNIQUE ("request_id", "source_kind", "source_id")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "customer_response_submissions" (
        "id" uuid PRIMARY KEY,
        "request_id" uuid NOT NULL UNIQUE REFERENCES "customer_response_requests"("id") ON DELETE RESTRICT,
        "idempotency_key" uuid NOT NULL UNIQUE,
        "submitted_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "reviewed_at" timestamptz,
        "reviewed_by" uuid REFERENCES "internal_users"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "customer_response_answers" (
        "id" uuid PRIMARY KEY,
        "submission_id" uuid NOT NULL REFERENCES "customer_response_submissions"("id") ON DELETE RESTRICT,
        "prompt_id" uuid NOT NULL REFERENCES "customer_response_prompts"("id") ON DELETE RESTRICT,
        "display_order" integer NOT NULL CHECK ("display_order" BETWEEN 1 AND 20),
        "answer" text NOT NULL CHECK (length(btrim("answer")) BETWEEN 1 AND 10000),
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE ("submission_id", "prompt_id"),
        UNIQUE ("submission_id", "display_order")
      )
    `);
    await queryRunner.query(`
      CREATE FUNCTION "protect_customer_response_snapshot"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Customer response snapshot is immutable' USING ERRCODE = '55000';
      END;
      $$
    `);
    await queryRunner.query('CREATE TRIGGER "trg_customer_response_prompt_immutable" BEFORE UPDATE OR DELETE ON "customer_response_prompts" FOR EACH ROW EXECUTE FUNCTION "protect_customer_response_snapshot"()');
    await queryRunner.query('CREATE TRIGGER "trg_customer_response_answer_immutable" BEFORE UPDATE OR DELETE ON "customer_response_answers" FOR EACH ROW EXECUTE FUNCTION "protect_customer_response_snapshot"()');
    await queryRunner.query(`
      CREATE FUNCTION "protect_customer_response_submission"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE'
          OR NEW."id" IS DISTINCT FROM OLD."id"
          OR NEW."request_id" IS DISTINCT FROM OLD."request_id"
          OR NEW."idempotency_key" IS DISTINCT FROM OLD."idempotency_key"
          OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
          OR OLD."reviewed_at" IS NOT NULL
        THEN
          RAISE EXCEPTION 'Customer response submission is immutable' USING ERRCODE = '55000';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query('CREATE TRIGGER "trg_customer_response_submission_immutable" BEFORE UPDATE OR DELETE ON "customer_response_submissions" FOR EACH ROW EXECUTE FUNCTION "protect_customer_response_submission"()');

    await queryRunner.query('DROP TRIGGER "trg_validate_customer_outbound_source" ON "customer_outbound_communications"');
    await queryRunner.query('DROP FUNCTION "validate_customer_outbound_source"()');
    await queryRunner.query(`
      ALTER TABLE "customer_outbound_communications"
      DROP CONSTRAINT "chk_customer_outbound_source_type",
      ADD CONSTRAINT "chk_customer_outbound_source_type"
        CHECK ("source_type" IN ('INTERVIEW_HANDOFF', 'CUSTOMER_FOLLOW_UP_PING', 'CUSTOMER_RESPONSE_REQUEST'))
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
        ELSIF NEW."source_type" = 'CUSTOMER_RESPONSE_REQUEST' THEN
          IF NOT EXISTS (SELECT 1 FROM "customer_response_requests" WHERE "id" = NEW."source_id" AND "project_id" = NEW."project_id") THEN
            RAISE EXCEPTION 'Customer response request outbound source does not exist' USING ERRCODE = '23503';
          END IF;
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query('CREATE TRIGGER "trg_validate_customer_outbound_source" BEFORE INSERT ON "customer_outbound_communications" FOR EACH ROW EXECUTE FUNCTION "validate_customer_outbound_source"()');
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const retained = await queryRunner.query('SELECT COUNT(*)::text AS "count" FROM "customer_response_requests"') as Array<{ count: string }>;
    if ((retained[0]?.count ?? '0') !== '0') {
      throw new Error('Migration 0028 cannot remove retained Customer responses.');
    }
    await queryRunner.query('DROP TRIGGER "trg_validate_customer_outbound_source" ON "customer_outbound_communications"');
    await queryRunner.query('DROP FUNCTION "validate_customer_outbound_source"()');
    await queryRunner.query(`ALTER TABLE "customer_outbound_communications" DROP CONSTRAINT "chk_customer_outbound_source_type", ADD CONSTRAINT "chk_customer_outbound_source_type" CHECK ("source_type" IN ('INTERVIEW_HANDOFF', 'CUSTOMER_FOLLOW_UP_PING'))`);
    await queryRunner.query(`
      CREATE FUNCTION "validate_customer_outbound_source"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW."source_type" = 'INTERVIEW_HANDOFF' AND NOT EXISTS (SELECT 1 FROM "interview_customer_handoffs" WHERE "id" = NEW."source_id" AND "project_id" = NEW."project_id") THEN
          RAISE EXCEPTION 'Interview handoff outbound source does not exist' USING ERRCODE = '23503';
        ELSIF NEW."source_type" = 'CUSTOMER_FOLLOW_UP_PING' AND NOT EXISTS (SELECT 1 FROM "customer_follow_up_delivery_attempts" WHERE "id" = NEW."source_id" AND "project_id" = NEW."project_id") THEN
          RAISE EXCEPTION 'Customer follow-up outbound source does not exist' USING ERRCODE = '23503';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query('CREATE TRIGGER "trg_validate_customer_outbound_source" BEFORE INSERT ON "customer_outbound_communications" FOR EACH ROW EXECUTE FUNCTION "validate_customer_outbound_source"()');
    await queryRunner.query('DROP TRIGGER "trg_customer_response_submission_immutable" ON "customer_response_submissions"');
    await queryRunner.query('DROP FUNCTION "protect_customer_response_submission"()');
    await queryRunner.query('DROP TRIGGER "trg_customer_response_answer_immutable" ON "customer_response_answers"');
    await queryRunner.query('DROP TRIGGER "trg_customer_response_prompt_immutable" ON "customer_response_prompts"');
    await queryRunner.query('DROP FUNCTION "protect_customer_response_snapshot"()');
    await queryRunner.query('DROP TABLE "customer_response_answers"');
    await queryRunner.query('DROP TABLE "customer_response_submissions"');
    await queryRunner.query('DROP TABLE "customer_response_prompts"');
    await queryRunner.query('DROP TABLE "customer_response_requests"');
  }
}
