import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { DataSource } from 'typeorm';

import { Core0001Core1785916800000 } from '../src/migrations/0001-core';
import { QuestionsRounds0002QuestionsRounds1786003200000 } from '../src/migrations/0002-questions-rounds';

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

  before(async () => {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required for the real PostgreSQL round-integrity proof.');
    }

    dataSource = new DataSource({
      type: 'postgres',
      url: databaseUrl,
      synchronize: false,
      migrations: [
        Core0001Core1785916800000,
        QuestionsRounds0002QuestionsRounds1786003200000,
      ],
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
  });

  after(async () => {
    await dataSource.destroy();
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
});
