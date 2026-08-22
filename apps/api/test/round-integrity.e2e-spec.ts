import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { DataSource } from 'typeorm';

import {
  migrationsForFreshDatabase,
  migrationsForHistoricalDatabase,
} from './migration-harness';

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
  questionType: 'DATE' | 'LONG_TEXT' | 'TEXT',
  roundType: 'CLARIFICATION' | 'STAKEHOLDER' = 'CLARIFICATION',
): Promise<{ roundId: string; snapshotId: string }> {
  const roundId = randomUUID();
  const snapshotId = randomUUID();
  const stableKey = `r2-integrity-${snapshotId}`;

  await dataSource.query(
    `INSERT INTO "interview_rounds" (
      "id", "project_id", "project_schema_id", "type", "source"
    ) VALUES ($1, $2, $3, $4, 'DIRECT_SQL_PROOF')`,
    [roundId, projectId, schemaId, roundType],
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

async function insertAssessmentFixture(
  dataSource: DataSource,
  label: string,
): Promise<{ roundId: string; snapshotId: string }> {
  const { projectId, schemaId, baseQuestionId } = await insertProjectSchema(
    dataSource,
    label,
  );
  return insertRound(dataSource, projectId, schemaId, baseQuestionId, 'TEXT');
}

async function insertValidTextAnswer(
  dataSource: DataSource,
  roundId: string,
  snapshotId: string,
): Promise<string> {
  const answerId = randomUUID();
  await dataSource.query(
    'INSERT INTO "round_answers" ("id", "round_id", "snapshot_id", "value") VALUES ($1, $2, $3, $4)',
    [answerId, roundId, snapshotId, JSON.stringify('Valid assessment evidence')],
  );
  return answerId;
}

async function insertAssessmentOverride(
  dataSource: DataSource,
  roundId: string,
  snapshotId: string,
  status: string,
  rationale: string | null,
): Promise<string> {
  const overrideId = randomUUID();
  await dataSource.query(
    `INSERT INTO "round_question_assessment_overrides" (
      "id", "round_id", "snapshot_id", "status", "rationale"
    ) VALUES ($1, $2, $3, $4, $5)`,
    [overrideId, roundId, snapshotId, status, rationale],
  );
  return overrideId;
}

async function completeRound(dataSource: DataSource, roundId: string): Promise<void> {
  await dataSource.query(
    'UPDATE "interview_rounds" SET "status" = \'ENDED\', "completed_at" = CURRENT_TIMESTAMP WHERE "id" = $1',
    [roundId],
  );
}

async function markRoundHandoffSent(dataSource: DataSource, roundId: string): Promise<void> {
  await dataSource.query(
    `INSERT INTO "interview_customer_handoffs" (
      "id", "project_id", "round_id", "version", "state", "sent_at"
    ) SELECT $1, "project_id", "id", 1, 'SENT', CURRENT_TIMESTAMP
      FROM "interview_rounds" WHERE "id" = $2`,
    [randomUUID(), roundId],
  );
}

function createDatabaseUrlWithName(
  databaseUrl: string,
  databaseName: string,
): string {
  const parsedUrl = new URL(databaseUrl);
  parsedUrl.pathname = `/${databaseName}`;
  return parsedUrl.toString();
}

async function observeQueryOutcomeOrLockWait(
  dataSource: DataSource,
  backendPid: number,
  getOutcome: () => 'completed' | 'pending' | 'rejected',
): Promise<'blocked' | 'completed' | 'rejected'> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const outcome = getOutcome();
    if (outcome !== 'pending') return outcome;
    const activityRows = await dataSource.query<Array<{ waitEventType: string | null }>>(
      `SELECT "wait_event_type" AS "waitEventType"
       FROM "pg_stat_activity"
       WHERE "pid" = $1`,
      [backendPid],
    );
    if (activityRows[0]?.waitEventType === 'Lock') return 'blocked';
    await delay(10);
  }
  throw new Error(`PostgreSQL backend ${backendPid} did not finish or enter a lock wait.`);
}


