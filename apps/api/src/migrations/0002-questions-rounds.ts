import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, parse, resolve } from 'node:path';

import type { MigrationInterface, QueryRunner } from 'typeorm';

interface CanonicalPlaybookItem {
  readonly id: number;
  readonly category: string;
  readonly controlPoint: string;
  readonly exampleQuestion: string;
  readonly hint: string;
  readonly requiredForMvp: boolean;
  readonly requiredForEstimate: boolean;
  readonly blockingIfMissing: boolean;
}

interface CanonicalPlaybook {
  readonly id: string;
  readonly version: number;
  readonly items: readonly CanonicalPlaybookItem[];
}

export class QuestionsRounds0002QuestionsRounds1786003200000 implements MigrationInterface {
  name = 'QuestionsRounds0002QuestionsRounds1786003200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "base_question_type" AS ENUM (
        'TEXT',
        'LONG_TEXT',
        'SINGLE_SELECT',
        'MULTI_SELECT',
        'BOOLEAN',
        'NUMBER',
        'DATE'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "base_question_source" AS ENUM ('CANONICAL_SEED', 'SETTINGS_API')
    `);
    await queryRunner.query(`
      CREATE TYPE "interview_round_type" AS ENUM (
        'INITIAL_INTAKE',
        'STAKEHOLDER',
        'CLARIFICATION'
      )
    `);
    await queryRunner.query(`
      CREATE TYPE "interview_round_status" AS ENUM ('OPEN', 'COMPLETED')
    `);

    await queryRunner.query(`
      CREATE TABLE "base_questions" (
        "id" uuid PRIMARY KEY,
        "stable_key" varchar(100) NOT NULL,
        "bank_version" integer NOT NULL,
        "topic" varchar(255) NOT NULL,
        "control_point" text NOT NULL,
        "text" text NOT NULL,
        "type" "base_question_type" NOT NULL,
        "required" boolean NOT NULL,
        "required_for_estimate" boolean NOT NULL,
        "blocking" boolean NOT NULL,
        "display_order" integer NOT NULL,
        "active" boolean NOT NULL,
        "hint" text,
        "options" jsonb,
        "source" "base_question_source" NOT NULL,
        "published_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_base_questions_version_key" UNIQUE ("bank_version", "stable_key"),
        CONSTRAINT "uq_base_questions_version_id" UNIQUE ("bank_version", "id"),
        CONSTRAINT "uq_base_questions_version_order" UNIQUE ("bank_version", "display_order"),
        CONSTRAINT "chk_base_questions_version_positive" CHECK ("bank_version" > 0),
        CONSTRAINT "chk_base_questions_order_positive" CHECK ("display_order" > 0),
        CONSTRAINT "chk_base_questions_stable_key_not_blank" CHECK (btrim("stable_key") <> ''),
        CONSTRAINT "chk_base_questions_topic_not_blank" CHECK (btrim("topic") <> ''),
        CONSTRAINT "chk_base_questions_control_point_not_blank" CHECK (btrim("control_point") <> ''),
        CONSTRAINT "chk_base_questions_text_not_blank" CHECK (btrim("text") <> ''),
        CONSTRAINT "chk_base_questions_hint_not_blank" CHECK ("hint" IS NULL OR btrim("hint") <> ''),
        CONSTRAINT "chk_base_questions_options_array" CHECK (
          "options" IS NULL OR jsonb_typeof("options") = 'array'
        ),
        CONSTRAINT "chk_base_questions_select_options" CHECK (
          ("type" IN ('SINGLE_SELECT', 'MULTI_SELECT') AND "options" IS NOT NULL AND jsonb_array_length("options") > 0)
          OR ("type" NOT IN ('SINGLE_SELECT', 'MULTI_SELECT') AND "options" IS NULL)
        )
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "project_question_schemas" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL,
        "schema_version" integer NOT NULL,
        "bank_version" integer NOT NULL,
        "published_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "source" varchar(50) NOT NULL,
        CONSTRAINT "uq_project_question_schemas_project_version" UNIQUE ("project_id", "schema_version"),
        CONSTRAINT "uq_project_question_schemas_id_bank_version" UNIQUE ("id", "bank_version"),
        CONSTRAINT "chk_project_question_schemas_schema_version" CHECK ("schema_version" > 0),
        CONSTRAINT "chk_project_question_schemas_bank_version" CHECK ("bank_version" > 0),
        CONSTRAINT "chk_project_question_schemas_source" CHECK (btrim("source") <> ''),
        CONSTRAINT "fk_project_question_schemas_project"
          FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "project_schema_questions" (
        "id" uuid PRIMARY KEY,
        "project_schema_id" uuid NOT NULL,
        "base_question_id" uuid NOT NULL,
        "bank_version" integer NOT NULL,
        "required" boolean NOT NULL,
        "blocking" boolean NOT NULL,
        "display_order" integer NOT NULL,
        CONSTRAINT "uq_project_schema_questions_schema_question" UNIQUE ("project_schema_id", "base_question_id"),
        CONSTRAINT "uq_project_schema_questions_schema_order" UNIQUE ("project_schema_id", "display_order"),
        CONSTRAINT "chk_project_schema_questions_order" CHECK ("display_order" > 0),
        CONSTRAINT "fk_project_schema_questions_schema"
          FOREIGN KEY ("project_schema_id") REFERENCES "project_question_schemas"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_project_schema_questions_schema_bank_version"
          FOREIGN KEY ("project_schema_id", "bank_version")
          REFERENCES "project_question_schemas"("id", "bank_version") ON DELETE RESTRICT,
        CONSTRAINT "fk_project_schema_questions_base_question"
          FOREIGN KEY ("base_question_id") REFERENCES "base_questions"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_project_schema_questions_base_bank_version"
          FOREIGN KEY ("bank_version", "base_question_id")
          REFERENCES "base_questions"("bank_version", "id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "interview_rounds" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL,
        "project_schema_id" uuid NOT NULL,
        "type" "interview_round_type" NOT NULL,
        "status" "interview_round_status" NOT NULL DEFAULT 'OPEN',
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completed_at" timestamptz,
        "source" varchar(50) NOT NULL,
        CONSTRAINT "chk_interview_rounds_completion" CHECK (
          ("status" = 'OPEN' AND "completed_at" IS NULL)
          OR ("status" = 'COMPLETED' AND "completed_at" IS NOT NULL)
        ),
        CONSTRAINT "chk_interview_rounds_source" CHECK (btrim("source") <> ''),
        CONSTRAINT "fk_interview_rounds_project"
          FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_interview_rounds_schema"
          FOREIGN KEY ("project_schema_id") REFERENCES "project_question_schemas"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "round_question_snapshots" (
        "id" uuid PRIMARY KEY,
        "round_id" uuid NOT NULL,
        "base_question_id" uuid NOT NULL,
        "stable_key" varchar(100) NOT NULL,
        "topic" varchar(255) NOT NULL,
        "control_point" text NOT NULL,
        "text" text NOT NULL,
        "type" "base_question_type" NOT NULL,
        "required" boolean NOT NULL,
        "blocking" boolean NOT NULL,
        "display_order" integer NOT NULL,
        "hint" text,
        "options" jsonb,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_round_question_snapshots_round_id" UNIQUE ("round_id", "id"),
        CONSTRAINT "uq_round_question_snapshots_round_key" UNIQUE ("round_id", "stable_key"),
        CONSTRAINT "uq_round_question_snapshots_round_order" UNIQUE ("round_id", "display_order"),
        CONSTRAINT "chk_round_question_snapshots_order" CHECK ("display_order" > 0),
        CONSTRAINT "chk_round_question_snapshots_stable_key" CHECK (btrim("stable_key") <> ''),
        CONSTRAINT "chk_round_question_snapshots_topic" CHECK (btrim("topic") <> ''),
        CONSTRAINT "chk_round_question_snapshots_control_point" CHECK (btrim("control_point") <> ''),
        CONSTRAINT "chk_round_question_snapshots_text" CHECK (btrim("text") <> ''),
        CONSTRAINT "chk_round_question_snapshots_hint" CHECK ("hint" IS NULL OR btrim("hint") <> ''),
        CONSTRAINT "chk_round_question_snapshots_options_array" CHECK (
          "options" IS NULL OR jsonb_typeof("options") = 'array'
        ),
        CONSTRAINT "fk_round_question_snapshots_round"
          FOREIGN KEY ("round_id") REFERENCES "interview_rounds"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_round_question_snapshots_base_question"
          FOREIGN KEY ("base_question_id") REFERENCES "base_questions"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "round_answers" (
        "id" uuid PRIMARY KEY,
        "round_id" uuid NOT NULL,
        "snapshot_id" uuid NOT NULL,
        "value" jsonb NOT NULL,
        "answered_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_round_answers_snapshot" UNIQUE ("snapshot_id"),
        CONSTRAINT "chk_round_answers_value_not_null" CHECK ("value" <> 'null'::jsonb),
        CONSTRAINT "fk_round_answers_round"
          FOREIGN KEY ("round_id") REFERENCES "interview_rounds"("id") ON DELETE RESTRICT,
        CONSTRAINT "fk_round_answers_round_snapshot"
          FOREIGN KEY ("round_id", "snapshot_id")
          REFERENCES "round_question_snapshots"("round_id", "id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(`
      CREATE FUNCTION "set_round_answers_updated_at"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        NEW."updated_at" = CURRENT_TIMESTAMP;
        NEW."answered_at" = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_round_answers_updated_at"
      BEFORE UPDATE ON "round_answers"
      FOR EACH ROW
      EXECUTE FUNCTION "set_round_answers_updated_at"()
    `);

    await queryRunner.query(`
      CREATE FUNCTION "is_valid_round_answer"(
        question_type "base_question_type",
        configured_options jsonb,
        answer_value jsonb
      )
      RETURNS boolean
      LANGUAGE plpgsql
      IMMUTABLE
      AS $$
      DECLARE candidate text;
      BEGIN
        IF answer_value IS NULL OR answer_value = 'null'::jsonb THEN
          RETURN false;
        END IF;

        IF question_type IN ('TEXT', 'LONG_TEXT') THEN
          RETURN jsonb_typeof(answer_value) = 'string'
            AND btrim(answer_value #>> '{}') <> '';
        END IF;

        IF question_type = 'BOOLEAN' THEN
          RETURN jsonb_typeof(answer_value) = 'boolean';
        END IF;

        IF question_type = 'NUMBER' THEN
          RETURN jsonb_typeof(answer_value) = 'number';
        END IF;

        IF question_type = 'DATE' THEN
          IF jsonb_typeof(answer_value) <> 'string' THEN
            RETURN false;
          END IF;
          candidate := answer_value #>> '{}';
          IF candidate !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' THEN
            RETURN false;
          END IF;
          RETURN to_char(to_date(candidate, 'YYYY-MM-DD'), 'YYYY-MM-DD') = candidate;
        END IF;

        IF question_type = 'SINGLE_SELECT' THEN
          IF jsonb_typeof(answer_value) <> 'string'
            OR jsonb_typeof(configured_options) <> 'array' THEN
            RETURN false;
          END IF;
          candidate := answer_value #>> '{}';
          RETURN EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(configured_options) AS configured(option_value)
            WHERE configured.option_value = candidate
          );
        END IF;

        IF question_type = 'MULTI_SELECT' THEN
          IF jsonb_typeof(answer_value) <> 'array'
            OR jsonb_array_length(answer_value) = 0
            OR jsonb_typeof(configured_options) <> 'array' THEN
            RETURN false;
          END IF;
          IF EXISTS (
            SELECT 1
            FROM jsonb_array_elements(answer_value) AS selected(option_value)
            WHERE jsonb_typeof(selected.option_value) <> 'string'
          ) THEN
            RETURN false;
          END IF;
          IF (
            SELECT COUNT(*)
            FROM jsonb_array_elements_text(answer_value)
          ) <> (
            SELECT COUNT(DISTINCT selected.option_value)
            FROM jsonb_array_elements_text(answer_value) AS selected(option_value)
          ) THEN
            RETURN false;
          END IF;
          RETURN NOT EXISTS (
            SELECT 1
            FROM jsonb_array_elements_text(answer_value) AS selected(option_value)
            WHERE NOT EXISTS (
              SELECT 1
              FROM jsonb_array_elements_text(configured_options) AS configured(option_value)
              WHERE configured.option_value = selected.option_value
            )
          );
        END IF;

        RETURN false;
      END;
      $$
    `);

    await queryRunner.query(`
      CREATE FUNCTION "protect_interview_round_change"()
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
    await queryRunner.query(`
      CREATE TRIGGER "trg_interview_rounds_protect_change"
      BEFORE INSERT OR UPDATE OR DELETE ON "interview_rounds"
      FOR EACH ROW
      EXECUTE FUNCTION "protect_interview_round_change"()
    `);

    await queryRunner.query(`
      CREATE FUNCTION "protect_round_answer_change"()
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
      CREATE TRIGGER "trg_round_answers_protect_change"
      BEFORE INSERT OR UPDATE OR DELETE ON "round_answers"
      FOR EACH ROW
      EXECUTE FUNCTION "protect_round_answer_change"()
    `);

    await queryRunner.query(`
      CREATE FUNCTION "reject_immutable_question_record_change"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        RAISE EXCEPTION '% records are immutable', TG_TABLE_NAME USING ERRCODE = '55000';
      END;
      $$
    `);
    for (const table of [
      'base_questions',
      'project_question_schemas',
      'project_schema_questions',
      'round_question_snapshots',
    ]) {
      await queryRunner.query(`
        CREATE TRIGGER "trg_${table}_immutable"
        BEFORE UPDATE OR DELETE ON "${table}"
        FOR EACH ROW
        EXECUTE FUNCTION "reject_immutable_question_record_change"()
      `);
    }

    await queryRunner.query(
      'CREATE INDEX "idx_base_questions_latest" ON "base_questions" ("bank_version" DESC, "display_order" ASC)',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_project_question_schemas_latest" ON "project_question_schemas" ("project_id", "schema_version" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_project_schema_questions_schema" ON "project_schema_questions" ("project_schema_id", "display_order")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_interview_rounds_project_created" ON "interview_rounds" ("project_id", "created_at" DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_round_question_snapshots_round" ON "round_question_snapshots" ("round_id", "display_order")',
    );
    await queryRunner.query(
      'CREATE INDEX "idx_round_answers_round" ON "round_answers" ("round_id", "snapshot_id")',
    );

    const playbook = loadCanonicalPlaybook();
    for (const item of playbook.items) {
      await queryRunner.query(
        `
          INSERT INTO "base_questions" (
            "id",
            "stable_key",
            "bank_version",
            "topic",
            "control_point",
            "text",
            "type",
            "required",
            "required_for_estimate",
            "blocking",
            "display_order",
            "active",
            "hint",
            "options",
            "source"
          ) VALUES ($1, $2, $3, $4, $5, $6, 'LONG_TEXT', $7, $8, $9, $10, true, $11, NULL, 'CANONICAL_SEED')
        `,
        [
          randomUUID(),
          `${playbook.id}-${String(item.id).padStart(3, '0')}`,
          playbook.version,
          item.category,
          item.controlPoint,
          item.exampleQuestion,
          item.requiredForMvp,
          item.requiredForEstimate,
          item.blockingIfMissing,
          item.id,
          item.hint,
        ],
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "round_answers"');
    await queryRunner.query('DROP FUNCTION "set_round_answers_updated_at"()');
    await queryRunner.query('DROP TABLE "round_question_snapshots"');
    await queryRunner.query('DROP TABLE "interview_rounds"');
    await queryRunner.query('DROP TABLE "project_schema_questions"');
    await queryRunner.query('DROP TABLE "project_question_schemas"');
    await queryRunner.query('DROP TABLE "base_questions"');
    await queryRunner.query('DROP FUNCTION "reject_immutable_question_record_change"()');
    await queryRunner.query('DROP FUNCTION "protect_round_answer_change"()');
    await queryRunner.query('DROP FUNCTION "protect_interview_round_change"()');
    await queryRunner.query('DROP FUNCTION "is_valid_round_answer"("base_question_type", jsonb, jsonb)');
    await queryRunner.query('DROP TYPE "interview_round_status"');
    await queryRunner.query('DROP TYPE "interview_round_type"');
    await queryRunner.query('DROP TYPE "base_question_source"');
    await queryRunner.query('DROP TYPE "base_question_type"');
  }
}

function loadCanonicalPlaybook(): CanonicalPlaybook {
  const sourcePath = findCanonicalPlaybookPath(__dirname);
  const parsed = JSON.parse(readFileSync(sourcePath, 'utf8')) as unknown;
  if (!isCanonicalPlaybook(parsed)) {
    throw new Error(
      'Canonical seed source packages/contracts/playbooks/general.v1.json must contain general v1 with exactly 30 valid items.',
    );
  }
  return parsed;
}

function findCanonicalPlaybookPath(startDirectory: string): string {
  let directory = resolve(startDirectory);
  const root = parse(directory).root;
  while (directory !== root) {
    const candidates = [
      resolve(directory, 'packages/contracts/playbooks/general.v1.json'),
      resolve(directory, 'playbooks/general.v1.json'),
    ];
    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }
    directory = dirname(directory);
  }
  throw new Error(
    'Canonical seed source packages/contracts/playbooks/general.v1.json was not found from the migration directory.',
  );
}

function isCanonicalPlaybook(value: unknown): value is CanonicalPlaybook {
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const playbook = value as Partial<CanonicalPlaybook>;
  if (playbook.id !== 'general' || playbook.version !== 1 || playbook.items?.length !== 30) {
    return false;
  }
  const ids = new Set<number>();
  for (const [index, item] of playbook.items.entries()) {
    if (
      item.id !== index + 1 ||
      ids.has(item.id) ||
      !hasText(item.category) ||
      !hasText(item.controlPoint) ||
      !hasText(item.exampleQuestion) ||
      !hasText(item.hint) ||
      typeof item.requiredForMvp !== 'boolean' ||
      typeof item.requiredForEstimate !== 'boolean' ||
      typeof item.blockingIfMissing !== 'boolean'
    ) {
      return false;
    }
    ids.add(item.id);
  }
  return true;
}

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}
