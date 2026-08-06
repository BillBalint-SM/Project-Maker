import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { DataSource } from 'typeorm';

import { Core0001Core1785916800000 } from '../src/migrations/0001-core';
import { QuestionsRounds0002QuestionsRounds1786003200000 } from '../src/migrations/0002-questions-rounds';
import { InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000 } from '../src/migrations/0005-initial-intake-open-round';

interface RoundFixture {
  readonly openRoundId: string;
  readonly openSnapshotId: string;
  readonly sourceRoundId: string;
  readonly sourceSnapshotId: string;
}

async function insertProjectSchema(
  dataSource: DataSource,
  label: string,
): Promise<{ projectId: string; schemaId: string; baseQuestionId: string }> {
  const projectId = randomUUID();
  const schemaId = randomUUID();
  const baseQuestionRows = await dataSource.query<Array<{ id: string }>>(
    'SELECT "id" FROM "base_questions" WHERE "bank_version" = 1 ORDER BY "display_order" LIMIT 1',
  );
  assert.equal(baseQuestionRows.length, 1);

  await dataSource.query(
    `INSERT INTO "projects" (
      "id", "name", "customer_contact_name", "customer_contact_email"
    ) VALUES ($1, $2, 'R2 integrity proof', 'r2-integrity@example.test')`,
    [projectId, label],
  );
  await dataSource.query(
    `INSERT INTO "project_question_schemas" (
      "id", "project_id", "schema_version", "bank_version", "source"
    ) VALUES ($1, $2, 1, 1, 'DIRECT_SQL_PROOF')`,
    [schemaId, projectId],
  );

  return { projectId, schemaId, baseQuestionId: baseQuestionRows[0].id };
}

async function insertRound(
  dataSource: DataSource,
  projectId: string,
  schemaId: string,
  baseQuestionId: string,
  questionType: 'DATE' | 'TEXT',
): Promise<{ roundId: string; snapshotId: string }> {
  const roundId = randomUUID();
  const snapshotId = randomUUID();
  const stableKey = `r2-integrity-${snapshotId}`;

  await dataSource.query(
    `INSERT INTO "interview_rounds" (
      "id", "project_id", "project_schema_id", "type", "source"
    ) VALUES ($1, $2, $3, 'CLARIFICATION', 'DIRECT_SQL_PROOF')`,
    [roundId, projectId, schemaId],
  );
  await dataSource.query(
    `INSERT INTO "round_question_snapshots" (
      "id", "round_id", "base_question_id", "stable_key", "topic", "control_point",
      "text", "type", "required", "blocking", "display_order"
    ) VALUES ($1, $2, $3, $4, 'Integrity', 'Database boundary', 'Proof question', $5, true, true, 1)`,
    [snapshotId, roundId, baseQuestionId, stableKey, questionType],
  );

  return { roundId, snapshotId };
}

async function insertOpenInitialIntakeRound(
  dataSource: DataSource,
  projectId: string,
  schemaId: string,
): Promise<string> {
  const roundId = randomUUID();

  await dataSource.query(
    `INSERT INTO "interview_rounds" (
      "id", "project_id", "project_schema_id", "type", "source"
    ) VALUES ($1, $2, $3, 'INITIAL_INTAKE', 'DIRECT_SQL_PROOF')`,
    [roundId, projectId, schemaId],
  );

  return roundId;
}

function createDatabaseUrlWithName(
  databaseUrl: string,
  databaseName: string,
): string {
  const parsedUrl = new URL(databaseUrl);
  parsedUrl.pathname = `/${databaseName}`;
  return parsedUrl.toString();
}

async function insertMoveFixture(dataSource: DataSource): Promise<RoundFixture> {
  const { projectId, schemaId, baseQuestionId } = await insertProjectSchema(
    dataSource,
    `R2 answer identity ${Date.now()}`,
  );
  const source = await insertRound(dataSource, projectId, schemaId, baseQuestionId, 'TEXT');
  const destination = await insertRound(dataSource, projectId, schemaId, baseQuestionId, 'TEXT');

  await dataSource.query(
    'INSERT INTO "round_answers" ("id", "round_id", "snapshot_id", "value") VALUES ($1, $2, $3, $4)',
    [randomUUID(), source.roundId, source.snapshotId, JSON.stringify('Completed answer')],
  );
  await dataSource.query(
    'UPDATE "interview_rounds" SET "status" = \'COMPLETED\', "completed_at" = CURRENT_TIMESTAMP WHERE "id" = $1',
    [source.roundId],
  );

  return {
    openRoundId: destination.roundId,
    openSnapshotId: destination.snapshotId,
    sourceRoundId: source.roundId,
    sourceSnapshotId: source.snapshotId,
  };
}