async function insertMoveFixture(dataSource: DataSource): Promise<RoundFixture> {
  const { projectId, schemaId, baseQuestionId } = await insertProjectSchema(
    dataSource,
    `R2 answer identity ${Date.now()}`,
  );
  const source = await insertRound(dataSource, projectId, schemaId, baseQuestionId, 'TEXT');
  const destination = await insertRound(
    dataSource,
    projectId,
    schemaId,
    baseQuestionId,
    'TEXT',
    'STAKEHOLDER',
  );

  await dataSource.query(
    'INSERT INTO "round_answers" ("id", "round_id", "snapshot_id", "value") VALUES ($1, $2, $3, $4)',
    [randomUUID(), source.roundId, source.snapshotId, JSON.stringify('Completed answer')],
  );
  await dataSource.query(
    'UPDATE "interview_rounds" SET "status" = \'ENDED\', "completed_at" = CURRENT_TIMESTAMP WHERE "id" = $1',
    [source.roundId],
  );
  await markRoundHandoffSent(dataSource, source.roundId);

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
      migrations: [...migrationsForFreshDatabase()],
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
          ...migrationsForHistoricalDatabase(
            'QuestionsRounds0002QuestionsRounds1786003200000',
          ),
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
          ...migrationsForHistoricalDatabase(
            'InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000',
          ),
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
      /open meeting|revision draft|completed|immutable/i,
    );

    const preservedRows = await dataSource.query<Array<{ roundId: string; snapshotId: string }>>(
      'SELECT "round_id" AS "roundId", "snapshot_id" AS "snapshotId" FROM "round_answers" WHERE "id" = $1',
      [answerRows[0].id],
    );
    assert.deepEqual(preservedRows, [
      { roundId: fixture.sourceRoundId, snapshotId: fixture.sourceSnapshotId },
    ]);
  });

  it('allows meeting end when a required answer has the wrong JSON type', async () => {
    const { projectId, schemaId, baseQuestionId } = await insertProjectSchema(
      dataSource,
      `R2 completion type ${Date.now()}`,
    );
    const round = await insertRound(dataSource, projectId, schemaId, baseQuestionId, 'DATE');
    await dataSource.query(
      'INSERT INTO "round_answers" ("id", "round_id", "snapshot_id", "value") VALUES ($1, $2, $3, $4)',
      [randomUUID(), round.roundId, round.snapshotId, JSON.stringify(true)],
    );

    await assert.doesNotReject(
      dataSource.query(
        'UPDATE "interview_rounds" SET "status" = \'ENDED\', "completed_at" = CURRENT_TIMESTAMP WHERE "id" = $1',
        [round.roundId],
      ),
    );

    const roundRows = await dataSource.query<Array<{ completedAt: Date | null; status: string }>>(
      'SELECT "status", "completed_at" AS "completedAt" FROM "interview_rounds" WHERE "id" = $1',
      [round.roundId],
    );
    assert.equal(roundRows[0].status, 'ENDED');
    assert.notEqual(roundRows[0].completedAt, null);
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
        assert.equal(error.constraint, 'uq_interview_rounds_open_type');
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
      'UPDATE "interview_rounds" SET "status" = \'ENDED\', "completed_at" = CURRENT_TIMESTAMP WHERE "id" = $1',
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
      { id: completedRoundId, status: 'ENDED', type: 'INITIAL_INTAKE' },
      { id: laterOpenRoundId, status: 'OPEN', type: 'INITIAL_INTAKE' },
    ]);
  });

  it('rejects an assessment override whose snapshot belongs to another round', async () => {
    const { projectId, schemaId, baseQuestionId } = await insertProjectSchema(
      dataSource,
      `SCORE-01 cross-round override ${Date.now()}`,
    );
    const sourceRound = await insertRound(
      dataSource,
      projectId,
      schemaId,
      baseQuestionId,
      'TEXT',
    );
    const otherRound = await insertRound(
      dataSource,
      projectId,
      schemaId,
      baseQuestionId,
      'TEXT',
      'STAKEHOLDER',
    );

    await assert.rejects(
      insertAssessmentOverride(
        dataSource,
        sourceRound.roundId,
        otherRound.snapshotId,
        'Nem releváns',
        'A kérdés nem tartozik ehhez a projekthez.',
      ),
      (error: { code?: string; constraint?: string }) => {
        assert.equal(error.code, '23503');
        assert.equal(
          error.constraint,
          'fk_round_question_assessment_overrides_round_snapshot',
        );
        return true;
      },
    );
  });

  it('allows only one assessment override for a round snapshot', async () => {
    const fixture = await insertAssessmentFixture(
      dataSource,
      `SCORE-01 unique override ${Date.now()}`,
    );
    await insertAssessmentOverride(
      dataSource,
      fixture.roundId,
      fixture.snapshotId,
      'Nem releváns',
      'A kérdés nem tartozik ehhez a projekthez.',
    );

    await assert.rejects(
      insertAssessmentOverride(
        dataSource,
        fixture.roundId,
        fixture.snapshotId,
        'Nem releváns',
        'Második indoklás.',
      ),
      (error: { code?: string; constraint?: string }) => {
        assert.equal(error.code, '23505');
        assert.equal(error.constraint, 'uq_round_question_assessment_overrides_round_snapshot');
        return true;
      },
    );

    const rows = await dataSource.query<Array<{ count: string }>>(
      'SELECT COUNT(*)::text AS "count" FROM "round_question_assessment_overrides" WHERE "round_id" = $1 AND "snapshot_id" = $2',
      [fixture.roundId, fixture.snapshotId],
    );
    assert.deepEqual(rows, [{ count: '1' }]);
  });

  it('rejects invalid assessment status and rationale combinations', async () => {
    const fixture = await insertAssessmentFixture(
      dataSource,
      `SCORE-01 assessment checks ${Date.now()}`,
    );
    await insertValidTextAnswer(dataSource, fixture.roundId, fixture.snapshotId);
    const invalidInputs: ReadonlyArray<readonly [string, string | null]> = [
      ['Kész', null],
      ['Nem releváns', '   '],
      ['Részben megvan', 'A részleges állapot nem tárol indoklást.'],
      ['Nem releváns', 'x'.repeat(10_001)],
    ];

    for (const [status, rationale] of invalidInputs) {
      await assert.rejects(
        insertAssessmentOverride(
          dataSource,
          fixture.roundId,
          fixture.snapshotId,
          status,
          rationale,
        ),
        (error: { code?: string; constraint?: string }) => {
          assert.equal(error.code, '23514');
          assert.equal(error.constraint, 'chk_round_question_assessment_overrides_state');
          return true;
        },
      );
    }

    const rows = await dataSource.query<Array<{ count: string }>>(
      'SELECT COUNT(*)::text AS "count" FROM "round_question_assessment_overrides" WHERE "round_id" = $1',
      [fixture.roundId],
    );
    assert.deepEqual(rows, [{ count: '0' }]);
  });

  it('rejects tab and newline only not-relevant rationales', async () => {
    const whitespaceOnlyRationales = ['\t', '\n', '\r\n\t'];

    for (const rationale of whitespaceOnlyRationales) {
      const fixture = await insertAssessmentFixture(
        dataSource,
        `SCORE-01 whitespace rationale ${Date.now()} ${randomUUID()}`,
      );
      await assert.rejects(
        insertAssessmentOverride(
          dataSource,
          fixture.roundId,
          fixture.snapshotId,
          'Nem releváns',
          rationale,
        ),
        (error: { code?: string; constraint?: string }) => {
          assert.equal(error.code, '23514');
          assert.equal(error.constraint, 'chk_round_question_assessment_overrides_state');
          return true;
        },
      );
    }
  });

  it('rejects partial assessment without a valid answer', async () => {
    const missingAnswerFixture = await insertAssessmentFixture(
      dataSource,
      `SCORE-01 partial without answer ${Date.now()}`,
    );

    await assert.rejects(
      insertAssessmentOverride(
        dataSource,
        missingAnswerFixture.roundId,
        missingAnswerFixture.snapshotId,
        'Részben megvan',
        null,
      ),
      (error: { code?: string; message?: string }) => {
        assert.equal(error.code, '23514');
        assert.match(error.message ?? '', /partial assessment requires a valid answer/i);
        return true;
      },
    );

    const invalidAnswerFixture = await insertAssessmentFixture(
      dataSource,
      `SCORE-01 partial invalid answer ${Date.now()}`,
    );
    await dataSource.query(
      'INSERT INTO "round_answers" ("id", "round_id", "snapshot_id", "value") VALUES ($1, $2, $3, $4)',
      [
        randomUUID(),
        invalidAnswerFixture.roundId,
        invalidAnswerFixture.snapshotId,
        JSON.stringify(''),
      ],
    );

    await assert.rejects(
      insertAssessmentOverride(
        dataSource,
        invalidAnswerFixture.roundId,
        invalidAnswerFixture.snapshotId,
        'Részben megvan',
        null,
      ),
      (error: { code?: string; message?: string }) => {
        assert.equal(error.code, '23514');
        assert.match(error.message ?? '', /partial assessment requires a valid answer/i);
        return true;
      },
    );
  });

  it('prevents answer deletion or invalidation while partial assessment exists', async () => {
    const fixture = await insertAssessmentFixture(
      dataSource,
      `SCORE-01 partial answer protection ${Date.now()}`,
    );
    const answerId = await insertValidTextAnswer(
      dataSource,
      fixture.roundId,
      fixture.snapshotId,
    );
    await insertAssessmentOverride(
      dataSource,
      fixture.roundId,
      fixture.snapshotId,
      'Részben megvan',
      null,
    );

    await assert.rejects(
      dataSource.query('DELETE FROM "round_answers" WHERE "id" = $1', [answerId]),
      (error: { code?: string; message?: string }) => {
        assert.equal(error.code, '23514');
        assert.match(error.message ?? '', /partial assessment requires a valid answer/i);
        return true;
      },
    );
    await assert.rejects(
      dataSource.query('UPDATE "round_answers" SET "value" = $1 WHERE "id" = $2', [
        JSON.stringify(''),
        answerId,
      ]),
      (error: { code?: string; message?: string }) => {
        assert.equal(error.code, '23514');
        assert.match(error.message ?? '', /partial assessment requires a valid answer/i);
        return true;
      },
    );

    const answerRows = await dataSource.query<Array<{ value: unknown }>>(
      'SELECT "value" FROM "round_answers" WHERE "id" = $1',
      [answerId],
    );
    const overrideRows = await dataSource.query<Array<{ status: string }>>(
      'SELECT "status" FROM "round_question_assessment_overrides" WHERE "round_id" = $1 AND "snapshot_id" = $2',
      [fixture.roundId, fixture.snapshotId],
    );
    assert.deepEqual(answerRows, [{ value: 'Valid assessment evidence' }]);
    assert.deepEqual(overrideRows, [{ status: 'Részben megvan' }]);
  });

  it('allows meeting end when a valid answer is assessed as partial', async () => {
    const fixture = await insertAssessmentFixture(
      dataSource,
      `SCORE-01 partial completion ${Date.now()}`,
    );
    await insertValidTextAnswer(dataSource, fixture.roundId, fixture.snapshotId);
    await insertAssessmentOverride(
      dataSource,
      fixture.roundId,
      fixture.snapshotId,
      'Részben megvan',
      null,
    );

    await assert.doesNotReject(completeRound(dataSource, fixture.roundId));

    const roundRows = await dataSource.query<Array<{ completedAt: Date | null; status: string }>>(
      'SELECT "status", "completed_at" AS "completedAt" FROM "interview_rounds" WHERE "id" = $1',
      [fixture.roundId],
    );
    assert.equal(roundRows[0].status, 'ENDED');
    assert.notEqual(roundRows[0].completedAt, null);
  });

  it('rejects explicit whitespace-only TEXT and LONG_TEXT answers for partial assessment', async () => {
    const textQuestionTypes = ['TEXT', 'LONG_TEXT'] as const;
    const outcomes = await Promise.all(
      textQuestionTypes.map(async (questionType) => {
        const { projectId, schemaId, baseQuestionId } = await insertProjectSchema(
          dataSource,
          `SCORE-01 partial whitespace ${questionType} ${Date.now()} ${randomUUID()}`,
        );
        const round = await insertRound(
          dataSource,
          projectId,
          schemaId,
          baseQuestionId,
          questionType,
        );
        await dataSource.query(
          `INSERT INTO "round_answers" ("id", "round_id", "snapshot_id", "value")
           VALUES ($1, $2, $3, $4)`,
          [randomUUID(), round.roundId, round.snapshotId, JSON.stringify(' \t\n\r\f\v')],
        );

        try {
          await insertAssessmentOverride(
            dataSource,
            round.roundId,
            round.snapshotId,
            'Részben megvan',
            null,
          );
          return 'accepted';
        } catch (error) {
          return (error as { code?: string }).code ?? 'rejected-without-code';
        }
      }),
    );

    assert.deepEqual(outcomes, ['23514', '23514']);
  });

  it('allows meeting end for explicit whitespace-only TEXT and LONG_TEXT answers', async () => {
    const textQuestionTypes = ['TEXT', 'LONG_TEXT'] as const;
    const outcomes = await Promise.all(
      textQuestionTypes.map(async (questionType) => {
        const { projectId, schemaId, baseQuestionId } = await insertProjectSchema(
          dataSource,
          `SCORE-01 completion whitespace ${questionType} ${Date.now()} ${randomUUID()}`,
        );
        const round = await insertRound(
          dataSource,
          projectId,
          schemaId,
          baseQuestionId,
          questionType,
        );
        await dataSource.query(
          `INSERT INTO "round_answers" ("id", "round_id", "snapshot_id", "value")
           VALUES ($1, $2, $3, $4)`,
          [randomUUID(), round.roundId, round.snapshotId, JSON.stringify(' \t\n\r\f\v')],
        );

        try {
          await completeRound(dataSource, round.roundId);
          return 'completed';
        } catch (error) {
          return (error as { code?: string }).code ?? 'rejected-without-code';
        }
      }),
    );

    assert.deepEqual(outcomes, ['completed', 'completed']);
  });

  it('accepts year 0001 at the PostgreSQL answer-validation boundary', async () => {
    const { projectId, schemaId, baseQuestionId } = await insertProjectSchema(
      dataSource,
      `SCORE-01 early date ${Date.now()}`,
    );
    const round = await insertRound(dataSource, projectId, schemaId, baseQuestionId, 'DATE');
    await dataSource.query(
      `INSERT INTO "round_answers" ("id", "round_id", "snapshot_id", "value")
       VALUES ($1, $2, $3, $4)`,
      [randomUUID(), round.roundId, round.snapshotId, JSON.stringify('0001-01-01')],
    );

    await completeRound(dataSource, round.roundId);

    const roundRows = await dataSource.query<Array<{ status: string }>>(
      'SELECT "status" FROM "interview_rounds" WHERE "id" = $1',
      [round.roundId],
    );
    assert.deepEqual(roundRows, [{ status: 'ENDED' }]);
  });

  it('uses PostgreSQL character counts for assessment rationale boundaries', async () => {
    const acceptedFixture = await insertAssessmentFixture(
      dataSource,
      `SCORE-01 emoji accepted ${Date.now()}`,
    );
    const acceptedRationale = '😀'.repeat(6_000);
    await insertAssessmentOverride(
      dataSource,
      acceptedFixture.roundId,
      acceptedFixture.snapshotId,
      'Nem releváns',
      acceptedRationale,
    );
    const acceptedRows = await dataSource.query<Array<{ length: string }>>(
      `SELECT char_length("rationale")::text AS "length"
       FROM "round_question_assessment_overrides"
       WHERE "round_id" = $1 AND "snapshot_id" = $2`,
      [acceptedFixture.roundId, acceptedFixture.snapshotId],
    );
    assert.deepEqual(acceptedRows, [{ length: '6000' }]);

    const rejectedFixture = await insertAssessmentFixture(
      dataSource,
      `SCORE-01 emoji rejected ${Date.now()}`,
    );
    await assert.rejects(
      insertAssessmentOverride(
        dataSource,
        rejectedFixture.roundId,
        rejectedFixture.snapshotId,
        'Nem releváns',
        '😀'.repeat(10_001),
      ),
      (error: { code?: string; constraint?: string }) => {
        assert.equal(error.code, '23514');
        assert.equal(error.constraint, 'chk_round_question_assessment_overrides_state');
        return true;
      },
    );
  });

  it('allows a justified not-relevant required snapshot to complete without an answer', async () => {
    const fixture = await insertAssessmentFixture(
      dataSource,
      `SCORE-01 not-relevant completion ${Date.now()}`,
    );
    await insertAssessmentOverride(
      dataSource,
      fixture.roundId,
      fixture.snapshotId,
      'Nem releváns',
      'A kérdés igazoltan nem tartozik ehhez a projekthez.',
    );

    await completeRound(dataSource, fixture.roundId);

    const roundRows = await dataSource.query<Array<{ completedAt: Date | null; status: string }>>(
      'SELECT "status", "completed_at" AS "completedAt" FROM "interview_rounds" WHERE "id" = $1',
      [fixture.roundId],
    );
    const answerRows = await dataSource.query<Array<{ count: string }>>(
      'SELECT COUNT(*)::text AS "count" FROM "round_answers" WHERE "round_id" = $1',
      [fixture.roundId],
    );
    assert.equal(roundRows.length, 1);
    assert.equal(roundRows[0].status, 'ENDED');
    assert.notEqual(roundRows[0].completedAt, null);
    assert.deepEqual(answerRows, [{ count: '0' }]);
  });

  it('serializes a partial assessment with concurrent meeting end', async () => {
    const fixture = await insertAssessmentFixture(
      dataSource,
      `SCORE-01 concurrent completion ${Date.now()}`,
    );
    await insertValidTextAnswer(dataSource, fixture.roundId, fixture.snapshotId);
    const assessmentRunner = dataSource.createQueryRunner();
    const completionRunner = dataSource.createQueryRunner();
    await assessmentRunner.connect();
    await completionRunner.connect();

    try {
      await assessmentRunner.startTransaction();
      await assessmentRunner.query(
        `INSERT INTO "round_question_assessment_overrides" (
          "id", "round_id", "snapshot_id", "status", "rationale"
        ) VALUES ($1, $2, $3, 'Részben megvan', NULL)`,
        [randomUUID(), fixture.roundId, fixture.snapshotId],
      );

      await completionRunner.startTransaction();
      const backendRows = (await completionRunner.query(
        'SELECT pg_backend_pid() AS "pid"',
      )) as Array<{ pid: number }>;
      let completionOutcome: 'completed' | 'pending' | 'rejected' = 'pending';
      const completionPromise = completionRunner.query(
        'UPDATE "interview_rounds" SET "status" = \'ENDED\', "completed_at" = CURRENT_TIMESTAMP WHERE "id" = $1',
        [fixture.roundId],
      );
      void completionPromise.then(
        () => {
          completionOutcome = 'completed';
        },
        () => {
          completionOutcome = 'rejected';
        },
      );

      const observedOutcome = await observeQueryOutcomeOrLockWait(
        dataSource,
        backendRows[0].pid,
        () => completionOutcome,
      );
      assert.equal(observedOutcome, 'blocked');

      await assessmentRunner.commitTransaction();
      await assert.doesNotReject(completionPromise);
      await completionRunner.commitTransaction();
    } finally {
      if (completionRunner.isTransactionActive) {
        await completionRunner.rollbackTransaction();
      }
      if (assessmentRunner.isTransactionActive) {
        await assessmentRunner.rollbackTransaction();
      }
      await completionRunner.release();
      await assessmentRunner.release();
    }

    const roundRows = await dataSource.query<Array<{ completedAt: Date | null; status: string }>>(
      'SELECT "status", "completed_at" AS "completedAt" FROM "interview_rounds" WHERE "id" = $1',
      [fixture.roundId],
    );
    assert.equal(roundRows[0].status, 'ENDED');
    assert.notEqual(roundRows[0].completedAt, null);
  });

  it('serializes partial assessment creation with concurrent answer deletion', async () => {
    const fixture = await insertAssessmentFixture(
      dataSource,
      `SCORE-01 concurrent answer delete ${Date.now()}`,
    );
    const answerId = await insertValidTextAnswer(
      dataSource,
      fixture.roundId,
      fixture.snapshotId,
    );
    const answerRunner = dataSource.createQueryRunner();
    const assessmentRunner = dataSource.createQueryRunner();
    await answerRunner.connect();
    await assessmentRunner.connect();

    try {
      await answerRunner.startTransaction();
      await answerRunner.query('DELETE FROM "round_answers" WHERE "id" = $1', [answerId]);

      await assessmentRunner.startTransaction();
      const backendRows = (await assessmentRunner.query(
        'SELECT pg_backend_pid() AS "pid"',
      )) as Array<{ pid: number }>;
      let assessmentOutcome: 'completed' | 'pending' | 'rejected' = 'pending';
      const assessmentPromise = assessmentRunner.query(
        `INSERT INTO "round_question_assessment_overrides" (
          "id", "round_id", "snapshot_id", "status", "rationale"
        ) VALUES ($1, $2, $3, 'Részben megvan', NULL)`,
        [randomUUID(), fixture.roundId, fixture.snapshotId],
      );
      void assessmentPromise.then(
        () => {
          assessmentOutcome = 'completed';
        },
        () => {
          assessmentOutcome = 'rejected';
        },
      );

      const observedOutcome = await observeQueryOutcomeOrLockWait(
        dataSource,
        backendRows[0].pid,
        () => assessmentOutcome,
      );
      assert.equal(observedOutcome, 'blocked');

      await answerRunner.commitTransaction();
      await assert.rejects(
        assessmentPromise,
        (error: { code?: string; message?: string }) => {
          assert.equal(error.code, '23514');
          assert.match(error.message ?? '', /partial assessment requires a valid answer/i);
          return true;
        },
      );
      await assessmentRunner.rollbackTransaction();
    } finally {
      if (assessmentRunner.isTransactionActive) {
        await assessmentRunner.rollbackTransaction();
      }
      if (answerRunner.isTransactionActive) {
        await answerRunner.rollbackTransaction();
      }
      await assessmentRunner.release();
      await answerRunner.release();
    }

    const answerRows = await dataSource.query<Array<{ id: string }>>(
      'SELECT "id" FROM "round_answers" WHERE "id" = $1',
      [answerId],
    );
    const overrideRows = await dataSource.query<Array<{ id: string }>>(
      'SELECT "id" FROM "round_question_assessment_overrides" WHERE "round_id" = $1 AND "snapshot_id" = $2',
      [fixture.roundId, fixture.snapshotId],
    );
    assert.deepEqual(answerRows, []);
    assert.deepEqual(overrideRows, []);
  });

  it('rejects partial assessment after a concurrent answer invalidation commits', async () => {
    const fixture = await insertAssessmentFixture(
      dataSource,
      `SCORE-01 concurrent answer invalidation ${Date.now()}`,
    );
    const answerId = await insertValidTextAnswer(
      dataSource,
      fixture.roundId,
      fixture.snapshotId,
    );
    const roundLockRunner = dataSource.createQueryRunner();
    const assessmentRunner = dataSource.createQueryRunner();
    const invalidationRunner = dataSource.createQueryRunner();
    await roundLockRunner.connect();
    await assessmentRunner.connect();
    await invalidationRunner.connect();

    try {
      await roundLockRunner.startTransaction();
      await roundLockRunner.query(
        'SELECT "id" FROM "interview_rounds" WHERE "id" = $1 FOR UPDATE',
        [fixture.roundId],
      );

      await invalidationRunner.startTransaction();
      const backendRows = (await invalidationRunner.query(
        'SELECT pg_backend_pid() AS "pid"',
      )) as Array<{ pid: number }>;
      let invalidationOutcome: 'completed' | 'pending' | 'rejected' = 'pending';
      const invalidationPromise = invalidationRunner.query(
        'UPDATE "round_answers" SET "value" = $1 WHERE "id" = $2',
        [JSON.stringify(''), answerId],
      );
      void invalidationPromise.then(
        () => {
          invalidationOutcome = 'completed';
        },
        () => {
          invalidationOutcome = 'rejected';
        },
      );

      const observedOutcome = await observeQueryOutcomeOrLockWait(
        dataSource,
        backendRows[0].pid,
        () => invalidationOutcome,
      );
      assert.equal(observedOutcome, 'blocked');

      await assessmentRunner.startTransaction();
      const assessmentBackendRows = (await assessmentRunner.query(
        'SELECT pg_backend_pid() AS "pid"',
      )) as Array<{ pid: number }>;
      let assessmentOutcome: 'completed' | 'pending' | 'rejected' = 'pending';
      const assessmentPromise = assessmentRunner.query(
        `INSERT INTO "round_question_assessment_overrides" (
          "id", "round_id", "snapshot_id", "status", "rationale"
        ) VALUES ($1, $2, $3, 'Részben megvan', NULL)`,
        [randomUUID(), fixture.roundId, fixture.snapshotId],
      );
      void assessmentPromise.then(
        () => {
          assessmentOutcome = 'completed';
        },
        () => {
          assessmentOutcome = 'rejected';
        },
      );

      const observedAssessmentOutcome = await observeQueryOutcomeOrLockWait(
        dataSource,
        assessmentBackendRows[0].pid,
        () => assessmentOutcome,
      );
      assert.equal(observedAssessmentOutcome, 'blocked');

      await roundLockRunner.commitTransaction();
      await invalidationPromise;
      await invalidationRunner.commitTransaction();
      await assert.rejects(
        assessmentPromise,
        (error: { code?: string; message?: string }) => {
          assert.equal(error.code, '23514');
          assert.match(error.message ?? '', /partial assessment requires a valid answer/i);
          return true;
        },
      );
      await assessmentRunner.rollbackTransaction();
    } finally {
      if (roundLockRunner.isTransactionActive) {
        await roundLockRunner.rollbackTransaction();
      }
      if (invalidationRunner.isTransactionActive) {
        await invalidationRunner.rollbackTransaction();
      }
      if (assessmentRunner.isTransactionActive) {
        await assessmentRunner.rollbackTransaction();
      }
      await roundLockRunner.release();
      await invalidationRunner.release();
      await assessmentRunner.release();
    }

    const answerRows = await dataSource.query<Array<{ value: unknown }>>(
      'SELECT "value" FROM "round_answers" WHERE "id" = $1',
      [answerId],
    );
    const overrideRows = await dataSource.query<Array<{ status: string }>>(
      'SELECT "status" FROM "round_question_assessment_overrides" WHERE "round_id" = $1 AND "snapshot_id" = $2',
      [fixture.roundId, fixture.snapshotId],
    );
    assert.deepEqual(answerRows, [{ value: '' }]);
    assert.deepEqual(overrideRows, []);
  });

  it('rejects every assessment override mutation after a handoff is sent', async () => {
    const insertFixture = await insertAssessmentFixture(
      dataSource,
      `SCORE-01 completed insert ${Date.now()}`,
    );
    await insertValidTextAnswer(dataSource, insertFixture.roundId, insertFixture.snapshotId);
    await completeRound(dataSource, insertFixture.roundId);
    await markRoundHandoffSent(dataSource, insertFixture.roundId);

    await assert.rejects(
      insertAssessmentOverride(
        dataSource,
        insertFixture.roundId,
        insertFixture.snapshotId,
        'Nem releváns',
        'Utólagos állapot nem engedélyezett.',
      ),
      (error: { code?: string; message?: string }) => {
        assert.equal(error.code, '55000');
        assert.match(error.message ?? '', /active interview revision draft|open meeting/i);
        return true;
      },
    );

    const persistedFixture = await insertAssessmentFixture(
      dataSource,
      `SCORE-01 completed update delete ${Date.now()}`,
    );
    const overrideId = await insertAssessmentOverride(
      dataSource,
      persistedFixture.roundId,
      persistedFixture.snapshotId,
      'Nem releváns',
      'A kérdés igazoltan nem releváns.',
    );
    await completeRound(dataSource, persistedFixture.roundId);
    await markRoundHandoffSent(dataSource, persistedFixture.roundId);

    await assert.rejects(
      dataSource.query(
        'UPDATE "round_question_assessment_overrides" SET "rationale" = $1 WHERE "id" = $2',
        ['Módosított indoklás.', overrideId],
      ),
      (error: { code?: string; message?: string }) => {
        assert.equal(error.code, '55000');
        assert.match(error.message ?? '', /active interview revision draft|open meeting/i);
        return true;
      },
    );
    await assert.rejects(
      dataSource.query('DELETE FROM "round_question_assessment_overrides" WHERE "id" = $1', [
        overrideId,
      ]),
      (error: { code?: string; message?: string }) => {
        assert.equal(error.code, '55000');
        assert.match(error.message ?? '', /active interview revision draft|open meeting/i);
        return true;
      },
    );

    const rows = await dataSource.query<Array<{ rationale: string; status: string }>>(
      'SELECT "status", "rationale" FROM "round_question_assessment_overrides" WHERE "id" = $1',
      [overrideId],
    );
    assert.deepEqual(rows, [
      { rationale: 'A kérdés igazoltan nem releváns.', status: 'Nem releváns' },
    ]);
  });





});
