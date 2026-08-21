import { randomUUID } from 'node:crypto';

import type { MigrationInterface, QueryRunner } from 'typeorm';

interface StoredQuestion {
  readonly stableKey: string;
  readonly topic: string;
  readonly controlPoint: string;
  readonly text: string;
  readonly type: string;
  readonly required: boolean;
  readonly requiredForEstimate: boolean;
  readonly blocking: boolean;
  readonly order: number;
  readonly active: boolean;
  readonly hint: string | null;
  readonly options: unknown;
  readonly source: string;
}

const specializedPlaybooks = [
  {
    id: 'system-integration',
    questionPrefix: 'Integrációs nézőpont',
    guidancePrefix: 'Térj ki a forrás- és célrendszer kapcsolatára.',
  },
  {
    id: 'data-migration',
    questionPrefix: 'Migrációs nézőpont',
    guidancePrefix: 'Térj ki az adatminőségre, leképezésre és visszaállíthatóságra.',
  },
] as const;

export class EvidenceBasedDiscovery0026EvidenceBasedDiscovery1788076800000
  implements MigrationInterface
{
  name = 'EvidenceBasedDiscovery0026EvidenceBasedDiscovery1788076800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN "playbook_id" varchar(100) NOT NULL DEFAULT 'general',
      ADD COLUMN "playbook_version" integer NOT NULL DEFAULT 1,
      ADD CONSTRAINT "chk_projects_playbook" CHECK (
        ("playbook_id", "playbook_version") IN (
          ('general', 1),
          ('system-integration', 1),
          ('data-migration', 1)
        )
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "project_contacts" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE RESTRICT,
        "name" varchar(255) NOT NULL,
        "email" varchar(320),
        "phone" varchar(100),
        "note" varchar(2000),
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_project_contacts_name" CHECK (btrim("name") <> ''),
        CONSTRAINT "chk_project_contacts_email" CHECK (
          "email" IS NULL OR position('@' IN "email") > 1
        ),
        CONSTRAINT "chk_project_contacts_phone" CHECK (
          "phone" IS NULL OR btrim("phone") <> ''
        ),
        CONSTRAINT "chk_project_contacts_note" CHECK (
          "note" IS NULL OR btrim("note") <> ''
        )
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_project_contacts_project" ON "project_contacts" ("project_id", "name", "id")',
    );

    await queryRunner.query('DROP INDEX "uq_interview_rounds_open_initial_intake"');
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_interview_rounds_open_type"
      ON "interview_rounds" ("project_id", "type")
      WHERE "status" = 'OPEN'
    `);
    await queryRunner.query(`
      ALTER TABLE "round_question_snapshots"
      ALTER COLUMN "base_question_id" DROP NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE "governed_attachments" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE RESTRICT,
        "owner_kind" varchar(40) NOT NULL,
        "owner_id" uuid NOT NULL,
        "original_name" varchar(255) NOT NULL,
        "content_type" varchar(100) NOT NULL,
        "size_bytes" integer NOT NULL,
        "sha256" char(64) NOT NULL,
        "content" bytea NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_governed_attachments_owner_kind" CHECK (
          "owner_kind" IN ('QUESTION_BANK', 'ROUND_SNAPSHOT', 'DISCOVERY_FOLLOW_UP')
        ),
        CONSTRAINT "chk_governed_attachments_name" CHECK (btrim("original_name") <> ''),
        CONSTRAINT "chk_governed_attachments_content_type" CHECK (btrim("content_type") <> ''),
        CONSTRAINT "chk_governed_attachments_size" CHECK (
          "size_bytes" > 0 AND "size_bytes" <= 52428800
        ),
        CONSTRAINT "chk_governed_attachments_digest" CHECK (
          "sha256" ~ '^[0-9a-f]{64}$'
        )
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_governed_attachments_owner" ON "governed_attachments" ("project_id", "owner_kind", "owner_id", "created_at")',
    );

    await queryRunner.query(`
      CREATE TABLE "evidence" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE RESTRICT,
        "source_kind" varchar(40) NOT NULL,
        "title" varchar(500) NOT NULL,
        "payload" jsonb NOT NULL,
        "round_id" uuid REFERENCES "interview_rounds"("id") ON DELETE RESTRICT,
        "snapshot_id" uuid REFERENCES "round_question_snapshots"("id") ON DELETE RESTRICT,
        "attachment_id" uuid REFERENCES "governed_attachments"("id") ON DELETE RESTRICT,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_evidence_source_kind" CHECK (
          "source_kind" IN ('ROUND_ANSWER', 'CUSTOMER_MESSAGE_EXCERPT', 'METRIC', 'HTTPS_LINK', 'ATTACHMENT')
        ),
        CONSTRAINT "chk_evidence_title" CHECK (btrim("title") <> '')
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_evidence_project" ON "evidence" ("project_id", "created_at", "id")',
    );

    await queryRunner.query(`
      CREATE TABLE "insights" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL REFERENCES "projects"("id") ON DELETE RESTRICT,
        "statement" varchar(4000) NOT NULL,
        "version" integer NOT NULL DEFAULT 1,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_insights_statement" CHECK (btrim("statement") <> ''),
        CONSTRAINT "chk_insights_version" CHECK ("version" > 0)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "insight_evidence" (
        "insight_id" uuid NOT NULL REFERENCES "insights"("id") ON DELETE CASCADE,
        "evidence_id" uuid NOT NULL REFERENCES "evidence"("id") ON DELETE RESTRICT,
        "display_order" integer NOT NULL,
        PRIMARY KEY ("insight_id", "evidence_id"),
        CONSTRAINT "uq_insight_evidence_order" UNIQUE ("insight_id", "display_order"),
        CONSTRAINT "chk_insight_evidence_order" CHECK ("display_order" > 0)
      )
    `);

    await this.publishSpecializedQuestions(queryRunner);
  }

  async down(): Promise<void> {
    throw new Error('Migration 0026 is forward-only because it stores retained discovery provenance.');
  }

  private async publishSpecializedQuestions(queryRunner: QueryRunner): Promise<void> {
    const versionRows = (await queryRunner.query(
      'SELECT MAX("bank_version")::integer AS "version" FROM "base_questions"',
    )) as Array<{ version: number }>;
    const currentVersion = versionRows[0]?.version;
    if (!Number.isInteger(currentVersion) || currentVersion < 1) {
      throw new Error('Migration 0026 requires an existing question bank.');
    }
    const questions = (await queryRunner.query(`
      SELECT
        "stable_key" AS "stableKey",
        "topic",
        "control_point" AS "controlPoint",
        "text",
        "type"::text AS "type",
        "required",
        "required_for_estimate" AS "requiredForEstimate",
        "blocking",
        "display_order" AS "order",
        "active",
        "hint",
        "options",
        "source"::text AS "source"
      FROM "base_questions"
      WHERE "bank_version" = $1
      ORDER BY "display_order", "stable_key"
    `, [currentVersion])) as StoredQuestion[];
    const generalQuestions = questions.filter((question) => /^general-\d{3}$/.test(question.stableKey));
    if (generalQuestions.length !== 30) {
      throw new Error('Migration 0026 requires the complete 30-question general v1 bank.');
    }

    const nextVersion = currentVersion + 1;
    let nextOrder = 1;
    for (const question of questions) {
      await insertQuestion(queryRunner, question, randomUUID(), question.stableKey, nextVersion, nextOrder++);
    }
    for (const playbook of specializedPlaybooks) {
      for (const question of generalQuestions) {
        const suffix = question.stableKey.slice('general-'.length);
        await insertQuestion(
          queryRunner,
          {
            ...question,
            text: `${playbook.questionPrefix}: ${question.text}`,
            hint: `${playbook.guidancePrefix} ${question.hint ?? ''}`.trim(),
            source: 'CANONICAL_SEED',
          },
          randomUUID(),
          `${playbook.id}-${suffix}`,
          nextVersion,
          nextOrder++,
        );
      }
    }
  }
}

async function insertQuestion(
  queryRunner: QueryRunner,
  question: StoredQuestion,
  id: string,
  stableKey: string,
  version: number,
  order: number,
): Promise<void> {
  await queryRunner.query(`
    INSERT INTO "base_questions" (
      "id", "stable_key", "bank_version", "topic", "control_point", "text", "type",
      "required", "required_for_estimate", "blocking", "display_order", "active", "hint",
      "options", "source", "published_at"
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7::"base_question_type",
      $8, $9, $10, $11, $12, $13, $14::jsonb, $15::"base_question_source", CURRENT_TIMESTAMP
    )
  `, [
    id,
    stableKey,
    version,
    question.topic,
    question.controlPoint,
    question.text,
    question.type,
    question.required,
    question.requiredForEstimate,
    question.blocking,
    order,
    question.active,
    question.hint,
    question.options === null ? null : JSON.stringify(question.options),
    question.source,
  ]);
}
