import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';

import { DataSource } from 'typeorm';

import { migrationsForFreshDatabase } from './migration-harness';

describe('Interview customer handoff migration boundary (PostgreSQL)', () => {
  let adminDataSource: DataSource;
  let migrationDataSource: DataSource;
  let databaseName: string;

  before(async () => {
    const configuredDatabaseUrl = process.env['DATABASE_URL'];
    if (!configuredDatabaseUrl) {
      throw new Error('DATABASE_URL is required for the interview handoff migration proof.');
    }

    databaseName = `project_maker_intake06_${randomUUID().replaceAll('-', '')}`;
    adminDataSource = new DataSource({ type: 'postgres', url: configuredDatabaseUrl });
    await adminDataSource.initialize();
    await adminDataSource.query(`CREATE DATABASE "${databaseName}"`);

    const databaseUrl = new URL(configuredDatabaseUrl);
    databaseUrl.pathname = `/${databaseName}`;
    migrationDataSource = new DataSource({
      type: 'postgres',
      url: databaseUrl.toString(),
      migrations: [...migrationsForFreshDatabase()],
      migrationsTransactionMode: 'each',
    });
    await migrationDataSource.initialize();
    await migrationDataSource.runMigrations();
  });

  after(async () => {
    if (migrationDataSource?.isInitialized) {
      await migrationDataSource.destroy();
    }
    if (adminDataSource?.isInitialized) {
      await adminDataSource.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
      await adminDataSource.destroy();
    }
  });

  it('ends an incomplete meeting and establishes the versioned handoff schema', async () => {
    const projectId = randomUUID();
    const schemaId = randomUUID();
    const roundId = randomUUID();
    const snapshotId = randomUUID();
    const baseQuestionRows = await migrationDataSource.query<Array<{ id: string }>>(
      'SELECT "id" FROM "base_questions" ORDER BY "display_order" LIMIT 1',
    );
    const baseQuestionId = baseQuestionRows[0]?.id;
    assert.ok(baseQuestionId);

    await migrationDataSource.query(
      `INSERT INTO "projects" (
        "id", "name", "customer_contact_name", "customer_contact_email",
        "internal_owner_name", "next_action_owner_role"
      ) VALUES ($1, 'Versioned handoff proof', 'Customer Contact', 'customer@example.test',
        'Internal Owner', 'INTERNAL_OWNER')`,
      [projectId],
    );
    await migrationDataSource.query(
      `INSERT INTO "project_question_schemas" (
        "id", "project_id", "schema_version", "bank_version", "source"
      ) VALUES ($1, $2, 1, 1, 'INTAKE06_PROOF')`,
      [schemaId, projectId],
    );
    await migrationDataSource.query(
      `INSERT INTO "interview_rounds" (
        "id", "project_id", "project_schema_id", "type", "source"
      ) VALUES ($1, $2, $3, 'INITIAL_INTAKE', 'INTAKE06_PROOF')`,
      [roundId, projectId, schemaId],
    );
    await migrationDataSource.query(
      `INSERT INTO "round_question_snapshots" (
        "id", "round_id", "base_question_id", "stable_key", "topic", "control_point",
        "text", "type", "required", "blocking", "display_order"
      ) VALUES ($1, $2, $3, 'intake06-required', 'Interview', 'Completion',
        'Required but unanswered', 'TEXT', true, true, 1)`,
      [snapshotId, roundId, baseQuestionId],
    );

    await migrationDataSource.query(
      `UPDATE "interview_rounds"
       SET "status" = 'ENDED', "completed_at" = CURRENT_TIMESTAMP
       WHERE "id" = $1`,
      [roundId],
    );
    await migrationDataSource.query(
      `INSERT INTO "interview_customer_handoffs" (
        "id", "project_id", "round_id", "version", "state"
      ) VALUES ($1, $2, $3, 1, 'DRAFT')`,
      [randomUUID(), projectId, roundId],
    );

    const rows = await migrationDataSource.query<
      Array<{ status: string; contentVersion: number; handoffState: string }>
    >(
      `SELECT round."status", round."content_version" AS "contentVersion",
        handoff."state" AS "handoffState"
       FROM "interview_rounds" round
       JOIN "interview_customer_handoffs" handoff ON handoff."round_id" = round."id"
       WHERE round."id" = $1`,
      [roundId],
    );
    assert.deepEqual(rows, [{ status: 'ENDED', contentVersion: 1, handoffState: 'DRAFT' }]);
  });

  it('edits an ended meeting only through an active draft and preserves sent snapshots', async () => {
    const projectId = randomUUID();
    const schemaId = randomUUID();
    const roundId = randomUUID();
    const snapshotId = randomUUID();
    const answerId = randomUUID();
    const assessmentId = randomUUID();
    const firstHandoffId = randomUUID();
    const secondHandoffId = randomUUID();
    const baseQuestionRows = await migrationDataSource.query<Array<{ id: string }>>(
      'SELECT "id" FROM "base_questions" ORDER BY "display_order" LIMIT 1',
    );
    const baseQuestionId = baseQuestionRows[0]?.id;
    assert.ok(baseQuestionId);

    await migrationDataSource.query(
      `INSERT INTO "projects" (
        "id", "name", "customer_contact_name", "customer_contact_email",
        "internal_owner_name", "next_action_owner_role"
      ) VALUES ($1, 'Revision proof', 'Customer Contact', 'revision@example.test',
        'Internal Owner', 'INTERNAL_OWNER')`,
      [projectId],
    );
    await migrationDataSource.query(
      `INSERT INTO "project_question_schemas" (
        "id", "project_id", "schema_version", "bank_version", "source"
      ) VALUES ($1, $2, 1, 1, 'INTAKE06_REVISION')`,
      [schemaId, projectId],
    );
    await migrationDataSource.query(
      `INSERT INTO "interview_rounds" (
        "id", "project_id", "project_schema_id", "type", "source"
      ) VALUES ($1, $2, $3, 'INITIAL_INTAKE', 'INTAKE06_REVISION')`,
      [roundId, projectId, schemaId],
    );
    await migrationDataSource.query(
      `INSERT INTO "round_question_snapshots" (
        "id", "round_id", "base_question_id", "stable_key", "topic", "control_point",
        "text", "type", "required", "blocking", "display_order"
      ) VALUES ($1, $2, $3, 'intake06-revision', 'Interview', 'Revision',
        'Editable answer', 'TEXT', false, false, 1)`,
      [snapshotId, roundId, baseQuestionId],
    );
    await migrationDataSource.query(
      'INSERT INTO "round_answers" ("id", "round_id", "snapshot_id", "value") VALUES ($1, $2, $3, $4)',
      [answerId, roundId, snapshotId, JSON.stringify('First answer')],
    );
    await migrationDataSource.query(
      `INSERT INTO "round_question_assessment_overrides" (
        "id", "round_id", "snapshot_id", "status", "rationale"
      ) VALUES ($1, $2, $3, 'Részben megvan', NULL)`,
      [assessmentId, roundId, snapshotId],
    );
    await migrationDataSource.query(
      `UPDATE "interview_rounds"
       SET "status" = 'ENDED', "completed_at" = CURRENT_TIMESTAMP
       WHERE "id" = $1`,
      [roundId],
    );
    await migrationDataSource.query(
      `INSERT INTO "interview_customer_handoffs" (
        "id", "project_id", "round_id", "version", "state"
      ) VALUES ($1, $2, $3, 1, 'DRAFT')`,
      [firstHandoffId, projectId, roundId],
    );
    await migrationDataSource.query(
      'UPDATE "round_answers" SET "value" = $1 WHERE "id" = $2',
      [JSON.stringify('Reviewed first answer'), answerId],
    );
    await migrationDataSource.query(
      `UPDATE "interview_customer_handoffs"
       SET "state" = 'SENT', "sent_at" = CURRENT_TIMESTAMP,
           "recipient_name" = 'Customer Contact', "recipient_email" = 'revision@example.test',
           "internal_owner_name" = 'Internal Owner', "subject" = 'Version 1',
           "html_content" = '<p>Version 1</p>', "text_content" = 'Version 1',
           "preview_digest" = repeat('a', 64), "source_content_version" = 4,
           "attempted_at" = CURRENT_TIMESTAMP
       WHERE "id" = $1`,
      [firstHandoffId],
    );

    await assert.rejects(
      migrationDataSource.query(
        'UPDATE "round_answers" SET "value" = $1 WHERE "id" = $2',
        [JSON.stringify('Must stay locked'), answerId],
      ),
      /active interview revision draft/i,
    );
    await assert.rejects(
      migrationDataSource.query(
        'DELETE FROM "round_question_assessment_overrides" WHERE "id" = $1',
        [assessmentId],
      ),
      /active interview revision draft/i,
    );

    await migrationDataSource.query(
      `INSERT INTO "interview_customer_handoffs" (
        "id", "project_id", "round_id", "version", "supersedes_handoff_id", "state"
      ) VALUES ($1, $2, $3, 2, $4, 'DRAFT')`,
      [secondHandoffId, projectId, roundId, firstHandoffId],
    );
    await migrationDataSource.query(
      'UPDATE "round_answers" SET "value" = $1 WHERE "id" = $2',
      [JSON.stringify('Customer-requested correction'), answerId],
    );
    await migrationDataSource.query(
      'DELETE FROM "round_question_assessment_overrides" WHERE "id" = $1',
      [assessmentId],
    );

    const rows = await migrationDataSource.query<
      Array<{ value: string; contentVersion: number; sentState: string; draftState: string }>
    >(
      `SELECT answer."value" #>> '{}' AS "value", round."content_version" AS "contentVersion",
        sent."state" AS "sentState", draft."state" AS "draftState"
       FROM "round_answers" answer
       JOIN "interview_rounds" round ON round."id" = answer."round_id"
       JOIN "interview_customer_handoffs" sent ON sent."id" = $2
       JOIN "interview_customer_handoffs" draft ON draft."id" = $3
       WHERE answer."id" = $1`,
      [answerId, firstHandoffId, secondHandoffId],
    );
    assert.deepEqual(rows, [{
      value: 'Customer-requested correction',
      contentVersion: 6,
      sentState: 'SENT',
      draftState: 'DRAFT',
    }]);
  });

  it('refuses rollback while ended interviews or handoff history exist', async () => {
    await assert.rejects(
      migrationDataSource.undoLastMigration(),
      /Migration 0014 cannot remove ended interview or customer handoff history/i,
    );
  });

  it('restores the prior empty schema without leaving versioned handoff artifacts', async () => {
    const rollbackDatabaseName = `project_maker_intake06_down_${randomUUID().replaceAll('-', '')}`;
    const rollbackDatabaseUrl = new URL(process.env['DATABASE_URL']!);
    rollbackDatabaseUrl.pathname = `/${rollbackDatabaseName}`;
    let rollbackDataSource: DataSource | undefined;

    try {
      await adminDataSource.query(`CREATE DATABASE "${rollbackDatabaseName}"`);
      rollbackDataSource = new DataSource({
        type: 'postgres',
        url: rollbackDatabaseUrl.toString(),
        migrations: [...migrationsForFreshDatabase()],
        migrationsTransactionMode: 'each',
      });
      await rollbackDataSource.initialize();
      await rollbackDataSource.runMigrations();
      await rollbackDataSource.undoLastMigration();

      const rows = await rollbackDataSource.query<
        Array<{ handoffTable: string | null; newColumnCount: string; statuses: string[] }>
      >(`
        SELECT
          to_regclass('public.interview_customer_handoffs')::text AS "handoffTable",
          (
            SELECT COUNT(*)::text FROM information_schema.columns
            WHERE table_schema = 'public'
              AND (
                (table_name = 'projects' AND column_name IN ('internal_owner_name', 'next_action_owner_role'))
                OR (table_name = 'interview_rounds' AND column_name = 'content_version')
              )
          ) AS "newColumnCount",
          to_json(ARRAY(
            SELECT enumlabel FROM pg_enum
            JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
            WHERE pg_type.typname = 'interview_round_status'
            ORDER BY enumsortorder
          )) AS "statuses"
      `);
      assert.deepEqual(rows, [{
        handoffTable: null,
        newColumnCount: '0',
        statuses: ['OPEN', 'COMPLETED'],
      }]);
    } finally {
      if (rollbackDataSource?.isInitialized) {
        await rollbackDataSource.destroy();
      }
      await adminDataSource.query(`DROP DATABASE IF EXISTS "${rollbackDatabaseName}" WITH (FORCE)`);
    }
  });
});