describe('Round integrity database boundary (PostgreSQL)', () => {
  let dataSource: DataSource;
  let databaseUrl: string;

  before(async () => {
    const configuredDatabaseUrl = process.env['DATABASE_URL'];
    if (!configuredDatabaseUrl) {
      throw new Error('DATABASE_URL is required for the real PostgreSQL round-integrity proof.');
    }
    databaseUrl = configuredDatabaseUrl;

    dataSource = new DataSource({
      type: 'postgres',
      url: databaseUrl,
      synchronize: false,
      migrations: [
        Core0001Core1785916800000,
        QuestionsRounds0002QuestionsRounds1786003200000,
        InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000,
      ],
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
  });

  after(async () => {
    await dataSource.destroy();
  });

  it('aborts migration 0005 on duplicate open INITIAL_INTAKE rounds without altering existing rows', async () => {
    const migrationDatabaseName = `round_integrity_${Date.now()}_${randomUUID().replaceAll('-', '')}`;
    const migrationDatabaseUrl = createDatabaseUrlWithName(databaseUrl, migrationDatabaseName);
    let seedDataSource: DataSource | undefined;
    let migrationDataSource: DataSource | undefined;
    let inspectionDataSource: DataSource | undefined;

    try {
      await dataSource.query(`CREATE DATABASE "${migrationDatabaseName}"`);

      seedDataSource = new DataSource({
        type: 'postgres',
        url: migrationDatabaseUrl,
        synchronize: false,
        migrations: [
          Core0001Core1785916800000,
          QuestionsRounds0002QuestionsRounds1786003200000,
        ],
      });
      await seedDataSource.initialize();
      await seedDataSource.runMigrations();

      const { projectId, schemaId } = await insertProjectSchema(
        seedDataSource,
        `R2 migration abort ${Date.now()}`,
      );
      const firstRoundId = await insertOpenInitialIntakeRound(seedDataSource, projectId, schemaId);
      const secondRoundId = await insertOpenInitialIntakeRound(seedDataSource, projectId, schemaId);

      await seedDataSource.destroy();
      seedDataSource = undefined;

      migrationDataSource = new DataSource({
        type: 'postgres',
        url: migrationDatabaseUrl,
        synchronize: false,
        migrations: [
          Core0001Core1785916800000,
          QuestionsRounds0002QuestionsRounds1786003200000,
          InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000,
        ],
      });
      await migrationDataSource.initialize();

      await assert.rejects(
        migrationDataSource.runMigrations(),
        (error: { message?: string }) => {
          assert.match(
            error.message ?? '',
            new RegExp(
              `Migration 0005 cannot create uq_interview_rounds_open_initial_intake because duplicate open INITIAL_INTAKE rounds already exist\\. Repair the conflicting project data explicitly before rerunning the migration\\. project ${projectId} has 2 open INITIAL_INTAKE rounds \\(${firstRoundId}, ${secondRoundId}\\)`,
            ),
          );
          return true;
        },
      );

      await migrationDataSource.destroy();
      migrationDataSource = undefined;

      inspectionDataSource = new DataSource({
        type: 'postgres',
        url: migrationDatabaseUrl,
        synchronize: false,
      });
      await inspectionDataSource.initialize();

      const preservedRoundRows = await inspectionDataSource.query<
        Array<{ completedAt: Date | null; id: string; status: string; type: string }>
      >(
        `SELECT "id", "type", "status", "completed_at" AS "completedAt"
         FROM "interview_rounds"
         WHERE "project_id" = $1
         ORDER BY "created_at" ASC`,
        [projectId],
      );
      assert.deepEqual(preservedRoundRows, [
        { completedAt: null, id: firstRoundId, status: 'OPEN', type: 'INITIAL_INTAKE' },
        { completedAt: null, id: secondRoundId, status: 'OPEN', type: 'INITIAL_INTAKE' },
      ]);

      const migrationRows = await inspectionDataSource.query<Array<{ name: string }>>(
        'SELECT "name" FROM "migrations" ORDER BY "timestamp" ASC',
      );
      assert.deepEqual(
        migrationRows.map((row) => row.name),
        [
          'Core0001Core1785916800000',
          'QuestionsRounds0002QuestionsRounds1786003200000',
        ],
      );
    } finally {
      if (inspectionDataSource) {
        await inspectionDataSource.destroy();
      }
      if (migrationDataSource) {
        await migrationDataSource.destroy();
      }
      if (seedDataSource) {
        await seedDataSource.destroy();
      }
      await dataSource.query(`DROP DATABASE IF EXISTS "${migrationDatabaseName}" WITH (FORCE)`);
    }
  });

  it('rejects moving or deleting an answer owned by a completed round', async () => {
    const fixture = await insertMoveFixture(dataSource);
    const answerRows = await dataSource.query<Array<{ id: string }>>(
      'SELECT "id" FROM "round_answers" WHERE "round_id" = $1 AND "snapshot_id" = $2',
      [fixture.sourceRoundId, fixture.sourceSnapshotId],
    );
    assert.equal(answerRows.length, 1);

    await assert.rejects(
      dataSource.query(
        'UPDATE "round_answers" SET "round_id" = $1, "snapshot_id" = $2 WHERE "id" = $3',
        [fixture.openRoundId, fixture.openSnapshotId, answerRows[0].id],
      ),
      /completed|identity|immutable/i,
    );
    await assert.rejects(
      dataSource.query('DELETE FROM "round_answers" WHERE "id" = $1', [answerRows[0].id]),
      /completed|immutable/i,
    );

    const preservedRows = await dataSource.query<Array<{ roundId: string; snapshotId: string }>>(
      'SELECT "round_id" AS "roundId", "snapshot_id" AS "snapshotId" FROM "round_answers" WHERE "id" = $1',
      [answerRows[0].id],
    );
    assert.deepEqual(preservedRows, [
      { roundId: fixture.sourceRoundId, snapshotId: fixture.sourceSnapshotId },
    ]);
  });

  it('rejects direct completion when a required answer has the wrong JSON type', async () => {
    const { projectId, schemaId, baseQuestionId } = await insertProjectSchema(
      dataSource,
      `R2 completion type ${Date.now()}`,
    );
    const round = await insertRound(dataSource, projectId, schemaId, baseQuestionId, 'DATE');
    await dataSource.query(
      'INSERT INTO "round_answers" ("id", "round_id", "snapshot_id", "value") VALUES ($1, $2, $3, $4)',
      [randomUUID(), round.roundId, round.snapshotId, JSON.stringify(true)],
    );

    await assert.rejects(
      dataSource.query(
        'UPDATE "interview_rounds" SET "status" = \'COMPLETED\', "completed_at" = CURRENT_TIMESTAMP WHERE "id" = $1',
        [round.roundId],
      ),
      /required answers|valid|type|completion/i,
    );

    const roundRows = await dataSource.query<Array<{ completedAt: Date | null; status: string }>>(
      'SELECT "status", "completed_at" AS "completedAt" FROM "interview_rounds" WHERE "id" = $1',
      [round.roundId],
    );
    assert.deepEqual(roundRows, [{ completedAt: null, status: 'OPEN' }]);
  });

  it('rejects a second open INITIAL_INTAKE round for the same project', async () => {
    const { projectId, schemaId } = await insertProjectSchema(
      dataSource,
      `R2 open initial uniqueness ${Date.now()}`,
    );
    await insertOpenInitialIntakeRound(dataSource, projectId, schemaId);

    await assert.rejects(
      dataSource.query(
        `INSERT INTO "interview_rounds" (
          "id", "project_id", "project_schema_id", "type", "source"
        ) VALUES ($1, $2, $3, 'INITIAL_INTAKE', 'DIRECT_SQL_PROOF')`,
        [randomUUID(), projectId, schemaId],
      ),
      (error: { code?: string; constraint?: string }) => {
        assert.equal(error.code, '23505');
        assert.equal(error.constraint, 'uq_interview_rounds_open_initial_intake');
        return true;
      },
    );
  });

  it('allows a later open INITIAL_INTAKE round after the prior one is completed', async () => {
    const { projectId, schemaId } = await insertProjectSchema(
      dataSource,
      `R2 completed then open initial ${Date.now()}`,
    );
    const completedRoundId = await insertOpenInitialIntakeRound(dataSource, projectId, schemaId);

    await dataSource.query(
      'UPDATE "interview_rounds" SET "status" = \'COMPLETED\', "completed_at" = CURRENT_TIMESTAMP WHERE "id" = $1',
      [completedRoundId],
    );

    const laterOpenRoundId = await insertOpenInitialIntakeRound(dataSource, projectId, schemaId);
    const roundRows = await dataSource.query<Array<{ id: string; status: string; type: string }>>(
      `SELECT "id", "status", "type"
       FROM "interview_rounds"
       WHERE "project_id" = $1
       ORDER BY "created_at" ASC`,
      [projectId],
    );

    assert.deepEqual(roundRows, [
      { id: completedRoundId, status: 'COMPLETED', type: 'INITIAL_INTAKE' },
      { id: laterOpenRoundId, status: 'OPEN', type: 'INITIAL_INTAKE' },
    ]);
  });
});
