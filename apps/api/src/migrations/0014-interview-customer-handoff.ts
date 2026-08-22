import type { MigrationInterface, QueryRunner } from 'typeorm';

export class InterviewCustomerHandoff0014InterviewCustomerHandoff1787039999000
  implements MigrationInterface
{
  name = 'InterviewCustomerHandoff0014InterviewCustomerHandoff1787039999000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN "internal_owner_name" varchar(255),
      ADD COLUMN "next_action_owner_role" varchar(30),
      ADD CONSTRAINT "chk_projects_next_action_owner_role"
        CHECK ("next_action_owner_role" IS NULL OR "next_action_owner_role" IN ('INTERNAL_OWNER', 'CUSTOMER_CONTACT'))
    `);
    await queryRunner.query(`
      UPDATE "projects"
      SET "internal_owner_name" = "ball_owner",
          "next_action_owner_role" = 'INTERNAL_OWNER'
      WHERE "ball_owner" IS NOT NULL AND btrim("ball_owner") <> ''
    `);

    await queryRunner.query(
      'ALTER TABLE "interview_rounds" DROP CONSTRAINT "chk_interview_rounds_completion"',
    );
    await queryRunner.query('DROP INDEX "uq_interview_rounds_open_initial_intake"');
    await queryRunner.query(
      'ALTER TABLE "interview_rounds" DISABLE TRIGGER "trg_interview_rounds_protect_change"',
    );
    await queryRunner.query('ALTER TABLE "interview_rounds" ALTER COLUMN "status" DROP DEFAULT');
    await queryRunner.query(
      'ALTER TABLE "interview_rounds" ALTER COLUMN "status" TYPE text USING "status"::text',
    );
    await queryRunner.query(
      'UPDATE "interview_rounds" SET "status" = \'ENDED\' WHERE "status" = \'COMPLETED\'',
    );
    await queryRunner.query('DROP TYPE "interview_round_status"');
    await queryRunner.query(`CREATE TYPE "interview_round_status" AS ENUM ('OPEN', 'ENDED')`);
    await queryRunner.query(`
      ALTER TABLE "interview_rounds"
      ALTER COLUMN "status" TYPE "interview_round_status" USING "status"::"interview_round_status",
      ALTER COLUMN "status" SET DEFAULT 'OPEN',
      ADD COLUMN "content_version" integer NOT NULL DEFAULT 1,
      ADD CONSTRAINT "chk_interview_rounds_content_version" CHECK ("content_version" > 0),
      ADD CONSTRAINT "chk_interview_rounds_completion" CHECK (
        ("status" = 'OPEN' AND "completed_at" IS NULL)
        OR ("status" = 'ENDED' AND "completed_at" IS NOT NULL)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_interview_rounds_open_initial_intake"
      ON "interview_rounds" ("project_id")
      WHERE "status" = 'OPEN' AND "type" = 'INITIAL_INTAKE'
    `);

    await queryRunner.query(`
      CREATE TYPE "interview_handoff_state" AS ENUM (
        'DRAFT', 'SENDING', 'SENT', 'FAILED', 'UNKNOWN'
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "interview_customer_handoffs" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL,
        "round_id" uuid NOT NULL,
        "version" integer NOT NULL,
        "supersedes_handoff_id" uuid,
        "state" "interview_handoff_state" NOT NULL DEFAULT 'DRAFT',
        "modification_summary" text,
        "recipient_name" varchar(255),
        "recipient_email" varchar(320),
        "internal_owner_name" varchar(255),
        "subject" text,
        "html_content" text,
        "text_content" text,
        "preview_digest" varchar(64),
        "source_content_version" integer,
        "failure_code" varchar(100),
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "attempted_at" timestamptz,
        "sent_at" timestamptz,
        CONSTRAINT "uq_interview_customer_handoffs_round_version" UNIQUE ("round_id", "version"),
        CONSTRAINT "chk_interview_customer_handoffs_version" CHECK ("version" > 0),
        CONSTRAINT "chk_interview_customer_handoffs_summary" CHECK (
          "version" = 1 OR "state" = 'DRAFT'
          OR ("modification_summary" IS NOT NULL AND btrim("modification_summary") <> '' AND char_length("modification_summary") <= 10000)
        ),
        CONSTRAINT "chk_interview_customer_handoffs_sent_at" CHECK (
          ("state" = 'SENT' AND "sent_at" IS NOT NULL)
          OR ("state" <> 'SENT' AND "sent_at" IS NULL)
        ),
        CONSTRAINT "fk_interview_customer_handoffs_project"
          FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_interview_customer_handoffs_round"
          FOREIGN KEY ("round_id") REFERENCES "interview_rounds"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_interview_customer_handoffs_supersedes"
          FOREIGN KEY ("supersedes_handoff_id") REFERENCES "interview_customer_handoffs"("id") ON DELETE RESTRICT
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_interview_customer_handoffs_active_round"
      ON "interview_customer_handoffs" ("round_id")
      WHERE "state" <> 'SENT'
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_interview_customer_handoffs_project_round_version"
      ON "interview_customer_handoffs" ("project_id", "round_id", "version" DESC)
    `);
    await queryRunner.query(`
      CREATE FUNCTION "protect_interview_customer_handoff_change"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Interview handoff history cannot be deleted' USING ERRCODE = '55000';
        END IF;
        IF NEW."id" IS DISTINCT FROM OLD."id"
          OR NEW."project_id" IS DISTINCT FROM OLD."project_id"
          OR NEW."round_id" IS DISTINCT FROM OLD."round_id"
          OR NEW."version" IS DISTINCT FROM OLD."version"
          OR NEW."supersedes_handoff_id" IS DISTINCT FROM OLD."supersedes_handoff_id"
          OR NEW."created_at" IS DISTINCT FROM OLD."created_at" THEN
          RAISE EXCEPTION 'Interview handoff identity is immutable' USING ERRCODE = '55000';
        END IF;
        IF OLD."state" = 'SENT' THEN
          RAISE EXCEPTION 'Sent interview handoff snapshots are immutable' USING ERRCODE = '55000';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_interview_customer_handoffs_protect_change"
      BEFORE UPDATE OR DELETE ON "interview_customer_handoffs"
      FOR EACH ROW
      EXECUTE FUNCTION "protect_interview_customer_handoff_change"()
    `);

    await queryRunner.query(`
      CREATE FUNCTION "interview_round_is_editable"(target_round_id uuid)
      RETURNS boolean
      LANGUAGE sql
      STABLE
      AS $$
        SELECT COALESCE((
          SELECT round."status" = 'OPEN'
            OR (
              round."status" = 'ENDED'
              AND (
                NOT EXISTS (
                  SELECT 1 FROM "interview_customer_handoffs" handoff
                  WHERE handoff."round_id" = round."id"
                )
                OR EXISTS (
                  SELECT 1 FROM "interview_customer_handoffs" handoff
                  WHERE handoff."round_id" = round."id" AND handoff."state" = 'DRAFT'
                )
              )
            )
          FROM "interview_rounds" round
          WHERE round."id" = target_round_id
        ), false)
      $$
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "protect_round_answer_change"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE affected_round_id uuid;
      BEGIN
        IF TG_OP = 'DELETE' THEN
          affected_round_id = OLD."round_id";
        ELSE
          affected_round_id = NEW."round_id";
        END IF;

        IF TG_OP = 'UPDATE' AND (
          NEW."id" IS DISTINCT FROM OLD."id"
          OR NEW."round_id" IS DISTINCT FROM OLD."round_id"
          OR NEW."snapshot_id" IS DISTINCT FROM OLD."snapshot_id"
        ) THEN
          RAISE EXCEPTION 'Round answer identity is immutable' USING ERRCODE = '55000';
        END IF;

        PERFORM 1 FROM "interview_rounds"
        WHERE "id" = affected_round_id
        FOR UPDATE;
        IF NOT "interview_round_is_editable"(affected_round_id) THEN
          RAISE EXCEPTION 'Answers require an open meeting or active interview revision draft'
            USING ERRCODE = '55000';
        END IF;

        IF TG_OP = 'DELETE' AND EXISTS (
          SELECT 1
          FROM "round_question_assessment_overrides" assessment
          WHERE assessment."round_id" = OLD."round_id"
            AND assessment."snapshot_id" = OLD."snapshot_id"
            AND assessment."status" = 'Részben megvan'
        ) THEN
          RAISE EXCEPTION 'Partial assessment requires a valid answer'
            USING ERRCODE = '23514';
        END IF;

        IF TG_OP = 'UPDATE' AND EXISTS (
          SELECT 1
          FROM "round_question_assessment_overrides" assessment
          WHERE assessment."round_id" = OLD."round_id"
            AND assessment."snapshot_id" = OLD."snapshot_id"
            AND assessment."status" = 'Részben megvan'
        ) AND NOT EXISTS (
          SELECT 1
          FROM "round_question_snapshots" snapshot
          WHERE snapshot."round_id" = NEW."round_id"
            AND snapshot."id" = NEW."snapshot_id"
            AND "is_valid_round_answer"(snapshot."type", snapshot."options", NEW."value")
            AND NOT (
              snapshot."type" IN ('TEXT', 'LONG_TEXT')
              AND (NEW."value" #>> '{}') ~ '^[[:space:]]*$'
            )
        ) THEN
          RAISE EXCEPTION 'Partial assessment requires a valid answer'
            USING ERRCODE = '23514';
        END IF;

        UPDATE "interview_rounds"
        SET "content_version" = "content_version" + 1
        WHERE "id" = affected_round_id;

        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;
        RETURN NEW;
      END;
      $$
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "protect_round_question_assessment_override_change"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE affected_round_id uuid;
      BEGIN
        IF TG_OP = 'DELETE' THEN
          affected_round_id = OLD."round_id";
        ELSE
          affected_round_id = NEW."round_id";
        END IF;

        IF TG_OP = 'UPDATE' AND (
          NEW."id" IS DISTINCT FROM OLD."id"
          OR NEW."round_id" IS DISTINCT FROM OLD."round_id"
          OR NEW."snapshot_id" IS DISTINCT FROM OLD."snapshot_id"
          OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
        ) THEN
          RAISE EXCEPTION 'Round question assessment override identity is immutable'
            USING ERRCODE = '55000';
        END IF;

        IF TG_OP <> 'DELETE' AND NEW."status" = 'Részben megvan' THEN
          PERFORM answer."id"
          FROM "round_question_snapshots" snapshot
          JOIN "round_answers" answer
            ON answer."round_id" = snapshot."round_id"
            AND answer."snapshot_id" = snapshot."id"
          WHERE snapshot."round_id" = NEW."round_id"
            AND snapshot."id" = NEW."snapshot_id"
            AND "is_valid_round_answer"(snapshot."type", snapshot."options", answer."value")
            AND NOT (
              snapshot."type" IN ('TEXT', 'LONG_TEXT')
              AND (answer."value" #>> '{}') ~ '^[[:space:]]*$'
            )
          FOR NO KEY UPDATE OF answer;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Partial assessment requires a valid answer'
              USING ERRCODE = '23514';
          END IF;
        END IF;

        PERFORM 1 FROM "interview_rounds"
        WHERE "id" = affected_round_id
        FOR UPDATE;
        IF NOT "interview_round_is_editable"(affected_round_id) THEN
          RAISE EXCEPTION 'Assessments require an open meeting or active interview revision draft'
            USING ERRCODE = '55000';
        END IF;

        UPDATE "interview_rounds"
        SET "content_version" = "content_version" + 1
        WHERE "id" = affected_round_id;

        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;
        RETURN NEW;
      END;
      $$
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "protect_interview_round_change"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          IF NEW."status" <> 'OPEN' OR NEW."completed_at" IS NOT NULL OR NEW."content_version" <> 1 THEN
            RAISE EXCEPTION 'Interview rounds must be created OPEN at content version 1'
              USING ERRCODE = '23514';
          END IF;
          RETURN NEW;
        END IF;

        IF TG_OP = 'DELETE' THEN
          IF OLD."status" = 'ENDED' THEN
            RAISE EXCEPTION 'Ended interview rounds are historical records' USING ERRCODE = '55000';
          END IF;
          RETURN OLD;
        END IF;

        IF NEW."id" IS DISTINCT FROM OLD."id"
          OR NEW."project_id" IS DISTINCT FROM OLD."project_id"
          OR NEW."project_schema_id" IS DISTINCT FROM OLD."project_schema_id"
          OR NEW."type" IS DISTINCT FROM OLD."type"
          OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
          OR NEW."source" IS DISTINCT FROM OLD."source" THEN
          RAISE EXCEPTION 'Interview round identity is immutable' USING ERRCODE = '55000';
        END IF;

        IF NEW."content_version" < OLD."content_version"
          OR NEW."content_version" > OLD."content_version" + 1 THEN
          RAISE EXCEPTION 'Interview round content version transition is invalid' USING ERRCODE = '23514';
        END IF;

        IF OLD."status" = 'OPEN' AND NEW."status" = 'ENDED' THEN
          IF NEW."completed_at" IS NULL THEN
            RAISE EXCEPTION 'Ended interview rounds require completed_at' USING ERRCODE = '23514';
          END IF;
        ELSIF OLD."status" = 'OPEN' AND NEW."status" = 'OPEN' THEN
          IF NEW."completed_at" IS NOT NULL THEN
            RAISE EXCEPTION 'Open interview rounds cannot have completed_at' USING ERRCODE = '23514';
          END IF;
        ELSIF OLD."status" = 'ENDED' AND NEW."status" = 'ENDED' THEN
          IF NEW."completed_at" IS DISTINCT FROM OLD."completed_at" THEN
            RAISE EXCEPTION 'Ended interview timestamp is immutable' USING ERRCODE = '55000';
          END IF;
        ELSE
          RAISE EXCEPTION 'Interview round status transition is invalid' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(
      'ALTER TABLE "interview_rounds" ENABLE TRIGGER "trg_interview_rounds_protect_change"',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('LOCK TABLE "interview_customer_handoffs" IN ACCESS EXCLUSIVE MODE');
    await queryRunner.query('LOCK TABLE "interview_rounds" IN ACCESS EXCLUSIVE MODE');
    const rows = (await queryRunner.query(`
      SELECT
        (SELECT COUNT(*)::text FROM "interview_customer_handoffs") AS "handoffCount",
        (SELECT COUNT(*)::text FROM "interview_rounds" WHERE "status" = 'ENDED') AS "endedCount"
    `)) as Array<{ handoffCount: string; endedCount: string }>;
    const handoffCount = rows[0]?.handoffCount ?? '0';
    const endedCount = rows[0]?.endedCount ?? '0';
    if (handoffCount !== '0' || endedCount !== '0') {
      throw new Error(
        `Migration 0014 cannot remove ended interview or customer handoff history (ended=${endedCount}, handoffs=${handoffCount}).`,
      );
    }

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "protect_round_answer_change"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE round_id uuid;
      BEGIN
        IF TG_OP = 'DELETE' THEN round_id = OLD."round_id"; ELSE round_id = NEW."round_id"; END IF;
        IF TG_OP = 'UPDATE' AND (
          NEW."id" IS DISTINCT FROM OLD."id"
          OR NEW."round_id" IS DISTINCT FROM OLD."round_id"
          OR NEW."snapshot_id" IS DISTINCT FROM OLD."snapshot_id"
        ) THEN
          RAISE EXCEPTION 'Round answer identity is immutable' USING ERRCODE = '55000';
        END IF;
        PERFORM 1 FROM "interview_rounds" WHERE "id" = round_id FOR UPDATE;
        IF EXISTS (
          SELECT 1 FROM "interview_rounds"
          WHERE "id" = round_id AND "status"::text = 'COMPLETED'
        ) THEN
          RAISE EXCEPTION 'Answers for completed interview rounds are immutable' USING ERRCODE = '55000';
        END IF;
        IF TG_OP = 'DELETE' AND EXISTS (
          SELECT 1 FROM "round_question_assessment_overrides" assessment
          WHERE assessment."round_id" = OLD."round_id"
            AND assessment."snapshot_id" = OLD."snapshot_id"
            AND assessment."status" = 'Részben megvan'
        ) THEN
          RAISE EXCEPTION 'Partial assessment requires a valid answer' USING ERRCODE = '23514';
        END IF;
        IF TG_OP = 'UPDATE' AND EXISTS (
          SELECT 1 FROM "round_question_assessment_overrides" assessment
          WHERE assessment."round_id" = OLD."round_id"
            AND assessment."snapshot_id" = OLD."snapshot_id"
            AND assessment."status" = 'Részben megvan'
        ) AND NOT EXISTS (
          SELECT 1 FROM "round_question_snapshots" snapshot
          WHERE snapshot."round_id" = NEW."round_id"
            AND snapshot."id" = NEW."snapshot_id"
            AND "is_valid_round_answer"(snapshot."type", snapshot."options", NEW."value")
        ) THEN
          RAISE EXCEPTION 'Partial assessment requires a valid answer' USING ERRCODE = '23514';
        END IF;
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "protect_round_question_assessment_override_change"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE affected_round_id uuid;
      BEGIN
        IF TG_OP = 'DELETE' THEN affected_round_id = OLD."round_id"; ELSE affected_round_id = NEW."round_id"; END IF;
        IF TG_OP = 'UPDATE' AND (
          NEW."id" IS DISTINCT FROM OLD."id"
          OR NEW."round_id" IS DISTINCT FROM OLD."round_id"
          OR NEW."snapshot_id" IS DISTINCT FROM OLD."snapshot_id"
          OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
        ) THEN
          RAISE EXCEPTION 'Round question assessment override identity is immutable' USING ERRCODE = '55000';
        END IF;
        IF TG_OP <> 'DELETE' AND NEW."status" = 'Részben megvan' THEN
          PERFORM answer."id"
          FROM "round_question_snapshots" snapshot
          JOIN "round_answers" answer
            ON answer."round_id" = snapshot."round_id" AND answer."snapshot_id" = snapshot."id"
          WHERE snapshot."round_id" = NEW."round_id"
            AND snapshot."id" = NEW."snapshot_id"
            AND "is_valid_round_answer"(snapshot."type", snapshot."options", answer."value")
          FOR NO KEY UPDATE OF answer;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Partial assessment requires a valid answer' USING ERRCODE = '23514';
          END IF;
        END IF;
        PERFORM 1 FROM "interview_rounds" WHERE "id" = affected_round_id FOR UPDATE;
        IF EXISTS (
          SELECT 1 FROM "interview_rounds"
          WHERE "id" = affected_round_id AND "status"::text = 'COMPLETED'
        ) THEN
          RAISE EXCEPTION 'Assessment overrides for completed interview rounds are immutable'
            USING ERRCODE = '55000';
        END IF;
        IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "protect_interview_round_change"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          IF NEW."status"::text <> 'OPEN' OR NEW."completed_at" IS NOT NULL THEN
            RAISE EXCEPTION 'Interview rounds must be created OPEN before completion' USING ERRCODE = '23514';
          END IF;
          RETURN NEW;
        END IF;
        IF TG_OP = 'DELETE' THEN
          IF OLD."status"::text = 'COMPLETED' THEN
            RAISE EXCEPTION 'Completed interview rounds are immutable' USING ERRCODE = '55000';
          END IF;
          RETURN OLD;
        END IF;
        IF OLD."status"::text = 'COMPLETED' THEN
          RAISE EXCEPTION 'Completed interview rounds are immutable' USING ERRCODE = '55000';
        END IF;
        IF NEW."id" IS DISTINCT FROM OLD."id"
          OR NEW."project_id" IS DISTINCT FROM OLD."project_id"
          OR NEW."project_schema_id" IS DISTINCT FROM OLD."project_schema_id"
          OR NEW."type" IS DISTINCT FROM OLD."type"
          OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
          OR NEW."source" IS DISTINCT FROM OLD."source" THEN
          RAISE EXCEPTION 'Interview round identity is immutable' USING ERRCODE = '55000';
        END IF;
        IF NEW."status"::text = 'COMPLETED' THEN
          IF NEW."completed_at" IS NULL THEN
            RAISE EXCEPTION 'Completed interview rounds require completed_at' USING ERRCODE = '23514';
          END IF;
          IF EXISTS (
            SELECT 1
            FROM "round_question_snapshots" snapshot
            LEFT JOIN "round_answers" answer
              ON answer."round_id" = snapshot."round_id" AND answer."snapshot_id" = snapshot."id"
            LEFT JOIN "round_question_assessment_overrides" assessment
              ON assessment."round_id" = snapshot."round_id" AND assessment."snapshot_id" = snapshot."id"
            WHERE snapshot."round_id" = OLD."id"
              AND snapshot."required"
              AND (
                assessment."status" = 'Részben megvan'
                OR (
                  assessment."status" IS DISTINCT FROM 'Nem releváns'
                  AND (
                    answer."id" IS NULL
                    OR NOT "is_valid_round_answer"(snapshot."type", snapshot."options", answer."value")
                  )
                )
              )
          ) THEN
            RAISE EXCEPTION 'Interview round cannot be completed before required answers or justified not-relevant assessments are present'
              USING ERRCODE = '23514';
          END IF;
        ELSIF NEW."status"::text <> 'OPEN' OR NEW."completed_at" IS NOT NULL THEN
          RAISE EXCEPTION 'Interview round status transition is invalid' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $$
    `);

    await queryRunner.query('DROP FUNCTION "interview_round_is_editable"(uuid)');
    await queryRunner.query('DROP TRIGGER "trg_interview_customer_handoffs_protect_change" ON "interview_customer_handoffs"');
    await queryRunner.query('DROP FUNCTION "protect_interview_customer_handoff_change"()');
    await queryRunner.query('DROP TABLE "interview_customer_handoffs"');
    await queryRunner.query('DROP TYPE "interview_handoff_state"');

    await queryRunner.query('ALTER TABLE "interview_rounds" DROP CONSTRAINT "chk_interview_rounds_completion"');
    await queryRunner.query('ALTER TABLE "interview_rounds" DROP CONSTRAINT "chk_interview_rounds_content_version"');
    await queryRunner.query('DROP INDEX "uq_interview_rounds_open_initial_intake"');
    await queryRunner.query('ALTER TABLE "interview_rounds" ALTER COLUMN "status" DROP DEFAULT');
    await queryRunner.query(
      'ALTER TABLE "interview_rounds" ALTER COLUMN "status" TYPE text USING "status"::text',
    );
    await queryRunner.query('DROP TYPE "interview_round_status"');
    await queryRunner.query(`CREATE TYPE "interview_round_status" AS ENUM ('OPEN', 'COMPLETED')`);
    await queryRunner.query(`
      ALTER TABLE "interview_rounds"
      ALTER COLUMN "status" TYPE "interview_round_status" USING "status"::"interview_round_status",
      ALTER COLUMN "status" SET DEFAULT 'OPEN',
      DROP COLUMN "content_version",
      ADD CONSTRAINT "chk_interview_rounds_completion" CHECK (
        ("status" = 'OPEN' AND "completed_at" IS NULL)
        OR ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_interview_rounds_open_initial_intake"
      ON "interview_rounds" ("project_id")
      WHERE "status" = 'OPEN' AND "type" = 'INITIAL_INTAKE'
    `);

    await queryRunner.query(
      'ALTER TABLE "projects" DROP CONSTRAINT "chk_projects_next_action_owner_role"',
    );
    await queryRunner.query(`
      ALTER TABLE "projects"
      DROP COLUMN "next_action_owner_role",
      DROP COLUMN "internal_owner_name"
    `);
  }
}
