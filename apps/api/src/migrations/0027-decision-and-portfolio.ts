import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DecisionAndPortfolio0027DecisionAndPortfolio1788163200000
  implements MigrationInterface
{
  name = 'DecisionAndPortfolio0027DecisionAndPortfolio1788163200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "business_goals" (
        "id" uuid PRIMARY KEY,
        "name" varchar(255) NOT NULL,
        "description" varchar(2000),
        "created_by" varchar(100) NOT NULL,
        "updated_by" varchar(100) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_business_goals_name" CHECK (btrim("name") <> ''),
        CONSTRAINT "chk_business_goals_description" CHECK ("description" IS NULL OR btrim("description") <> '')
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_business_goals_name" ON "business_goals" (lower(btrim("name")))',
    );
    await queryRunner.query(`
      CREATE TABLE "initiatives" (
        "id" uuid PRIMARY KEY,
        "goal_id" uuid NOT NULL REFERENCES "business_goals"("id") ON DELETE CASCADE,
        "name" varchar(255) NOT NULL,
        "description" varchar(2000),
        "created_by" varchar(100) NOT NULL,
        "updated_by" varchar(100) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_initiatives_name" CHECK (btrim("name") <> ''),
        CONSTRAINT "chk_initiatives_description" CHECK ("description" IS NULL OR btrim("description") <> '')
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_initiatives_goal_name" ON "initiatives" ("goal_id", lower(btrim("name")))',
    );
    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN "initiative_id" uuid REFERENCES "initiatives"("id") ON DELETE SET NULL
    `);
    await queryRunner.query('CREATE INDEX "idx_projects_initiative" ON "projects" ("initiative_id")');

    await queryRunner.query(`
      CREATE TABLE "formal_decisions" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE RESTRICT,
        "version" integer NOT NULL,
        "outcome" varchar(30) NOT NULL,
        "decision_date" date NOT NULL,
        "decision_maker" varchar(255) NOT NULL,
        "rationale" varchar(4000) NOT NULL,
        "conditions" varchar(4000),
        "review_date" date,
        "reference_decision_review" boolean NOT NULL DEFAULT false,
        "insight_ids" jsonb NOT NULL DEFAULT '[]'::jsonb,
        "specification_revision_id" uuid REFERENCES "markdown_revisions"("id") ON DELETE RESTRICT,
        "actor_id" varchar(100) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_formal_decisions_project_version" UNIQUE ("project_id", "version"),
        CONSTRAINT "chk_formal_decisions_version" CHECK ("version" > 0),
        CONSTRAINT "chk_formal_decisions_outcome" CHECK ("outcome" IN ('GO', 'CONDITIONAL_GO', 'NO_GO')),
        CONSTRAINT "chk_formal_decisions_text" CHECK (
          btrim("decision_maker") <> '' AND btrim("rationale") <> ''
        ),
        CONSTRAINT "chk_formal_decisions_conditional" CHECK (
          ("outcome" = 'CONDITIONAL_GO' AND "conditions" IS NOT NULL AND btrim("conditions") <> '' AND "review_date" IS NOT NULL)
          OR ("outcome" <> 'CONDITIONAL_GO' AND "conditions" IS NULL AND "review_date" IS NULL)
        ),
        CONSTRAINT "chk_formal_decisions_insights" CHECK (jsonb_typeof("insight_ids") = 'array')
      )
    `);
    await queryRunner.query(`
      CREATE FUNCTION "protect_formal_decision"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Formal decisions are append-only' USING ERRCODE = '55000';
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_formal_decisions_immutable"
      BEFORE UPDATE OR DELETE ON "formal_decisions"
      FOR EACH ROW EXECUTE FUNCTION "protect_formal_decision"()
    `);

    await queryRunner.query(`
      CREATE TABLE "project_status_updates" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE RESTRICT,
        "version" integer NOT NULL,
        "health" varchar(20) NOT NULL,
        "summary" varchar(2000) NOT NULL,
        "changes" varchar(4000),
        "risks" varchar(4000),
        "next_step" varchar(2000) NOT NULL,
        "actor_id" varchar(100) NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "uq_project_status_updates_version" UNIQUE ("project_id", "version"),
        CONSTRAINT "chk_project_status_updates_version" CHECK ("version" > 0),
        CONSTRAINT "chk_project_status_updates_health" CHECK ("health" IN ('ON_TRACK', 'AT_RISK', 'BLOCKED')),
        CONSTRAINT "chk_project_status_updates_text" CHECK (btrim("summary") <> '' AND btrim("next_step") <> ''),
        CONSTRAINT "chk_project_status_updates_changes" CHECK ("changes" IS NULL OR btrim("changes") <> ''),
        CONSTRAINT "chk_project_status_updates_risks" CHECK ("risks" IS NULL OR btrim("risks") <> '')
      )
    `);
    await queryRunner.query(`
      CREATE FUNCTION "protect_project_status_update"() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          RAISE EXCEPTION 'Project status updates are retained history' USING ERRCODE = '55000';
        END IF;
        IF OLD."id" IS DISTINCT FROM NEW."id"
          OR OLD."project_id" IS DISTINCT FROM NEW."project_id"
          OR OLD."version" IS DISTINCT FROM NEW."version"
          OR OLD."actor_id" IS DISTINCT FROM NEW."actor_id"
          OR OLD."created_at" IS DISTINCT FROM NEW."created_at" THEN
          RAISE EXCEPTION 'Project status update identity is immutable' USING ERRCODE = '55000';
        END IF;
        IF OLD."version" <> (SELECT MAX(current."version") FROM "project_status_updates" current WHERE current."project_id" = OLD."project_id") THEN
          RAISE EXCEPTION 'Only the latest Project status update is editable' USING ERRCODE = '55000';
        END IF;
        NEW."updated_at" = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_project_status_updates_protect"
      BEFORE UPDATE OR DELETE ON "project_status_updates"
      FOR EACH ROW EXECUTE FUNCTION "protect_project_status_update"()
    `);
  }

  async down(): Promise<void> {
    throw new Error('Migration 0027 is forward-only because it stores formal decision and Project status history.');
  }
}
