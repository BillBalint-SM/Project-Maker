import type { MigrationInterface, QueryRunner } from 'typeorm';

interface AssessmentOverrideCountRow {
  readonly overrideCount: string;
}

export class RoundQuestionAssessmentOverrides0009RoundQuestionAssessmentOverrides1786608000000
  implements MigrationInterface
{
  name = 'RoundQuestionAssessmentOverrides0009RoundQuestionAssessmentOverrides1786608000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "round_question_assessment_overrides" (
        "id" uuid PRIMARY KEY,
        "round_id" uuid NOT NULL,
        "snapshot_id" uuid NOT NULL,
        "status" varchar(100) NOT NULL,
        "rationale" text,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_round_question_assessment_overrides_round_snapshot"
          UNIQUE ("round_id", "snapshot_id"),
        CONSTRAINT "chk_round_question_assessment_overrides_state" CHECK (
          (
            "status" = 'Részben megvan'
            AND "rationale" IS NULL
          )
          OR (
            "status" = 'Nem releváns'
            AND "rationale" IS NOT NULL
            AND btrim("rationale") <> ''
            AND char_length("rationale") <= 10000
          )
        ),
        CONSTRAINT "fk_round_question_assessment_overrides_round_snapshot"
          FOREIGN KEY ("round_id", "snapshot_id")
          REFERENCES "round_question_snapshots"("round_id", "id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE FUNCTION "set_round_question_assessment_overrides_updated_at"()
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
      CREATE TRIGGER "trg_round_question_assessment_overrides_updated_at"
      BEFORE UPDATE ON "round_question_assessment_overrides"
      FOR EACH ROW
      EXECUTE FUNCTION "set_round_question_assessment_overrides_updated_at"()
    `);

    await queryRunner.query(`
      CREATE FUNCTION "protect_round_question_assessment_override_change"()
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
          FOR KEY SHARE OF answer;
          IF NOT FOUND THEN
            RAISE EXCEPTION 'Partial assessment requires a valid answer'
              USING ERRCODE = '23514';
          END IF;
        END IF;

        PERFORM 1
        FROM "interview_rounds"
        WHERE "id" = affected_round_id
        FOR UPDATE;
        IF EXISTS (
          SELECT 1
          FROM "interview_rounds"
          WHERE "id" = affected_round_id
            AND "status" = 'COMPLETED'
        ) THEN
          RAISE EXCEPTION 'Assessment overrides for completed interview rounds are immutable'
            USING ERRCODE = '55000';
        END IF;

        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_round_question_assessment_overrides_protect_change"
      BEFORE INSERT OR UPDATE OR DELETE ON "round_question_assessment_overrides"
      FOR EACH ROW
      EXECUTE FUNCTION "protect_round_question_assessment_override_change"()
    `);

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "protect_round_answer_change"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE round_id uuid;
      BEGIN
        IF TG_OP = 'DELETE' THEN
          round_id = OLD."round_id";
        ELSE
          round_id = NEW."round_id";
        END IF;

        IF TG_OP = 'UPDATE' THEN
          IF NEW."id" IS DISTINCT FROM OLD."id"
            OR NEW."round_id" IS DISTINCT FROM OLD."round_id"
            OR NEW."snapshot_id" IS DISTINCT FROM OLD."snapshot_id" THEN
            RAISE EXCEPTION 'Round answer identity is immutable' USING ERRCODE = '55000';
          END IF;
        END IF;

        PERFORM 1
        FROM "interview_rounds"
        WHERE "id" = round_id
        FOR UPDATE;
        IF EXISTS (
          SELECT 1 FROM "interview_rounds"
          WHERE "id" = round_id AND "status" = 'COMPLETED'
        ) THEN
          RAISE EXCEPTION 'Answers for completed interview rounds are immutable' USING ERRCODE = '55000';
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
        ) THEN
          RAISE EXCEPTION 'Partial assessment requires a valid answer'
            USING ERRCODE = '23514';
        END IF;

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
          IF NEW."status" <> 'OPEN' OR NEW."completed_at" IS NOT NULL THEN
            RAISE EXCEPTION 'Interview rounds must be created OPEN before completion' USING ERRCODE = '23514';
          END IF;
          RETURN NEW;
        END IF;
        IF TG_OP = 'DELETE' THEN
          IF OLD."status" = 'COMPLETED' THEN
            RAISE EXCEPTION 'Completed interview rounds are immutable' USING ERRCODE = '55000';
          END IF;
          RETURN OLD;
        END IF;

        IF OLD."status" = 'COMPLETED' THEN
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

        IF NEW."status" = 'COMPLETED' THEN
          IF NEW."completed_at" IS NULL THEN
            RAISE EXCEPTION 'Completed interview rounds require completed_at' USING ERRCODE = '23514';
          END IF;
          IF EXISTS (
            SELECT 1
            FROM "round_question_snapshots" snapshot
            LEFT JOIN "round_answers" answer
              ON answer."round_id" = snapshot."round_id"
              AND answer."snapshot_id" = snapshot."id"
            LEFT JOIN "round_question_assessment_overrides" assessment
              ON assessment."round_id" = snapshot."round_id"
              AND assessment."snapshot_id" = snapshot."id"
            WHERE snapshot."round_id" = OLD."id"
              AND snapshot."required"
              AND (
                assessment."status" = 'Részben megvan'
                OR (
                  assessment."status" IS DISTINCT FROM 'Nem releváns'
                  AND (
                    answer."id" IS NULL
                    OR NOT "is_valid_round_answer"(
                      snapshot."type",
                      snapshot."options",
                      answer."value"
                    )
                  )
                )
              )
          ) THEN
            RAISE EXCEPTION 'Interview round cannot be completed before required answers or justified not-relevant assessments are present' USING ERRCODE = '23514';
          END IF;
        ELSIF NEW."status" <> 'OPEN' OR NEW."completed_at" IS NOT NULL THEN
          RAISE EXCEPTION 'Interview round status transition is invalid' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const countRows = (await queryRunner.query(`
      SELECT COUNT(*)::text AS "overrideCount"
      FROM "round_question_assessment_overrides"
    `)) as AssessmentOverrideCountRow[];
    const overrideCount = countRows[0]?.overrideCount ?? '0';
    if (overrideCount !== '0') {
      throw new Error(
        `Migration 0009 cannot be reverted while assessment override rows exist (${overrideCount}). Remove those decisions explicitly through an approved data operation before retrying.`,
      );
    }

    await queryRunner.query(`
      DROP TRIGGER "trg_round_question_assessment_overrides_protect_change"
      ON "round_question_assessment_overrides"
    `);
    await queryRunner.query(`
      DROP TRIGGER "trg_round_question_assessment_overrides_updated_at"
      ON "round_question_assessment_overrides"
    `);
    await queryRunner.query('DROP TABLE "round_question_assessment_overrides"');
    await queryRunner.query(
      'DROP FUNCTION "protect_round_question_assessment_override_change"()',
    );
    await queryRunner.query(
      'DROP FUNCTION "set_round_question_assessment_overrides_updated_at"()',
    );

    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION "protect_round_answer_change"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE round_id uuid;
      BEGIN
        IF TG_OP = 'DELETE' THEN
          round_id = OLD."round_id";
        ELSE
          round_id = NEW."round_id";
        END IF;

        IF TG_OP = 'UPDATE' THEN
          IF NEW."id" IS DISTINCT FROM OLD."id"
            OR NEW."round_id" IS DISTINCT FROM OLD."round_id"
            OR NEW."snapshot_id" IS DISTINCT FROM OLD."snapshot_id" THEN
            RAISE EXCEPTION 'Round answer identity is immutable' USING ERRCODE = '55000';
          END IF;
          IF EXISTS (
            SELECT 1
            FROM "interview_rounds"
            WHERE ("id" = OLD."round_id" OR "id" = NEW."round_id")
              AND "status" = 'COMPLETED'
          ) THEN
            RAISE EXCEPTION 'Answers for completed interview rounds are immutable' USING ERRCODE = '55000';
          END IF;
        ELSIF EXISTS (
          SELECT 1 FROM "interview_rounds"
          WHERE "id" = round_id AND "status" = 'COMPLETED'
        ) THEN
          RAISE EXCEPTION 'Answers for completed interview rounds are immutable' USING ERRCODE = '55000';
        END IF;
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
          IF NEW."status" <> 'OPEN' OR NEW."completed_at" IS NOT NULL THEN
            RAISE EXCEPTION 'Interview rounds must be created OPEN before completion' USING ERRCODE = '23514';
          END IF;
          RETURN NEW;
        END IF;
        IF TG_OP = 'DELETE' THEN
          IF OLD."status" = 'COMPLETED' THEN
            RAISE EXCEPTION 'Completed interview rounds are immutable' USING ERRCODE = '55000';
          END IF;
          RETURN OLD;
        END IF;

        IF OLD."status" = 'COMPLETED' THEN
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

        IF NEW."status" = 'COMPLETED' THEN
          IF NEW."completed_at" IS NULL THEN
            RAISE EXCEPTION 'Completed interview rounds require completed_at' USING ERRCODE = '23514';
          END IF;
          IF EXISTS (
            SELECT 1
            FROM "round_question_snapshots" snapshot
            LEFT JOIN "round_answers" answer
              ON answer."round_id" = snapshot."round_id"
              AND answer."snapshot_id" = snapshot."id"
            WHERE snapshot."round_id" = OLD."id"
              AND snapshot."required"
              AND (
                answer."id" IS NULL
                OR NOT "is_valid_round_answer"(snapshot."type", snapshot."options", answer."value")
              )
          ) THEN
            RAISE EXCEPTION 'Interview round cannot be completed before required answers are present' USING ERRCODE = '23514';
          END IF;
        ELSIF NEW."status" <> 'OPEN' OR NEW."completed_at" IS NOT NULL THEN
          RAISE EXCEPTION 'Interview round status transition is invalid' USING ERRCODE = '23514';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
  }
}
