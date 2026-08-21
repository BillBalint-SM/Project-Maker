import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import request from 'supertest';
import { DataSource, type QueryRunner } from 'typeorm';
import type { AnswerValue, BaseQuestionType, GeneralPlaybook } from '@project-maker/contracts';
import { loadGeneralPlaybookV1 } from '@project-maker/contracts/general-playbook-runtime';

import { AppModule } from '../src/app.module';
import { migrationsForFreshDatabase } from './migration-harness';

describe('Question-rounds disposable database guard', () => {
  it('rejects unsafe PostgreSQL hosts and database names', () => {
    assert.throws(
      () =>
        assertDisposableQuestionRoundsDatabaseUrl(
          'postgresql://database.example.test/score01_e2e',
        ),
      /loopback PostgreSQL host/,
    );
    assert.throws(
      () => assertDisposableQuestionRoundsDatabaseUrl('postgresql://localhost/production'),
      /database whose name contains score01, e2e, or test/,
    );
    assert.doesNotThrow(() =>
      assertDisposableQuestionRoundsDatabaseUrl('postgresql://[::1]/score01_e2e'),
    );
  });
});

describe('Question bank and interview rounds (PostgreSQL e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let controlDataSource: DataSource;
  let databaseUrl: string;
  let apiApplicationName: string;
  let originalDatabaseUrl: string | undefined;

  before(async () => {
    const configuredDatabaseUrl = process.env['DATABASE_URL'];
    if (!configuredDatabaseUrl) {
      throw new Error('DATABASE_URL is required for the real PostgreSQL R2 proof.');
    }
    assertDisposableQuestionRoundsDatabaseUrl(configuredDatabaseUrl);
    databaseUrl = configuredDatabaseUrl;

    const migrationDataSource = new DataSource({
      type: 'postgres',
      url: databaseUrl,
      synchronize: false,
      migrations: [...migrationsForFreshDatabase()],
    });
    await migrationDataSource.initialize();
    await migrationDataSource.runMigrations();
    await migrationDataSource.destroy();

    originalDatabaseUrl = process.env['DATABASE_URL'];
    apiApplicationName = `score01-question-rounds-api-${randomUUID().replaceAll('-', '')}`;
    process.env['DATABASE_URL'] = createDatabaseUrlWithApplicationName(
      databaseUrl,
      apiApplicationName,
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication({ logger: false });
    await app.init();
    dataSource = app.get(DataSource);

    controlDataSource = new DataSource({
      type: 'postgres',
      url: databaseUrl,
      synchronize: false,
    });
    await controlDataSource.initialize();
  });

  after(async () => {
    await controlDataSource.destroy();
    await app.close();
    if (originalDatabaseUrl === undefined) {
      delete process.env['DATABASE_URL'];
    } else {
      process.env['DATABASE_URL'] = originalDatabaseUrl;
    }
  });

  it('returns null from the active-round endpoint before the first initial intake round', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `Active null ${Date.now()}`,
      'active-null',
    );

    const activeRoundResponse = await request(app.getHttpServer())
      .get(`/projects/${projectId}/rounds/active`)
      .expect(200);

    assert.equal(activeRoundResponse.body, null);
  });

  it('rejects every interview mutation while the project is archived', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `Archived interview ${Date.now()}`,
      'archived-interview',
    );
    const round = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const roundId = round.body.id as string;
    const snapshotId = round.body.questions[0].id as string;
    const assessmentUrl =
      `/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}/assessment`;

    await request(app.getHttpServer()).post(`/projects/${projectId}/archive`).expect(201);
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}`)
      .send({ value: 'Archived write must fail' })
      .expect(409);
    await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Nem releváns', rationale: 'Archivált projekt nem módosítható.' })
      .expect(409);
    await request(app.getHttpServer()).delete(assessmentUrl).expect(409);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/complete`)
      .expect(409);

    const archivedBeforeStart = await createProjectWithSingleQuestionSchema(
      app,
      `Archived round start ${Date.now()}`,
      'archived-round-start',
    );
    await request(app.getHttpServer())
      .post(`/projects/${archivedBeforeStart.projectId}/archive`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${archivedBeforeStart.projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(409);
  });

  it('projects canonical missing and complete assessment states from answer validity', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `Assessment inference ${Date.now()}`,
      'assessment-inference',
    );
    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const roundId = createdRoundResponse.body.id as string;
    const snapshotId = createdRoundResponse.body.questions[0].id as string;

    assert.equal(createdRoundResponse.body.questions[0].checklistStatus, 'Nincs meg');
    assert.equal(createdRoundResponse.body.questions[0].assessmentRationale, null);

    const savedAnswerResponse = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}`)
      .send({ value: 'Canonical complete evidence' })
      .expect(200);

    assert.equal(savedAnswerResponse.body.checklistStatus, 'Kész');
    assert.equal(savedAnswerResponse.body.assessmentRationale, null);

    const activeRoundResponse = await request(app.getHttpServer())
      .get(`/projects/${projectId}/rounds/active`)
      .expect(200);
    assert.equal(activeRoundResponse.body.questions[0].checklistStatus, 'Kész');
    assert.equal(activeRoundResponse.body.questions[0].assessmentRationale, null);
  });

  it('rejects explicit whitespace-only TEXT and LONG_TEXT answers through the public API', async () => {
    const { projectId, stableKeys } = await createProjectWithQuestionTypesSchema(
      app,
      `Assessment answer whitespace ${Date.now()}`,
      'assessment-answer-whitespace',
      ['TEXT', 'LONG_TEXT'],
    );
    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'STAKEHOLDER', selectedStableKeys: stableKeys })
      .expect(201);

    const questions = createdRoundResponse.body.questions as Array<{
      id: string;
      type: string;
    }>;
    for (const questionType of ['TEXT', 'LONG_TEXT']) {
      const question = questions.find((candidate) => candidate.type === questionType);
      if (!question) {
        throw new Error(`Expected a ${questionType} snapshot in the created round.`);
      }
      await request(app.getHttpServer())
        .patch(
          `/projects/${projectId}/rounds/${createdRoundResponse.body.id}/answers/${question.id}`,
        )
        .send({ value: '\t\n\r\f\v' })
        .expect(400);
    }
  });

  it('accepts the PostgreSQL-valid early calendar year through the public API', async () => {
    const { projectId, stableKeys } = await createProjectWithQuestionTypesSchema(
      app,
      `Assessment early date ${Date.now()}`,
      'assessment-early-date',
      ['DATE'],
    );
    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'STAKEHOLDER', selectedStableKeys: stableKeys })
      .expect(201);
    const snapshotId = createdRoundResponse.body.questions[0].id as string;

    const answerResponse = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/rounds/${createdRoundResponse.body.id}/answers/${snapshotId}`)
      .send({ value: '0001-01-01' })
      .expect(200);
    assert.equal(answerResponse.body.answer, '0001-01-01');
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${createdRoundResponse.body.id}/complete`)
      .expect(201);
  });

  it('measures normalized assessment rationales in Unicode code points', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `Assessment emoji rationale ${Date.now()}`,
      'assessment-emoji-rationale',
    );
    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const roundId = createdRoundResponse.body.id as string;
    const snapshotId = createdRoundResponse.body.questions[0].id as string;
    const assessmentUrl =
      `/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}/assessment`;

    const acceptedRationale = '😀'.repeat(6_000);
    const acceptedResponse = await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Nem releváns', rationale: acceptedRationale })
      .expect(200);
    assert.equal(acceptedResponse.body.assessmentRationale, acceptedRationale);

    await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Nem releváns', rationale: '😀'.repeat(10_001) })
      .expect(400);
  });

  it('serializes two concurrent first answer writes and preserves the later mutation', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `First answer serialization ${Date.now()}`,
      'first-answer-serialization',
    );
    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const roundId = createdRoundResponse.body.id as string;
    const snapshotId = createdRoundResponse.body.questions[0].id as string;
    const answerUrl = `/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}`;
    const firstValue = 'First concurrent answer evidence';
    const laterValue = 'Later concurrent answer evidence';

    const { creatorResponse, waitingResponse } = await serializeAcrossFirstChildInsert(
      controlDataSource,
      apiApplicationName,
      'round_answers',
      async () => request(app.getHttpServer()).patch(answerUrl).send({ value: firstValue }),
      async () => request(app.getHttpServer()).patch(answerUrl).send({ value: laterValue }),
    );

    assert.equal(creatorResponse.status, 200);
    assert.equal(waitingResponse.status, 200);
    assert.equal(waitingResponse.body.answer, laterValue);
    const answerRows = await controlDataSource.query<Array<{ value: string }>>(
      `SELECT "value" FROM "round_answers"
       WHERE "round_id" = $1 AND "snapshot_id" = $2`,
      [roundId, snapshotId],
    );
    assert.deepEqual(answerRows, [{ value: laterValue }]);
  });

  it('serializes two concurrent first assessment writes and preserves the later decision', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `First assessment serialization ${Date.now()}`,
      'first-assessment-serialization',
    );
    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const roundId = createdRoundResponse.body.id as string;
    const snapshotId = createdRoundResponse.body.questions[0].id as string;
    const assessmentUrl =
      `/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}/assessment`;
    const firstRationale = 'First concurrent assessment rationale';
    const laterRationale = 'Later concurrent assessment rationale';

    const { creatorResponse, waitingResponse } = await serializeAcrossFirstChildInsert(
      controlDataSource,
      apiApplicationName,
      'round_question_assessment_overrides',
      async () =>
        request(app.getHttpServer())
          .put(assessmentUrl)
          .send({ status: 'Nem releváns', rationale: firstRationale }),
      async () =>
        request(app.getHttpServer())
          .put(assessmentUrl)
          .send({ status: 'Nem releváns', rationale: laterRationale }),
    );

    assert.equal(creatorResponse.status, 200);
    assert.equal(waitingResponse.status, 200);
    assert.equal(waitingResponse.body.checklistStatus, 'Nem releváns');
    assert.equal(waitingResponse.body.assessmentRationale, laterRationale);
    const overrideRows = await controlDataSource.query<
      Array<{ status: string; rationale: string }>
    >(
      `SELECT "status", "rationale" FROM "round_question_assessment_overrides"
       WHERE "round_id" = $1 AND "snapshot_id" = $2`,
      [roundId, snapshotId],
    );
    assert.deepEqual(overrideRows, [{ status: 'Nem releváns', rationale: laterRationale }]);
    assert.deepEqual(await loadAssessmentAuditEventTypes(controlDataSource, projectId), [
      'ROUND_QUESTION_ASSESSMENT_SAVED',
      'ROUND_QUESTION_ASSESSMENT_SAVED',
    ]);
  });

  it('removes a newly committed first assessment when reset waited on its round lock', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `First assessment reset serialization ${Date.now()}`,
      'first-assessment-reset-serialization',
    );
    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const roundId = createdRoundResponse.body.id as string;
    const snapshotId = createdRoundResponse.body.questions[0].id as string;
    const assessmentUrl =
      `/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}/assessment`;

    const { creatorResponse, waitingResponse } = await serializeAcrossFirstChildInsert(
      controlDataSource,
      apiApplicationName,
      'round_question_assessment_overrides',
      async () =>
        request(app.getHttpServer())
          .put(assessmentUrl)
          .send({
            status: 'Nem releváns',
            rationale: 'Assessment committed before the waiting reset',
          }),
      async () => request(app.getHttpServer()).delete(assessmentUrl),
    );

    assert.equal(creatorResponse.status, 200);
    assert.equal(waitingResponse.status, 200);
    assert.equal(waitingResponse.body.checklistStatus, 'Nincs meg');
    assert.equal(waitingResponse.body.assessmentRationale, null);
    const overrideRows = await controlDataSource.query<Array<{ id: string }>>(
      `SELECT "id" FROM "round_question_assessment_overrides"
       WHERE "round_id" = $1 AND "snapshot_id" = $2`,
      [roundId, snapshotId],
    );
    assert.deepEqual(overrideRows, []);
    assert.deepEqual(await loadAssessmentAuditEventTypes(controlDataSource, projectId), [
      'ROUND_QUESTION_ASSESSMENT_SAVED',
      'ROUND_QUESTION_ASSESSMENT_RESET',
    ]);
  });

  it('serializes an assessment PUT ahead of a direct answer update without a round-answer lock cycle', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `Assessment lock order ${Date.now()}`,
      'assessment-lock-order',
    );
    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const roundId = createdRoundResponse.body.id as string;
    const snapshotId = createdRoundResponse.body.questions[0].id as string;
    const answerId = randomUUID();
    await controlDataSource.query(
      `INSERT INTO "round_answers" ("id", "round_id", "snapshot_id", "value")
       VALUES ($1, $2, $3, $4)`,
      [answerId, roundId, snapshotId, JSON.stringify('Existing answer evidence')],
    );

    const gateLockKey = 91_103_403;
    const gateTriggerName = 'aaa_score01_assessment_gate';
    const gateFunctionName = 'score01_assessment_gate';
    const gateRunner = controlDataSource.createQueryRunner();
    const answerRunner = controlDataSource.createQueryRunner();
    let advisoryLockHeld = false;
    await gateRunner.connect();
    await answerRunner.connect();

    try {
      await controlDataSource.query(`
        CREATE OR REPLACE FUNCTION "${gateFunctionName}"()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          PERFORM pg_advisory_xact_lock(${gateLockKey}::bigint);
          RETURN NEW;
        END;
        $$
      `);
      await controlDataSource.query(`
        CREATE TRIGGER "${gateTriggerName}"
        BEFORE INSERT ON "round_question_assessment_overrides"
        FOR EACH ROW
        EXECUTE FUNCTION "${gateFunctionName}"()
      `);
      await gateRunner.query('SELECT pg_advisory_lock($1::bigint)', [gateLockKey]);
      advisoryLockHeld = true;

      let assessmentOutcome: 'completed' | 'pending' | 'rejected' = 'pending';
      const assessmentPromise = request(app.getHttpServer())
        .put(`/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}/assessment`)
        .send({ status: 'Részben megvan', rationale: null });
      void assessmentPromise.then(
        () => {
          assessmentOutcome = 'completed';
        },
        () => {
          assessmentOutcome = 'rejected';
        },
      );

      const assessmentWait = await observeApplicationOutcomeOrLockWait(
        controlDataSource,
        apiApplicationName,
        () => assessmentOutcome,
      );
      assert.equal(assessmentWait, 'blocked');

      await answerRunner.startTransaction();
      const backendRows = (await answerRunner.query(
        'SELECT pg_backend_pid() AS "pid"',
      )) as Array<{ pid: number }>;
      let answerOutcome: 'completed' | 'pending' | 'rejected' = 'pending';
      const answerUpdatePromise = answerRunner.query(
        'UPDATE "round_answers" SET "value" = $1 WHERE "id" = $2',
        [JSON.stringify('Concurrent valid answer evidence'), answerId],
      );
      void answerUpdatePromise.then(
        () => {
          answerOutcome = 'completed';
        },
        () => {
          answerOutcome = 'rejected';
        },
      );

      const answerWait = await observeQueryOutcomeOrLockWait(
        controlDataSource,
        backendRows[0].pid,
        () => answerOutcome,
      );
      assert.equal(answerWait, 'blocked');

      await gateRunner.query('SELECT pg_advisory_unlock($1::bigint)', [gateLockKey]);
      advisoryLockHeld = false;
      const assessmentResponse = await assessmentPromise;
      await answerUpdatePromise;
      await answerRunner.commitTransaction();

      assert.equal(assessmentResponse.status, 200);
      assert.equal(assessmentResponse.body.checklistStatus, 'Részben megvan');
    } finally {
      if (advisoryLockHeld) {
        await gateRunner.query('SELECT pg_advisory_unlock($1::bigint)', [gateLockKey]);
      }
      if (answerRunner.isTransactionActive) {
        await answerRunner.rollbackTransaction();
      }
      await answerRunner.release();
      await gateRunner.release();
      await controlDataSource.query(
        `DROP TRIGGER IF EXISTS "${gateTriggerName}" ON "round_question_assessment_overrides"`,
      );
      await controlDataSource.query(`DROP FUNCTION IF EXISTS "${gateFunctionName}"()`);
    }
  });

  it('serializes an assessment reset after a direct override delete with a true no-op audit outcome', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `Assessment reset override lock ${Date.now()}`,
      'assessment-reset-override-lock',
    );
    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const roundId = createdRoundResponse.body.id as string;
    const snapshotId = createdRoundResponse.body.questions[0].id as string;
    const assessmentUrl =
      `/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}/assessment`;

    await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Nem releváns', rationale: 'Initial reset contention rationale' })
      .expect(200);

    const resetResponse = await serializeExistingOverrideMutation(
      controlDataSource,
      apiApplicationName,
      `DELETE FROM "round_question_assessment_overrides"
       WHERE "round_id" = $1 AND "snapshot_id" = $2`,
      [roundId, snapshotId],
      async () => request(app.getHttpServer()).delete(assessmentUrl),
    );

    assert.equal(resetResponse.status, 200);
    assert.equal(resetResponse.body.checklistStatus, 'Nincs meg');
    assert.equal(resetResponse.body.assessmentRationale, null);
    const overrideRows = await controlDataSource.query<Array<{ id: string }>>(
      `SELECT "id" FROM "round_question_assessment_overrides"
       WHERE "round_id" = $1 AND "snapshot_id" = $2`,
      [roundId, snapshotId],
    );
    assert.deepEqual(overrideRows, []);
    assert.deepEqual(await loadAssessmentAuditEventTypes(controlDataSource, projectId), [
      'ROUND_QUESTION_ASSESSMENT_SAVED',
    ]);

    await request(app.getHttpServer()).delete(assessmentUrl).expect(200);
    assert.deepEqual(await loadAssessmentAuditEventTypes(controlDataSource, projectId), [
      'ROUND_QUESTION_ASSESSMENT_SAVED',
    ]);
  });

  it('serializes a PUT over an existing partial override after a direct override update', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `Assessment PUT override lock ${Date.now()}`,
      'assessment-put-override-lock',
    );
    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const roundId = createdRoundResponse.body.id as string;
    const snapshotId = createdRoundResponse.body.questions[0].id as string;
    const assessmentUrl =
      `/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}/assessment`;

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}`)
      .send({ value: 'Existing partial assessment evidence' })
      .expect(200);
    await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Részben megvan', rationale: null })
      .expect(200);

    const rationale = 'The API decision wins after the direct update serializes.';
    const putResponse = await serializeExistingOverrideMutation(
      controlDataSource,
      apiApplicationName,
      `UPDATE "round_question_assessment_overrides"
       SET "updated_at" = CURRENT_TIMESTAMP
       WHERE "round_id" = $1 AND "snapshot_id" = $2`,
      [roundId, snapshotId],
      async () =>
        request(app.getHttpServer())
          .put(assessmentUrl)
          .send({ status: 'Nem releváns', rationale }),
    );

    assert.equal(putResponse.status, 200);
    assert.equal(putResponse.body.checklistStatus, 'Nem releváns');
    assert.equal(putResponse.body.assessmentRationale, rationale);
    const overrideRows = await controlDataSource.query<
      Array<{ status: string; rationale: string | null }>
    >(
      `SELECT "status", "rationale" FROM "round_question_assessment_overrides"
       WHERE "round_id" = $1 AND "snapshot_id" = $2`,
      [roundId, snapshotId],
    );
    assert.deepEqual(overrideRows, [{ status: 'Nem releváns', rationale }]);
    assert.deepEqual(await loadAssessmentAuditEventTypes(controlDataSource, projectId), [
      'ROUND_QUESTION_ASSESSMENT_SAVED',
      'ROUND_QUESTION_ASSESSMENT_SAVED',
    ]);

    await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Nem releváns', rationale })
      .expect(200);
    assert.deepEqual(await loadAssessmentAuditEventTypes(controlDataSource, projectId), [
      'ROUND_QUESTION_ASSESSMENT_SAVED',
      'ROUND_QUESTION_ASSESSMENT_SAVED',
    ]);
  });

  it('serializes clearing an answer with a partial override after a direct override update', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `Assessment clear override lock ${Date.now()}`,
      'assessment-clear-override-lock',
    );
    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const roundId = createdRoundResponse.body.id as string;
    const snapshotId = createdRoundResponse.body.questions[0].id as string;
    const assessmentUrl =
      `/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}/assessment`;

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}`)
      .send({ value: 'Evidence that supports the partial assessment' })
      .expect(200);
    await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Részben megvan', rationale: null })
      .expect(200);

    const clearResponse = await serializeExistingOverrideMutation(
      controlDataSource,
      apiApplicationName,
      `UPDATE "round_question_assessment_overrides"
       SET "updated_at" = CURRENT_TIMESTAMP
       WHERE "round_id" = $1 AND "snapshot_id" = $2`,
      [roundId, snapshotId],
      async () =>
        request(app.getHttpServer())
          .patch(`/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}`)
          .send({ value: null }),
    );

    assert.equal(clearResponse.status, 200);
    assert.equal(clearResponse.body.answer, null);
    assert.equal(clearResponse.body.checklistStatus, 'Nincs meg');
    assert.equal(clearResponse.body.assessmentRationale, null);
    const answerRows = await controlDataSource.query<Array<{ id: string }>>(
      `SELECT "id" FROM "round_answers"
       WHERE "round_id" = $1 AND "snapshot_id" = $2`,
      [roundId, snapshotId],
    );
    const overrideRows = await controlDataSource.query<Array<{ id: string }>>(
      `SELECT "id" FROM "round_question_assessment_overrides"
       WHERE "round_id" = $1 AND "snapshot_id" = $2`,
      [roundId, snapshotId],
    );
    assert.deepEqual(answerRows, []);
    assert.deepEqual(overrideRows, []);
    assert.deepEqual(await loadAssessmentAuditEventTypes(controlDataSource, projectId), [
      'ROUND_QUESTION_ASSESSMENT_SAVED',
      'ROUND_QUESTION_ASSESSMENT_RESET',
    ]);

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}`)
      .send({ value: null })
      .expect(200);
    assert.deepEqual(await loadAssessmentAuditEventTypes(controlDataSource, projectId), [
      'ROUND_QUESTION_ASSESSMENT_SAVED',
      'ROUND_QUESTION_ASSESSMENT_RESET',
    ]);
  });

  it('returns 404 for every foreign-project pre-round lock branch before its lock is released', async () => {
    const { projectId: projectAId } = await createProjectWithSingleQuestionSchema(
      app,
      `Assessment foreign scope A ${Date.now()}`,
      'assessment-foreign-scope-a',
    );
    const { projectId: projectBId } = await createProjectWithSingleQuestionSchema(
      app,
      `Assessment foreign scope B ${Date.now()}`,
      'assessment-foreign-scope-b',
    );
    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectBId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const roundId = createdRoundResponse.body.id as string;
    const snapshotId = createdRoundResponse.body.questions[0].id as string;
    const projectBAnswerUrl =
      `/projects/${projectBId}/rounds/${roundId}/answers/${snapshotId}`;
    const projectBAssessmentUrl =
      `/projects/${projectBId}/rounds/${roundId}/answers/${snapshotId}/assessment`;
    const projectAAssessmentUrl =
      `/projects/${projectAId}/rounds/${roundId}/answers/${snapshotId}/assessment`;
    await request(app.getHttpServer())
      .patch(projectBAnswerUrl)
      .send({ value: 'Project B answer scope proof' })
      .expect(200);
    await request(app.getHttpServer())
      .put(projectBAssessmentUrl)
      .send({ status: 'Részben megvan', rationale: null })
      .expect(200);

    const overrideRunner = await lockExistingRoundQuestionAssessmentOverride(
      controlDataSource,
      roundId,
      snapshotId,
    );
    let pendingOverrideResponse: Promise<{ status: number }> | undefined;
    try {
      const foreignProjectOverrideRoutes = [
        {
          name: 'nonpartial PUT',
          send: async () =>
            request(app.getHttpServer())
              .put(projectAAssessmentUrl)
              .send({ status: 'Nem releváns', rationale: 'Foreign project must not mutate B' }),
        },
        {
          name: 'DELETE',
          send: async () => request(app.getHttpServer()).delete(projectAAssessmentUrl),
        },
      ] as const;

      for (const route of foreignProjectOverrideRoutes) {
        let routeOutcome: 'completed' | 'pending' | 'rejected' = 'pending';
        pendingOverrideResponse = route.send();
        void pendingOverrideResponse.then(
          () => {
            routeOutcome = 'completed';
          },
          () => {
            routeOutcome = 'rejected';
          },
        );

        const outcomeBeforeOverrideRelease = await observeApplicationOutcomeOrLockWait(
          controlDataSource,
          apiApplicationName,
          () => routeOutcome,
        );
        assert.equal(
          outcomeBeforeOverrideRelease,
          'completed',
          `${route.name} must not wait for a foreign-project override lock.`,
        );
        const response = await pendingOverrideResponse;
        pendingOverrideResponse = undefined;
        assert.equal(response.status, 404);
      }
    } finally {
      if (overrideRunner.isTransactionActive) {
        await overrideRunner.rollbackTransaction();
      }
      await overrideRunner.release();
      if (pendingOverrideResponse) {
        await pendingOverrideResponse;
      }
    }

    const answerRunner = await lockExistingRoundAnswer(
      controlDataSource,
      roundId,
      snapshotId,
    );
    let pendingAnswerResponse: Promise<{ status: number }> | undefined;
    try {
      const foreignProjectAnswerRoutes = [
        {
          name: 'PATCH',
          send: async () =>
            request(app.getHttpServer())
              .patch(`/projects/${projectAId}/rounds/${roundId}/answers/${snapshotId}`)
              .send({ value: null }),
        },
        {
          name: 'partial PUT',
          send: async () =>
            request(app.getHttpServer())
              .put(projectAAssessmentUrl)
              .send({ status: 'Részben megvan', rationale: null }),
        },
      ] as const;

      for (const route of foreignProjectAnswerRoutes) {
        let routeOutcome: 'completed' | 'pending' | 'rejected' = 'pending';
        pendingAnswerResponse = route.send();
        void pendingAnswerResponse.then(
          () => {
            routeOutcome = 'completed';
          },
          () => {
            routeOutcome = 'rejected';
          },
        );

        const outcomeBeforeAnswerRelease = await observeApplicationOutcomeOrLockWait(
          controlDataSource,
          apiApplicationName,
          () => routeOutcome,
        );
        assert.equal(
          outcomeBeforeAnswerRelease,
          'completed',
          `${route.name} must not wait for a foreign-project answer lock.`,
        );
        const response = await pendingAnswerResponse;
        pendingAnswerResponse = undefined;
        assert.equal(response.status, 404);
      }
    } finally {
      if (answerRunner.isTransactionActive) {
        await answerRunner.rollbackTransaction();
      }
      await answerRunner.release();
      if (pendingAnswerResponse) {
        await pendingAnswerResponse;
      }
    }
  });

  it('uses an observed PostgreSQL FOR UPDATE OF override query for a matching project', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `Assessment targeted override lock ${Date.now()}`,
      'assessment-targeted-override-lock',
    );
    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const roundId = createdRoundResponse.body.id as string;
    const snapshotId = createdRoundResponse.body.questions[0].id as string;
    const assessmentUrl =
      `/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}/assessment`;
    await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Nem releváns', rationale: 'Targeted lock SQL proof' })
      .expect(200);

    const overrideRunner = await lockExistingRoundQuestionAssessmentOverride(
      controlDataSource,
      roundId,
      snapshotId,
    );
    let resetResponse: Promise<{ status: number }> | undefined;
    try {
      let resetOutcome: 'completed' | 'pending' | 'rejected' = 'pending';
      resetResponse = (async () => request(app.getHttpServer()).delete(assessmentUrl))();
      void resetResponse.then(
        () => {
          resetOutcome = 'completed';
        },
        () => {
          resetOutcome = 'rejected';
        },
      );
      const resetWait = await observeApplicationOutcomeOrLockWait(
        controlDataSource,
        apiApplicationName,
        () => resetOutcome,
      );
      assert.equal(resetWait, 'blocked');

      const lockingQuery = await loadWaitingApplicationQuery(
        controlDataSource,
        apiApplicationName,
      );
      assert.match(
        lockingQuery,
        /FROM "round_question_assessment_overrides" "override"\s+INNER JOIN "interview_rounds" "round"/,
      );
      assert.match(lockingQuery, /"round"\."id" = "override"\."round_id"/);
      assert.match(lockingQuery, /"round"\."project_id" = \$\d+/);
      assert.match(lockingQuery, /FOR UPDATE OF override\s*$/);
      assert.doesNotMatch(lockingQuery, /FOR UPDATE OF round/);

      await overrideRunner.rollbackTransaction();
      const response = await resetResponse;
      resetResponse = undefined;
      assert.equal(response.status, 200);
    } finally {
      if (overrideRunner.isTransactionActive) {
        await overrideRunner.rollbackTransaction();
      }
      await overrideRunner.release();
      if (resetResponse) {
        await resetResponse;
      }
    }
  });

  it('uses an observed PostgreSQL FOR UPDATE OF answer query for a matching project', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `Assessment targeted answer lock ${Date.now()}`,
      'assessment-targeted-answer-lock',
    );
    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const roundId = createdRoundResponse.body.id as string;
    const snapshotId = createdRoundResponse.body.questions[0].id as string;
    const answerUrl = `/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}`;
    await request(app.getHttpServer())
      .patch(answerUrl)
      .send({ value: 'Targeted answer lock SQL proof' })
      .expect(200);

    const answerRunner = await lockExistingRoundAnswer(
      controlDataSource,
      roundId,
      snapshotId,
    );
    let answerResponse: Promise<{ status: number }> | undefined;
    try {
      let answerOutcome: 'completed' | 'pending' | 'rejected' = 'pending';
      answerResponse = (async () =>
        request(app.getHttpServer())
          .patch(answerUrl)
          .send({ value: 'Targeted answer lock SQL proof updated' }))();
      void answerResponse.then(
        () => {
          answerOutcome = 'completed';
        },
        () => {
          answerOutcome = 'rejected';
        },
      );
      const answerWait = await observeApplicationOutcomeOrLockWait(
        controlDataSource,
        apiApplicationName,
        () => answerOutcome,
      );
      assert.equal(answerWait, 'blocked');

      const lockingQuery = await loadWaitingApplicationQuery(
        controlDataSource,
        apiApplicationName,
      );
      assert.match(
        lockingQuery,
        /FROM "round_answers" "answer"\s+INNER JOIN "interview_rounds" "round"/,
      );
      assert.match(lockingQuery, /"round"\."id" = "answer"\."round_id"/);
      assert.match(lockingQuery, /"round"\."project_id" = \$\d+/);
      assert.match(lockingQuery, /FOR UPDATE OF answer\s*$/);
      assert.doesNotMatch(lockingQuery, /FOR UPDATE OF round/);

      await answerRunner.rollbackTransaction();
      const response = await answerResponse;
      answerResponse = undefined;
      assert.equal(response.status, 200);
    } finally {
      if (answerRunner.isTransactionActive) {
        await answerRunner.rollbackTransaction();
      }
      await answerRunner.release();
      if (answerResponse) {
        await answerResponse;
      }
    }
  });

  it('persists assessment commands idempotently with policy validation and redacted audit', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `Assessment commands ${Date.now()}`,
      'assessment-commands',
    );
    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const roundId = createdRoundResponse.body.id as string;
    const snapshotId = createdRoundResponse.body.questions[0].id as string;
    const assessmentUrl =
      `/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}/assessment`;

    const missingEvidenceResponse = await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Részben megvan', rationale: null })
      .expect(400);
    assert.doesNotMatch(JSON.stringify(missingEvidenceResponse.body), /Canonical evidence/);

    await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Kész', rationale: null })
      .expect(400);

    const answerText = 'Canonical evidence must remain private from assessment audit';
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}`)
      .send({ value: answerText })
      .expect(200);

    const unknownPropertyResponse = await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Részben megvan', rationale: null, unexpected: true })
      .expect(400);
    assert.deepEqual(unknownPropertyResponse.body.fields, ['unexpected']);
    await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Nem releváns' })
      .expect(400);
    await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Nem releváns', rationale: 42 })
      .expect(400);

    const partialResponse = await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Részben megvan', rationale: null })
      .expect(200);
    assert.equal(partialResponse.body.checklistStatus, 'Részben megvan');
    assert.equal(partialResponse.body.assessmentRationale, null);

    const firstOverrideRows = await dataSource.query<
      Array<{ status: string; rationale: string | null; createdAt: Date; updatedAt: Date }>
    >(
      `SELECT "status", "rationale", "created_at" AS "createdAt", "updated_at" AS "updatedAt"
       FROM "round_question_assessment_overrides"
       WHERE "round_id" = $1 AND "snapshot_id" = $2`,
      [roundId, snapshotId],
    );
    assert.equal(firstOverrideRows.length, 1);

    await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Részben megvan', rationale: null })
      .expect(200);
    const unchangedOverrideRows = await dataSource.query<
      Array<{ status: string; rationale: string | null; createdAt: Date; updatedAt: Date }>
    >(
      `SELECT "status", "rationale", "created_at" AS "createdAt", "updated_at" AS "updatedAt"
       FROM "round_question_assessment_overrides"
       WHERE "round_id" = $1 AND "snapshot_id" = $2`,
      [roundId, snapshotId],
    );
    assert.deepEqual(unchangedOverrideRows, firstOverrideRows);

    const activeRoundResponse = await request(app.getHttpServer())
      .get(`/projects/${projectId}/rounds/active`)
      .expect(200);
    assert.equal(activeRoundResponse.body.questions[0].checklistStatus, 'Részben megvan');

    const resetResponse = await request(app.getHttpServer()).delete(assessmentUrl).expect(200);
    assert.equal(resetResponse.body.checklistStatus, 'Kész');
    assert.equal(resetResponse.body.assessmentRationale, null);
    await request(app.getHttpServer()).delete(assessmentUrl).expect(200);

    await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Nem releváns', rationale: ' \t\n ' })
      .expect(400);
    await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Nem releváns', rationale: 'x'.repeat(10_001) })
      .expect(400);

    const rationale = 'Business owner confirmed the question does not apply';
    const notRelevantResponse = await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Nem releváns', rationale: `  ${rationale}\n` })
      .expect(200);
    assert.equal(notRelevantResponse.body.checklistStatus, 'Nem releváns');
    assert.equal(notRelevantResponse.body.assessmentRationale, rationale);
    assert.equal(notRelevantResponse.body.answer, answerText);

    const notRelevantReloadResponse = await request(app.getHttpServer())
      .get(`/projects/${projectId}/rounds/active`)
      .expect(200);
    assert.equal(
      notRelevantReloadResponse.body.questions[0].checklistStatus,
      'Nem releváns',
    );
    assert.equal(
      notRelevantReloadResponse.body.questions[0].assessmentRationale,
      rationale,
    );

    const notRelevantResetResponse = await request(app.getHttpServer())
      .delete(assessmentUrl)
      .expect(200);
    assert.equal(notRelevantResetResponse.body.checklistStatus, 'Kész');
    assert.equal(notRelevantResetResponse.body.assessmentRationale, null);

    const assessmentAuditRows = await dataSource.query<
      Array<{ eventType: string; payload: Record<string, string> }>
    >(
      `SELECT "event_type" AS "eventType", "payload"
       FROM "audit_events"
       WHERE "project_id" = $1
         AND "event_type" IN ('ROUND_QUESTION_ASSESSMENT_SAVED', 'ROUND_QUESTION_ASSESSMENT_RESET')
       ORDER BY "created_at" ASC, "id" ASC`,
      [projectId],
    );
    assert.deepEqual(assessmentAuditRows, [
      {
        eventType: 'ROUND_QUESTION_ASSESSMENT_SAVED',
        payload: { roundId, snapshotId, status: 'Részben megvan' },
      },
      {
        eventType: 'ROUND_QUESTION_ASSESSMENT_RESET',
        payload: { roundId, snapshotId },
      },
      {
        eventType: 'ROUND_QUESTION_ASSESSMENT_SAVED',
        payload: { roundId, snapshotId, status: 'Nem releváns' },
      },
      {
        eventType: 'ROUND_QUESTION_ASSESSMENT_RESET',
        payload: { roundId, snapshotId },
      },
    ]);
    const assessmentAuditJson = JSON.stringify(assessmentAuditRows);
    assert.doesNotMatch(assessmentAuditJson, new RegExp(answerText));
    assert.doesNotMatch(assessmentAuditJson, new RegExp(rationale));
  });

  it('serializes the shared effective assessment in a public Markdown revision snapshot', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `Assessment Markdown ${Date.now()}`,
      'assessment-markdown',
    );
    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const roundId = createdRoundResponse.body.id as string;
    const snapshotId = createdRoundResponse.body.questions[0].id as string;
    const rationale = 'The source snapshot must preserve this assessment decision';

    await request(app.getHttpServer())
      .put(
        `/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}/assessment`,
      )
      .send({ status: 'Nem releváns', rationale })
      .expect(200);

    const revisionResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/markdown-revisions`)
      .send({ reason: 'MANUAL' })
      .expect(201);
    const sourceRound = revisionResponse.body.sourceSnapshot.interviewRounds.find(
      (round: { id: string }) => round.id === roundId,
    ) as { questions: Array<{ id: string; checklistStatus: string; assessmentRationale: string | null }> };
    const sourceQuestion = sourceRound.questions.find((question) => question.id === snapshotId);

    assert.deepEqual(sourceQuestion, {
      ...createdRoundResponse.body.questions[0],
      checklistStatus: 'Nem releváns',
      assessmentRationale: rationale,
    });
  });

  it('keeps answer clearing editable in a handoff draft and locks it after send', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `Assessment lifecycle ${Date.now()}`,
      'assessment-lifecycle',
    );
    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const roundId = createdRoundResponse.body.id as string;
    const snapshotId = createdRoundResponse.body.questions[0].id as string;
    const answerUrl = `/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}`;
    const assessmentUrl = `${answerUrl}/assessment`;

    await request(app.getHttpServer())
      .patch(answerUrl)
      .send({ value: 'Partial supporting evidence' })
      .expect(200);
    await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Részben megvan', rationale: null })
      .expect(200);

    const partialCompletionResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/complete`)
      .expect(201);
    assert.equal(partialCompletionResponse.body.status, 'ENDED');

    const clearedPartialResponse = await request(app.getHttpServer())
      .patch(answerUrl)
      .send({ value: null })
      .expect(200);
    assert.equal(clearedPartialResponse.body.answer, null);
    assert.equal(clearedPartialResponse.body.checklistStatus, 'Nincs meg');
    assert.equal(clearedPartialResponse.body.assessmentRationale, null);
    const clearedPartialRows = await dataSource.query<Array<{ answerCount: string; overrideCount: string }>>(
      `SELECT
        (SELECT COUNT(*)::text FROM "round_answers" WHERE "snapshot_id" = $1) AS "answerCount",
        (SELECT COUNT(*)::text FROM "round_question_assessment_overrides" WHERE "snapshot_id" = $1) AS "overrideCount"`,
      [snapshotId],
    );
    assert.deepEqual(clearedPartialRows, [{ answerCount: '0', overrideCount: '0' }]);

    await request(app.getHttpServer())
      .patch(answerUrl)
      .send({ value: 'Answer preserved until explicitly cleared' })
      .expect(200);
    const rationale = 'This required question does not apply to the project';
    await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Nem releváns', rationale })
      .expect(200);

    const clearedNotRelevantResponse = await request(app.getHttpServer())
      .patch(answerUrl)
      .send({ value: null })
      .expect(200);
    assert.equal(clearedNotRelevantResponse.body.answer, null);
    assert.equal(clearedNotRelevantResponse.body.checklistStatus, 'Nem releváns');
    assert.equal(clearedNotRelevantResponse.body.assessmentRationale, rationale);

    const completedResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/complete`)
      .expect(201);
    assert.equal(completedResponse.body.status, 'ENDED');
    assert.equal(completedResponse.body.questions[0].checklistStatus, 'Nem releváns');
    assert.equal(completedResponse.body.questions[0].assessmentRationale, rationale);

    await dataSource.query(
      `UPDATE "interview_customer_handoffs"
       SET "state" = 'SENT', "sent_at" = CURRENT_TIMESTAMP
       WHERE "round_id" = $1`,
      [roundId],
    );

    const stateBeforeRejectedCommands = await dataSource.query<
      Array<{ status: string; rationale: string; updatedAt: Date; auditCount: string }>
    >(
      `SELECT assessment."status", assessment."rationale", assessment."updated_at" AS "updatedAt",
        (SELECT COUNT(*)::text FROM "audit_events"
         WHERE "project_id" = $1
           AND "event_type" IN ('ROUND_QUESTION_ASSESSMENT_SAVED', 'ROUND_QUESTION_ASSESSMENT_RESET')) AS "auditCount"
       FROM "round_question_assessment_overrides" assessment
       WHERE assessment."round_id" = $2 AND assessment."snapshot_id" = $3`,
      [projectId, roundId, snapshotId],
    );
    const rejectedReplacementResponse = await request(app.getHttpServer())
      .put(assessmentUrl)
      .send({ status: 'Nem releváns', rationale: 'Rejected replacement' })
      .expect(409);
    assert.doesNotMatch(JSON.stringify(rejectedReplacementResponse.body), /Rejected replacement/);
    const rejectedResetResponse = await request(app.getHttpServer())
      .delete(assessmentUrl)
      .expect(409);
    assert.doesNotMatch(JSON.stringify(rejectedResetResponse.body), new RegExp(rationale));
    const stateAfterRejectedCommands = await dataSource.query<
      Array<{ status: string; rationale: string; updatedAt: Date; auditCount: string }>
    >(
      `SELECT assessment."status", assessment."rationale", assessment."updated_at" AS "updatedAt",
        (SELECT COUNT(*)::text FROM "audit_events"
         WHERE "project_id" = $1
           AND "event_type" IN ('ROUND_QUESTION_ASSESSMENT_SAVED', 'ROUND_QUESTION_ASSESSMENT_RESET')) AS "auditCount"
       FROM "round_question_assessment_overrides" assessment
       WHERE assessment."round_id" = $2 AND assessment."snapshot_id" = $3`,
      [projectId, roundId, snapshotId],
    );
    assert.deepEqual(stateAfterRejectedCommands, stateBeforeRejectedCommands);
  });

  it('recovers the open initial intake round with persisted answers', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `Active recovery ${Date.now()}`,
      'active-recovery',
    );

    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const roundId = createdRoundResponse.body.id as string;
    const snapshotId = createdRoundResponse.body.questions[0].id as string;
    const answerValue = 'Recovered persisted answer';

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}`)
      .send({ value: answerValue })
      .expect(200);

    const activeRoundResponse = await request(app.getHttpServer())
      .get(`/projects/${projectId}/rounds/active`)
      .expect(200);

    assert.equal(activeRoundResponse.body.id, roundId);
    assert.equal(activeRoundResponse.body.type, 'INITIAL_INTAKE');
    assert.equal(activeRoundResponse.body.status, 'OPEN');
    assert.equal(activeRoundResponse.body.questions[0].id, snapshotId);
    assert.equal(activeRoundResponse.body.questions[0].answer, answerValue);
    assert.equal(
      activeRoundResponse.body.questions[0].stableKey,
      createdRoundResponse.body.questions[0].stableKey,
    );
    assert.equal(
      activeRoundResponse.body.questions[0].baseQuestionId,
      createdRoundResponse.body.questions[0].baseQuestionId,
    );
    assert.ok(typeof activeRoundResponse.body.questions[0].answeredAt === 'string');
  });

  it('rejects a duplicate open initial intake start with HTTP 409', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `Duplicate start ${Date.now()}`,
      'duplicate-start',
    );

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);

    const duplicateStartResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(409);

    assert.equal(
      duplicateStartResponse.body.message,
      'An open INITIAL_INTAKE round already exists for this project.',
    );
  });

  it('keeps the ended initial intake current until a newer round is started', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `Completed active ${Date.now()}`,
      'completed-active',
    );

    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const roundId = createdRoundResponse.body.id as string;
    const snapshotId = createdRoundResponse.body.questions[0].id as string;

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}`)
      .send({ value: 'Ready to complete' })
      .expect(200);

    const completedResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/complete`)
      .expect(201);
    assert.equal(completedResponse.body.id, roundId);
    assert.equal(completedResponse.body.questions[0].id, snapshotId);
    assert.equal(completedResponse.body.questions[0].answer, 'Ready to complete');
    assert.ok(typeof completedResponse.body.questions[0].answeredAt === 'string');

    const activeRoundResponse = await request(app.getHttpServer())
      .get(`/projects/${projectId}/rounds/active`)
      .expect(200);
    assert.equal(activeRoundResponse.body.id, roundId);
    assert.equal(activeRoundResponse.body.status, 'ENDED');

    const restartedRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);

    assert.notEqual(restartedRoundResponse.body.id, roundId);
    assert.equal(restartedRoundResponse.body.status, 'OPEN');
    assert.equal(restartedRoundResponse.body.type, 'INITIAL_INTAKE');
  });

  it('keeps prior round snapshots immutable while allowing an incomplete meeting to end', async () => {
    const bankResponse = await request(app.getHttpServer())
      .get('/settings/base-questions')
      .expect(200);
    assert.ok(Number.isInteger(bankResponse.body.version));
    const initialBankVersion = bankResponse.body.version as number;
    assert.ok(bankResponse.body.questions.length >= 30);
    const canonicalSeedRows = await dataSource.query<Array<{ count: string }>>(
      'SELECT COUNT(*)::text AS "count" FROM "base_questions" WHERE "bank_version" = 1 AND "source" = \'CANONICAL_SEED\'',
    );
    assert.deepEqual(canonicalSeedRows, [{ count: '30' }]);

    const originalQuestion = bankResponse.body.questions[0] as {
      id: string;
      stableKey: string;
      controlPoint: string;
      text: string;
    };
    const unrelatedQuestion = bankResponse.body.questions[1] as { id: string; text: string };
    const projectResponse = await request(app.getHttpServer())
      .post('/projects')
      .send({
        name: `R2 proof ${Date.now()}`,
        customerContactName: 'R2 Test Contact',
        customerContactEmail: 'r2@example.test',
        internalOwnerName: 'R2 Test PO/PM',
      })
      .expect(201);
    const projectId = projectResponse.body.id as string;

    const missingSchemaResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/question-schema`)
      .send({ questions: [{ stableKey: 'missing-r2-key', required: true, blocking: true }] })
      .expect(400);
    assert.match(
      JSON.stringify(missingSchemaResponse.body),
      /item 1 \(missing-r2-key\).*missing or inactive/,
    );

    const schemaResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/question-schema`)
      .send({
        questions: [{ stableKey: originalQuestion.stableKey, required: true, blocking: true }],
      })
      .expect(201);
    assert.equal(schemaResponse.body.bankVersion, initialBankVersion);

    const firstRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const firstRoundId = firstRoundResponse.body.id as string;
    const firstSnapshotId = firstRoundResponse.body.questions[0].id as string;
    assert.equal(firstRoundResponse.body.questions[0].text, originalQuestion.text);
    assert.equal(firstRoundResponse.body.questions[0].baseQuestionId, originalQuestion.id);
    assert.equal(firstRoundResponse.body.questions[0].controlPoint, originalQuestion.controlPoint);

    const gateUpdate = dataSource.query(
      'UPDATE "interview_rounds" SET "status" = \'ENDED\', "completed_at" = CURRENT_TIMESTAMP WHERE "id" = $1',
      [firstRoundId],
    );
    await assert.doesNotReject(gateUpdate);
    await assert.rejects(
      dataSource.query(
        `INSERT INTO "interview_rounds" (
          "id", "project_id", "project_schema_id", "type", "status", "completed_at", "source"
        ) VALUES ($1, $2, $3, 'INITIAL_INTAKE', 'ENDED', CURRENT_TIMESTAMP, 'DIRECT_TEST')`,
        [randomUUID(), projectId, schemaResponse.body.id],
      ),
      /OPEN|transition|completion/,
    );

    const revisedText = `${originalQuestion.text} (R2 snapshot proof)`;
    const revisedBankResponse = await request(app.getHttpServer())
      .patch('/settings/base-questions')
      .send({ id: originalQuestion.id, text: revisedText })
      .expect(200);
    assert.equal(revisedBankResponse.body.version, initialBankVersion + 1);
    assert.equal(
      revisedBankResponse.body.questions.find(
        (question: { id: string; stableKey: string }) =>
          question.stableKey === bankResponse.body.questions[1].stableKey,
      ).text,
      unrelatedQuestion.text,
    );

    const revisedSchemaResponse = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/question-schema`)
      .send({
        questions: [{ stableKey: originalQuestion.stableKey, required: true, blocking: true }],
      })
      .expect(200);
    assert.equal(revisedSchemaResponse.body.bankVersion, initialBankVersion + 1);

    const oldBankQuestionRows = await dataSource.query<Array<{ id: string }>>(
      'SELECT "id" FROM "base_questions" WHERE "bank_version" = 1 ORDER BY "display_order" ASC LIMIT 1',
    );
    await assert.rejects(
      dataSource.query(
        `INSERT INTO "project_schema_questions" (
          "id", "project_schema_id", "base_question_id", "bank_version", "required", "blocking", "display_order"
        ) VALUES ($1, $2, $3, $4, true, true, 2)`,
        [
          randomUUID(),
          revisedSchemaResponse.body.id,
          oldBankQuestionRows[0].id,
          revisedSchemaResponse.body.bankVersion,
        ],
      ),
      /foreign key/,
    );

    const secondRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'CLARIFICATION', selectedStableKeys: [originalQuestion.stableKey] })
      .expect(201);
    const secondRoundId = secondRoundResponse.body.id as string;
    const secondSnapshotId = secondRoundResponse.body.questions[0].id as string;
    assert.equal(secondRoundResponse.body.questions[0].text, revisedText);
    assert.equal(secondRoundResponse.body.questions[0].baseQuestionId, revisedBankResponse.body.questions[0].id);
    assert.equal(
      secondRoundResponse.body.questions[0].controlPoint,
      revisedBankResponse.body.questions[0].controlPoint,
    );

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/rounds/${secondRoundId}/answers/${secondSnapshotId}`)
      .send({ value: null })
      .expect(200);
    const noOpClearAudit = await dataSource.query<Array<{ count: string }>>(
      'SELECT COUNT(*)::text AS "count" FROM "audit_events" WHERE "project_id" = $1 AND "event_type" = \'ROUND_ANSWER_CLEARED\' AND "payload"->>\'roundId\' = $2',
      [projectId, secondRoundId],
    );
    assert.deepEqual(noOpClearAudit, [{ count: '0' }]);

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/rounds/${secondRoundId}/answers/${secondSnapshotId}`)
      .send({ value: 'A required answer' })
      .expect(200);

    const completedResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${secondRoundId}/complete`)
      .expect(201);
    assert.equal(completedResponse.body.status, 'ENDED');

    const incompleteRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'CLARIFICATION', selectedStableKeys: [originalQuestion.stableKey] })
      .expect(201);
    const endedWithMissingResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${incompleteRoundResponse.body.id}/complete`)
      .expect(201);
    assert.equal(endedWithMissingResponse.body.status, 'ENDED');
    await request(app.getHttpServer())
      .patch(
        `/projects/${projectId}/rounds/${incompleteRoundResponse.body.id}/answers/${incompleteRoundResponse.body.questions[0].id}`,
      )
      .send({ value: 'Ended additional rounds stay read-only.' })
      .expect(409);

    await assert.rejects(
      dataSource.query('UPDATE "interview_rounds" SET "type" = \'STAKEHOLDER\' WHERE "id" = $1', [secondRoundId]),
      /ended|historical|immutable/i,
    );
    await assert.rejects(
      dataSource.query('DELETE FROM "interview_rounds" WHERE "id" = $1', [secondRoundId]),
      /ended|historical|immutable/i,
    );
    const completedAnswerRows = await dataSource.query<Array<{ id: string }>>(
      'SELECT "id" FROM "round_answers" WHERE "round_id" = $1',
      [secondRoundId],
    );
    await assert.doesNotReject(
      dataSource.query('UPDATE "round_answers" SET "value" = $1 WHERE "id" = $2', [JSON.stringify('changed'), completedAnswerRows[0].id]),
    );
    await assert.rejects(
      dataSource.query(
        'UPDATE "round_answers" SET "round_id" = $1, "snapshot_id" = $2 WHERE "id" = $3',
        [firstRoundId, firstSnapshotId, completedAnswerRows[0].id],
      ),
      /completed|immutable|identity/,
    );
    await assert.doesNotReject(
      dataSource.query('DELETE FROM "round_answers" WHERE "id" = $1', [completedAnswerRows[0].id]),
    );

    const firstSnapshotRows = await dataSource.query<Array<{ text: string }>>(
      'SELECT "text" FROM "round_question_snapshots" WHERE "round_id" = $1',
      [firstRoundId],
    );
    assert.deepEqual(firstSnapshotRows, [{ text: originalQuestion.text }]);

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await assert.rejects(
        queryRunner.query(
          'UPDATE "round_question_snapshots" SET "text" = $1 WHERE "round_id" = $2',
          ['A forbidden retroactive change', firstRoundId],
        ),
        /immutable/,
      );
    } finally {
      await queryRunner.rollbackTransaction();
      await queryRunner.release();
    }

    const dateBankResponse = await request(app.getHttpServer())
      .post('/settings/base-questions')
      .send({
        stableKey: `general-r2-date-${Date.now()}`,
        topic: 'R2 date proof',
        controlPoint: 'R2 date validation proof',
        text: 'When is the date?',
        type: 'DATE',
        required: true,
        requiredForEstimate: false,
        blocking: true,
        order: bankResponse.body.questions.length + 1,
        active: true,
      })
      .expect(201);
    const dateQuestion = dateBankResponse.body.questions.find(
      (question: { type: string }) => question.type === 'DATE',
    );
    const dateProjectResponse = await request(app.getHttpServer())
      .post('/projects')
      .send({
        name: `R2 date project ${Date.now()}`,
        customerContactName: 'R2 Date Contact',
        customerContactEmail: 'r2-date@example.test',
        internalOwnerName: 'R2 Date PO/PM',
      })
      .expect(201);
    const dateProjectId = dateProjectResponse.body.id as string;
    await request(app.getHttpServer())
      .post(`/projects/${dateProjectId}/question-schema`)
      .send({ questions: [{ stableKey: dateQuestion.stableKey, required: true, blocking: true }] })
      .expect(201);
    const dateRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${dateProjectId}/rounds`)
      .send({ type: 'STAKEHOLDER', selectedStableKeys: [dateQuestion.stableKey] })
      .expect(201);
    await request(app.getHttpServer())
      .patch(
        `/projects/${dateProjectId}/rounds/${dateRoundResponse.body.id}/answers/${dateRoundResponse.body.questions[0].id}`,
      )
      .send({ value: '2026-02-30' })
      .expect(400);
    await request(app.getHttpServer())
      .patch(
        `/projects/${dateProjectId}/rounds/${dateRoundResponse.body.id}/answers/${dateRoundResponse.body.questions[0].id}`,
      )
      .send({ value: '2026-02-28' })
      .expect(200);
    const dateAnswerRows = await dataSource.query<Array<{ id: string }>>(
      'SELECT "id" FROM "round_answers" WHERE "round_id" = $1',
      [dateRoundResponse.body.id],
    );
    await dataSource.query(
      'UPDATE "round_answers" SET "value" = $1 WHERE "id" = $2',
      [JSON.stringify(true), dateAnswerRows[0].id],
    );
    await assert.doesNotReject(
      dataSource.query(
        'UPDATE "interview_rounds" SET "status" = \'ENDED\', "completed_at" = CURRENT_TIMESTAMP WHERE "id" = $1',
        [dateRoundResponse.body.id],
      ),
    );
  });

  it('returns explicit readiness unavailable states and a missing-project error', async () => {
    const { projectId } = await createProjectWithSingleQuestionSchema(
      app,
      `Readiness unavailable ${Date.now()}`,
      'readiness-unavailable',
    );

    const noSourceResponse = await request(app.getHttpServer())
      .get(`/projects/${projectId}/readiness`)
      .expect(200);
    assert.deepEqual(noSourceResponse.body, {
      available: false,
      projectId,
      reason: 'NO_INITIAL_INTAKE',
    });

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);

    const unsupportedResponse = await request(app.getHttpServer())
      .get(`/projects/${projectId}/readiness`)
      .expect(200);
    assert.deepEqual(unsupportedResponse.body, {
      available: false,
      projectId,
      reason: 'UNSUPPORTED_SCHEMA',
    });

    const missingProjectResponse = await request(app.getHttpServer())
      .get(`/projects/${randomUUID()}/readiness`)
      .expect(404);
    assert.equal(missingProjectResponse.body.message, 'Project not found.');
  });

  it('calculates canonical readiness from effective states without returning business content', async () => {
    const fixture = await createCanonicalReadinessRound(
      app,
      `Readiness canonical ${Date.now()}`,
      'readiness-canonical',
      null,
    );
    const policy = await loadGeneralPlaybookV1();
    const partialStatus = checklistStatusForValue(policy, 0.5);
    const excludedStatus = policy.scoring.readiness.excludedChecklistStatus;
    const blockedStatus = requireFollowUpStatus(policy.statuses.followUp, 'Blokkolt');
    const resolvedStatus = policy.scoring.readiness.resolvedFollowUpStatuses[0];
    assert.ok(resolvedStatus);

    const firstQuestion = requireReadinessQuestion(fixture.questions, 'general-001');
    const secondQuestion = requireReadinessQuestion(fixture.questions, 'general-002');
    const thirdQuestion = requireReadinessQuestion(fixture.questions, 'general-003');
    const fourthQuestion = requireReadinessQuestion(fixture.questions, 'general-004');

    await saveRoundAnswer(app, fixture.projectId, fixture.roundId, firstQuestion);
    await saveRoundAnswer(app, fixture.projectId, fixture.roundId, secondQuestion);
    await request(app.getHttpServer())
      .put(
        `/projects/${fixture.projectId}/rounds/${fixture.roundId}/answers/${secondQuestion.id}/assessment`,
      )
      .send({ status: partialStatus, rationale: null })
      .expect(200);

    const sensitiveRationale = `score01-readiness-rationale-${randomUUID()}`;
    await request(app.getHttpServer())
      .put(
        `/projects/${fixture.projectId}/rounds/${fixture.roundId}/answers/${thirdQuestion.id}/assessment`,
      )
      .send({ status: excludedStatus, rationale: sensitiveRationale })
      .expect(200);

    const redactedAnswerQuestion = requireTextReadinessQuestion(
      fixture.questions,
      new Set([firstQuestion.id, secondQuestion.id, thirdQuestion.id, fourthQuestion.id]),
    );
    const sensitiveAnswer = `score01-readiness-answer-${randomUUID()}`;
    await request(app.getHttpServer())
      .patch(
        `/projects/${fixture.projectId}/rounds/${fixture.roundId}/answers/${redactedAnswerQuestion.id}`,
      )
      .send({ value: sensitiveAnswer })
      .expect(200);

    const sensitiveFollowUpQuestion = `score01-follow-up-question-${randomUUID()}`;
    const sensitiveFollowUpOwner = `score01-follow-up-owner-${randomUUID()}`;
    const sensitiveFollowUpNextStep = `score01-follow-up-next-step-${randomUUID()}`;
    const followUpResponse = await request(app.getHttpServer())
      .post(`/projects/${fixture.projectId}/discovery-follow-ups`)
      .send({
        category: 'BUSINESS',
        question: sensitiveFollowUpQuestion,
        owner: sensitiveFollowUpOwner,
        dueDate: '2026-08-11',
        nextStep: sensitiveFollowUpNextStep,
      })
      .expect(201);
    const followUpId = followUpResponse.body.id as string;
    await controlDataSource.query(
      'UPDATE "discovery_follow_ups" SET "status" = $1 WHERE "id" = $2',
      [blockedStatus, followUpId],
    );

    const blockedReadinessResponse = await request(app.getHttpServer())
      .get(`/projects/${fixture.projectId}/readiness`)
      .expect(200);
    const blockedReadiness = blockedReadinessResponse.body as AvailableReadinessResponse;
    assert.equal(blockedReadiness.available, true);
    assert.equal(blockedReadiness.projectId, fixture.projectId);
    assert.equal(blockedReadiness.sourceRoundId, fixture.roundId);
    assert.equal(blockedReadiness.sourceRoundStatus, 'OPEN');
    assert.deepEqual(
      blockedReadiness.factors
        .filter((factor) => factor.id !== 'checklist')
        .map((factor) => ({ id: factor.id, percentage: factor.percentage })),
      [
        { id: 'baseInfo', percentage: 100 },
        { id: 'business', percentage: 75 },
        { id: 'ownership', percentage: 0 },
        { id: 'followUpResolution', percentage: 0 },
      ],
    );
    assert.ok(requireReadinessFactor(blockedReadiness, 'checklist').percentage > 0);
    assert.ok(requireReadinessFactor(blockedReadiness, 'checklist').percentage < 100);
    assert.ok(blockedReadiness.completionPercentage > 0);
    assert.ok(blockedReadiness.completionPercentage < 100);

    const blockedGap = blockedReadiness.gaps.find((gap) => gap.id === `follow-up-${followUpId}`);
    assert.deepEqual(blockedGap, {
      id: `follow-up-${followUpId}`,
      severity: policy.statuses.readinessGapSeverity[0],
      category: 'Tisztázandó tétel',
      message: 'Egy tisztázandó tétel blokkolt állapotban van.',
      nextStep: 'Oldd fel a blokkoló tisztázandó tételt.',
      target: 'follow-ups',
      snapshotId: null,
      followUpId,
    });
    assert.ok(blockedReadiness.gaps.some((gap) => gap.id === 'overview-ball-owner'));
    assert.ok(blockedReadiness.gaps.some((gap) => gap.id === 'checklist-general-002'));
    assert.ok(blockedReadiness.gaps.some((gap) => gap.id === 'checklist-general-004'));
    assert.ok(!blockedReadiness.gaps.some((gap) => gap.id === 'checklist-general-003'));
    assert.equal(
      blockedReadiness.gaps.find((gap) => gap.id === 'checklist-general-002')?.severity,
      policy.statuses.readinessGapSeverity[1],
    );

    const blockedSerialized = JSON.stringify(blockedReadiness);
    for (const sensitiveValue of [
      sensitiveAnswer,
      sensitiveRationale,
      sensitiveFollowUpQuestion,
      sensitiveFollowUpOwner,
      sensitiveFollowUpNextStep,
    ]) {
      assert.equal(blockedSerialized.includes(sensitiveValue), false);
    }

    const sensitiveDecision = `score01-follow-up-decision-${randomUUID()}`;
    await request(app.getHttpServer())
      .post(`/projects/${fixture.projectId}/discovery-follow-ups/${followUpId}/resolve`)
      .send({ status: resolvedStatus, decisionOrAnswer: sensitiveDecision })
      .expect(200);

    const resolvedReadinessResponse = await request(app.getHttpServer())
      .get(`/projects/${fixture.projectId}/readiness`)
      .expect(200);
    const resolvedReadiness = resolvedReadinessResponse.body as AvailableReadinessResponse;
    assert.equal(
      requireReadinessFactor(resolvedReadiness, 'followUpResolution').percentage,
      100,
    );
    assert.ok(!resolvedReadiness.gaps.some((gap) => gap.id === `follow-up-${followUpId}`));
    assert.equal(JSON.stringify(resolvedReadiness).includes(sensitiveDecision), false);

  });

  it('uses a completed canonical intake only until a new initial intake is open', async () => {
    const firstFixture = await createCanonicalReadinessRound(
      app,
      `Readiness source selection ${Date.now()}`,
      'readiness-source-selection',
      'Readiness owner',
    );

    for (const question of firstFixture.questions) {
      await saveRoundAnswer(app, firstFixture.projectId, firstFixture.roundId, question);
    }
    await request(app.getHttpServer())
      .post(`/projects/${firstFixture.projectId}/rounds/${firstFixture.roundId}/complete`)
      .expect(201);

    const completedReadinessResponse = await request(app.getHttpServer())
      .get(`/projects/${firstFixture.projectId}/readiness`)
      .expect(200);
    const completedReadiness = completedReadinessResponse.body as AvailableReadinessResponse;
    assert.equal(completedReadiness.sourceRoundId, firstFixture.roundId);
    assert.equal(completedReadiness.sourceRoundStatus, 'ENDED');

    const openRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${firstFixture.projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const openRoundId = openRoundResponse.body.id as string;

    const openReadinessResponse = await request(app.getHttpServer())
      .get(`/projects/${firstFixture.projectId}/readiness`)
      .expect(200);
    const openReadiness = openReadinessResponse.body as AvailableReadinessResponse;
    assert.equal(openReadiness.sourceRoundId, openRoundId);
    assert.equal(openReadiness.sourceRoundStatus, 'OPEN');
  });
});

interface ReadinessRoundQuestion {
  readonly id: string;
  readonly stableKey: string;
  readonly type: BaseQuestionType;
  readonly options: readonly string[] | null;
}

interface CanonicalReadinessRound {
  readonly projectId: string;
  readonly roundId: string;
  readonly questions: readonly ReadinessRoundQuestion[];
}

interface AvailableReadinessResponse {
  readonly available: true;
  readonly projectId: string;
  readonly sourceRoundId: string;
  readonly sourceRoundStatus: string;
  readonly completionPercentage: number;
  readonly factors: readonly {
    readonly id: string;
    readonly percentage: number;
  }[];
  readonly gaps: readonly {
    readonly id: string;
    readonly severity: string;
    readonly category: string;
    readonly message: string;
    readonly nextStep: string;
    readonly target: string;
    readonly snapshotId: string | null;
    readonly followUpId: string | null;
  }[];
}

async function createProjectWithSingleQuestionSchema(
  app: INestApplication,
  projectName: string,
  emailPrefix: string,
): Promise<{ projectId: string; schemaId: string }> {
  const bankResponse = await request(app.getHttpServer())
    .get('/settings/base-questions')
    .expect(200);
  const baseQuestion = bankResponse.body.questions[0] as { stableKey: string };

  const projectResponse = await request(app.getHttpServer())
    .post('/projects')
    .send({
      name: projectName,
      customerContactName: 'Task 2 Test Contact',
      customerContactEmail: `${emailPrefix}-${Date.now()}@example.test`,
      internalOwnerName: 'Task 2 Test PO/PM',
    })
    .expect(201);
  const projectId = projectResponse.body.id as string;

  const schemaResponse = await request(app.getHttpServer())
    .post(`/projects/${projectId}/question-schema`)
    .send({
      questions: [{ stableKey: baseQuestion.stableKey, required: true, blocking: true }],
    })
    .expect(201);

  return { projectId, schemaId: schemaResponse.body.id as string };
}

async function createProjectWithQuestionTypesSchema(
  app: INestApplication,
  projectName: string,
  emailPrefix: string,
  questionTypes: readonly ('DATE' | 'LONG_TEXT' | 'TEXT')[],
): Promise<{ projectId: string; stableKeys: readonly string[] }> {
  const stableKeys: string[] = [];
  for (const [index, questionType] of questionTypes.entries()) {
    const bankResponse = await request(app.getHttpServer())
      .get('/settings/base-questions')
      .expect(200);
    const stableKey = `general-${emailPrefix}-${questionType.toLowerCase().replaceAll('_', '-')}-${Date.now()}-${index}`;
    await request(app.getHttpServer())
      .post('/settings/base-questions')
      .send({
        stableKey,
        topic: 'SCORE-01 validation parity',
        controlPoint: `${questionType} answer validation`,
        text: `Provide one ${questionType} answer.`,
        type: questionType,
        required: true,
        requiredForEstimate: false,
        blocking: true,
        order: bankResponse.body.questions.length + 1,
        active: true,
      })
      .expect(201);
    stableKeys.push(stableKey);
  }

  const projectResponse = await request(app.getHttpServer())
    .post('/projects')
    .send({
      name: projectName,
      customerContactName: 'Task 3 Fix Contact',
      customerContactEmail: `${emailPrefix}-${Date.now()}@example.test`,
      internalOwnerName: 'Task 3 Test PO/PM',
    })
    .expect(201);
  const projectId = projectResponse.body.id as string;
  await request(app.getHttpServer())
    .post(`/projects/${projectId}/question-schema`)
    .send({
      questions: stableKeys.map((stableKey) => ({
        stableKey,
        required: true,
        blocking: true,
      })),
    })
    .expect(201);

  return { projectId, stableKeys };
}

async function createCanonicalReadinessRound(
  app: INestApplication,
  projectName: string,
  emailPrefix: string,
  ballOwner: string | null,
): Promise<CanonicalReadinessRound> {
  const policy = await loadGeneralPlaybookV1();
  const expectedStableKeys = policy.items.map((item) => canonicalStableKey(policy.id, item.id));
  const bankResponse = await request(app.getHttpServer())
    .get('/settings/base-questions')
    .expect(200);
  const activeStableKeys = new Set(
    (bankResponse.body.questions as Array<{ stableKey: string }>).map(
      (question) => question.stableKey,
    ),
  );
  for (const stableKey of expectedStableKeys) {
    assert.ok(activeStableKeys.has(stableKey));
  }

  const projectResponse = await request(app.getHttpServer())
    .post('/projects')
    .send({
      name: projectName,
      customerContactName: 'Readiness Test Contact',
      customerContactEmail: `${emailPrefix}-${Date.now()}@example.test`,
      internalOwnerName: ballOwner ?? 'Readiness Test PO/PM',
      ...(ballOwner === null ? {} : { nextActionOwnerRole: 'INTERNAL_OWNER' }),
    })
    .expect(201);
  const projectId = projectResponse.body.id as string;

  await request(app.getHttpServer())
    .post(`/projects/${projectId}/question-schema`)
    .send({
      questions: policy.items.map((item) => ({
        stableKey: canonicalStableKey(policy.id, item.id),
        required: item.requiredForEstimate,
        blocking: item.blockingIfMissing,
      })),
    })
    .expect(201);

  const roundResponse = await request(app.getHttpServer())
    .post(`/projects/${projectId}/rounds`)
    .send({ type: 'INITIAL_INTAKE' })
    .expect(201);
  const questions = roundResponse.body.questions as ReadinessRoundQuestion[];
  assert.equal(questions.length, expectedStableKeys.length);

  return {
    projectId,
    roundId: roundResponse.body.id as string,
    questions,
  };
}

async function saveRoundAnswer(
  app: INestApplication,
  projectId: string,
  roundId: string,
  question: ReadinessRoundQuestion,
): Promise<void> {
  await request(app.getHttpServer())
    .patch(`/projects/${projectId}/rounds/${roundId}/answers/${question.id}`)
    .send({ value: validReadinessAnswer(question) })
    .expect(200);
}

function canonicalStableKey(playbookId: string, itemId: number): string {
  return `${playbookId}-${String(itemId).padStart(3, '0')}`;
}

function checklistStatusForValue(policy: GeneralPlaybook, value: number): string {
  const status = Object.entries(policy.scoring.readiness.checklistStatusValue).find(
    ([, candidateValue]) => candidateValue === value,
  )?.[0];
  if (!status) {
    throw new Error(`No checklist status exists for policy value ${value}.`);
  }
  return status;
}

function requireFollowUpStatus(statuses: readonly string[], requiredStatus: string): string {
  const status = statuses.find((candidate) => candidate === requiredStatus);
  if (!status) {
    throw new Error(`Readiness policy does not define follow-up status ${requiredStatus}.`);
  }
  return status;
}

function requireReadinessQuestion(
  questions: readonly ReadinessRoundQuestion[],
  stableKey: string,
): ReadinessRoundQuestion {
  const question = questions.find((candidate) => candidate.stableKey === stableKey);
  if (!question) {
    throw new Error(`Canonical readiness round is missing ${stableKey}.`);
  }
  return question;
}

function requireTextReadinessQuestion(
  questions: readonly ReadinessRoundQuestion[],
  excludedQuestionIds: ReadonlySet<string>,
): ReadinessRoundQuestion {
  const question = questions.find(
    (candidate) =>
      !excludedQuestionIds.has(candidate.id) &&
      (candidate.type === 'TEXT' || candidate.type === 'LONG_TEXT'),
  );
  if (!question) {
    throw new Error('Canonical readiness round has no independent text question.');
  }
  return question;
}

function validReadinessAnswer(question: ReadinessRoundQuestion): AnswerValue {
  if (question.type === 'TEXT' || question.type === 'LONG_TEXT') {
    return `Readiness evidence for ${question.stableKey}`;
  }
  if (question.type === 'BOOLEAN') {
    return true;
  }
  if (question.type === 'NUMBER') {
    return 1;
  }
  if (question.type === 'DATE') {
    return '2026-08-10';
  }
  const options = question.options;
  if (!options || options.length === 0) {
    throw new Error(`Readiness question ${question.stableKey} has no selectable option.`);
  }
  if (question.type === 'SINGLE_SELECT') {
    return options[0];
  }
  if (question.type === 'MULTI_SELECT') {
    return [options[0]];
  }
  throw new Error(`Unsupported readiness question type ${question.type}.`);
}

function requireReadinessFactor(
  readiness: AvailableReadinessResponse,
  factorId: string,
): AvailableReadinessResponse['factors'][number] {
  const factor = readiness.factors.find((candidate) => candidate.id === factorId);
  if (!factor) {
    throw new Error(`Readiness response is missing factor ${factorId}.`);
  }
  return factor;
}

function createDatabaseUrlWithApplicationName(
  databaseUrl: string,
  applicationName: string,
): string {
  const parsedUrl = new URL(databaseUrl);
  parsedUrl.searchParams.set('application_name', applicationName);
  return parsedUrl.toString();
}

function assertDisposableQuestionRoundsDatabaseUrl(value: string): void {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(value);
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL for the real PostgreSQL E2E proof.');
  }
  if (parsedUrl.protocol !== 'postgres:' && parsedUrl.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use a PostgreSQL URL for the real PostgreSQL E2E proof.');
  }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsedUrl.hostname)) {
    throw new Error('DATABASE_URL must use a loopback PostgreSQL host for the real PostgreSQL E2E proof.');
  }

  let databaseName: string;
  try {
    databaseName = decodeURIComponent(parsedUrl.pathname.slice(1));
  } catch {
    throw new Error('DATABASE_URL must contain a valid disposable database name.');
  }
  if (!/(score01|e2e|test)/i.test(databaseName)) {
    throw new Error(
      'DATABASE_URL must use a disposable database whose name contains score01, e2e, or test.',
    );
  }
}

async function lockExistingRoundQuestionAssessmentOverride(
  dataSource: DataSource,
  roundId: string,
  snapshotId: string,
): Promise<QueryRunner> {
  const overrideRunner = dataSource.createQueryRunner();
  await overrideRunner.connect();
  await overrideRunner.startTransaction();
  try {
    const overrideRows = (await overrideRunner.query(
      `SELECT "id" FROM "round_question_assessment_overrides"
       WHERE "round_id" = $1 AND "snapshot_id" = $2
       FOR UPDATE`,
      [roundId, snapshotId],
    )) as Array<{ id: string }>;
    assert.equal(overrideRows.length, 1);
    return overrideRunner;
  } catch (error) {
    if (overrideRunner.isTransactionActive) {
      await overrideRunner.rollbackTransaction();
    }
    await overrideRunner.release();
    throw error;
  }
}

async function lockExistingRoundAnswer(
  dataSource: DataSource,
  roundId: string,
  snapshotId: string,
): Promise<QueryRunner> {
  const answerRunner = dataSource.createQueryRunner();
  await answerRunner.connect();
  await answerRunner.startTransaction();
  try {
    const answerRows = (await answerRunner.query(
      `SELECT "id" FROM "round_answers"
       WHERE "round_id" = $1 AND "snapshot_id" = $2
       FOR UPDATE`,
      [roundId, snapshotId],
    )) as Array<{ id: string }>;
    assert.equal(answerRows.length, 1);
    return answerRunner;
  } catch (error) {
    if (answerRunner.isTransactionActive) {
      await answerRunner.rollbackTransaction();
    }
    await answerRunner.release();
    throw error;
  }
}

async function loadWaitingApplicationQuery(
  dataSource: DataSource,
  applicationName: string,
): Promise<string> {
  const activityRows = await dataSource.query<Array<{ query: string | null }>>(
    `SELECT "query"
     FROM "pg_stat_activity"
     WHERE "application_name" = $1
       AND "wait_event_type" = 'Lock'
     ORDER BY "query_start" DESC
     LIMIT 1`,
    [applicationName],
  );
  const query = activityRows[0]?.query;
  if (query === null || query === undefined) {
    throw new Error(`No waiting PostgreSQL query found for ${applicationName}.`);
  }
  return query;
}

async function serializeExistingOverrideMutation<TResponse extends { status: number; body: unknown }>(
  dataSource: DataSource,
  applicationName: string,
  directMutationSql: string,
  directMutationParameters: string[],
  sendApiRequest: () => Promise<TResponse>,
): Promise<TResponse> {
  const identifierSuffix = randomUUID().replaceAll('-', '');
  const gateLockKey = Number.parseInt(identifierSuffix.slice(0, 12), 16);
  const gateTriggerName = `aaa_score01_override_gate_${identifierSuffix}`;
  const gateFunctionName = `score01_override_gate_${identifierSuffix}`;
  const gateRunner = dataSource.createQueryRunner();
  const overrideRunner = dataSource.createQueryRunner();
  let advisoryLockHeld = false;
  await gateRunner.connect();
  await overrideRunner.connect();

  try {
    await dataSource.query(`
      CREATE OR REPLACE FUNCTION "${gateFunctionName}"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        PERFORM pg_advisory_xact_lock(${gateLockKey}::bigint);
        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await dataSource.query(`
      CREATE TRIGGER "${gateTriggerName}"
      BEFORE UPDATE OR DELETE ON "round_question_assessment_overrides"
      FOR EACH ROW
      EXECUTE FUNCTION "${gateFunctionName}"()
    `);
    await gateRunner.query('SELECT pg_advisory_lock($1::bigint)', [gateLockKey]);
    advisoryLockHeld = true;

    await overrideRunner.startTransaction();
    const backendRows = (await overrideRunner.query(
      'SELECT pg_backend_pid() AS "pid"',
    )) as Array<{ pid: number }>;
    let overrideOutcome: 'completed' | 'pending' | 'rejected' = 'pending';
    const directMutationPromise = overrideRunner.query(
      directMutationSql,
      directMutationParameters,
    );
    void directMutationPromise.then(
      () => {
        overrideOutcome = 'completed';
      },
      () => {
        overrideOutcome = 'rejected';
      },
    );

    const directMutationWait = await observeQueryOutcomeOrLockWait(
      dataSource,
      backendRows[0].pid,
      () => overrideOutcome,
    );
    assert.equal(directMutationWait, 'blocked');

    let apiOutcome: 'completed' | 'pending' | 'rejected' = 'pending';
    const apiRequestPromise = sendApiRequest();
    void apiRequestPromise.then(
      () => {
        apiOutcome = 'completed';
      },
      () => {
        apiOutcome = 'rejected';
      },
    );
    const apiWait = await observeApplicationOutcomeOrLockWait(
      dataSource,
      applicationName,
      () => apiOutcome,
    );
    assert.equal(apiWait, 'blocked');

    await gateRunner.query('SELECT pg_advisory_unlock($1::bigint)', [gateLockKey]);
    advisoryLockHeld = false;
    await directMutationPromise;
    await overrideRunner.commitTransaction();
    return apiRequestPromise;
  } finally {
    if (advisoryLockHeld) {
      await gateRunner.query('SELECT pg_advisory_unlock($1::bigint)', [gateLockKey]);
    }
    if (overrideRunner.isTransactionActive) {
      await overrideRunner.rollbackTransaction();
    }
    await overrideRunner.release();
    await gateRunner.release();
    await dataSource.query(
      `DROP TRIGGER IF EXISTS "${gateTriggerName}" ON "round_question_assessment_overrides"`,
    );
    await dataSource.query(`DROP FUNCTION IF EXISTS "${gateFunctionName}"()`);
  }
}

async function serializeAcrossFirstChildInsert<
  TCreatorResponse extends { status: number; body: unknown },
  TWaitingResponse extends { status: number; body: unknown },
>(
  dataSource: DataSource,
  applicationName: string,
  targetTable: 'round_answers' | 'round_question_assessment_overrides',
  sendCreatorRequest: () => Promise<TCreatorResponse>,
  sendWaitingRequest: () => Promise<TWaitingResponse>,
): Promise<{
  readonly creatorResponse: TCreatorResponse;
  readonly waitingResponse: TWaitingResponse;
}> {
  const identifierSuffix = randomUUID().replaceAll('-', '');
  const gateLockKey = Number.parseInt(identifierSuffix.slice(0, 12), 16);
  const gateTriggerName = `aaa_s01_insert_gate_${identifierSuffix}`;
  const gateFunctionName = `s01_insert_gate_${identifierSuffix}`;
  const gateRunner = dataSource.createQueryRunner();
  let advisoryLockHeld = false;
  let creatorRequestPromise: Promise<TCreatorResponse> | undefined;
  let waitingRequestPromise: Promise<TWaitingResponse> | undefined;
  await gateRunner.connect();

  try {
    await dataSource.query(`
      CREATE OR REPLACE FUNCTION "${gateFunctionName}"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        PERFORM pg_advisory_xact_lock(${gateLockKey}::bigint);
        RETURN NEW;
      END;
      $$
    `);
    await dataSource.query(`
      CREATE TRIGGER "${gateTriggerName}"
      BEFORE INSERT ON "${targetTable}"
      FOR EACH ROW
      EXECUTE FUNCTION "${gateFunctionName}"()
    `);
    await gateRunner.query('SELECT pg_advisory_lock($1::bigint)', [gateLockKey]);
    advisoryLockHeld = true;

    let creatorOutcome: 'completed' | 'pending' | 'rejected' = 'pending';
    creatorRequestPromise = sendCreatorRequest();
    void creatorRequestPromise.then(
      () => {
        creatorOutcome = 'completed';
      },
      () => {
        creatorOutcome = 'rejected';
      },
    );
    const creatorQueries = await observeApplicationLockQueries(
      dataSource,
      applicationName,
      1,
      () => creatorOutcome,
    );
    assert.ok(
      creatorQueries.some((query) => query.includes(`INSERT INTO "${targetTable}"`)),
      `Expected the first ${targetTable} insert to wait on the advisory gate.`,
    );

    let waitingOutcome: 'completed' | 'pending' | 'rejected' = 'pending';
    waitingRequestPromise = sendWaitingRequest();
    void waitingRequestPromise.then(
      () => {
        waitingOutcome = 'completed';
      },
      () => {
        waitingOutcome = 'rejected';
      },
    );
    const waitingQueries = await observeApplicationLockQueries(
      dataSource,
      applicationName,
      2,
      () => waitingOutcome,
    );
    assert.ok(
      waitingQueries.some(
        (query) => query.includes('FROM "interview_rounds"') && query.includes('FOR UPDATE'),
      ),
      'Expected the second request to wait on the round row lock.',
    );

    await gateRunner.query('SELECT pg_advisory_unlock($1::bigint)', [gateLockKey]);
    advisoryLockHeld = false;
    const [creatorResponse, waitingResponse] = await Promise.all([
      creatorRequestPromise,
      waitingRequestPromise,
    ]);
    creatorRequestPromise = undefined;
    waitingRequestPromise = undefined;
    return { creatorResponse, waitingResponse };
  } finally {
    if (advisoryLockHeld) {
      await gateRunner.query('SELECT pg_advisory_unlock($1::bigint)', [gateLockKey]);
    }
    await Promise.allSettled(
      [creatorRequestPromise, waitingRequestPromise].filter(
        (pendingRequest): pendingRequest is Promise<TCreatorResponse> | Promise<TWaitingResponse> =>
          pendingRequest !== undefined,
      ),
    );
    await gateRunner.release();
    await dataSource.query(`DROP TRIGGER IF EXISTS "${gateTriggerName}" ON "${targetTable}"`);
    await dataSource.query(`DROP FUNCTION IF EXISTS "${gateFunctionName}"()`);
  }
}

async function observeApplicationLockQueries(
  dataSource: DataSource,
  applicationName: string,
  expectedCount: number,
  getOutcome: () => 'completed' | 'pending' | 'rejected',
): Promise<string[]> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const outcome = getOutcome();
    if (outcome !== 'pending') {
      throw new Error(
        `Application request ${outcome} before ${expectedCount} PostgreSQL lock waits were observed.`,
      );
    }
    const activityRows = await dataSource.query<Array<{ query: string | null }>>(
      `SELECT "query"
       FROM "pg_stat_activity"
       WHERE "application_name" = $1
         AND "wait_event_type" = 'Lock'
       ORDER BY "query_start" ASC`,
      [applicationName],
    );
    if (activityRows.length >= expectedCount) {
      return activityRows.flatMap((row) => (row.query === null ? [] : [row.query]));
    }
    await delay(10);
  }
  throw new Error(
    `PostgreSQL application ${applicationName} did not reach ${expectedCount} lock waits.`,
  );
}

async function loadAssessmentAuditEventTypes(
  dataSource: DataSource,
  projectId: string,
): Promise<string[]> {
  const rows = await dataSource.query<Array<{ eventType: string }>>(
    `SELECT "event_type" AS "eventType"
     FROM "audit_events"
     WHERE "project_id" = $1
       AND "event_type" IN ('ROUND_QUESTION_ASSESSMENT_SAVED', 'ROUND_QUESTION_ASSESSMENT_RESET')
     ORDER BY "created_at" ASC, "id" ASC`,
    [projectId],
  );
  return rows.map((row) => row.eventType);
}

async function observeQueryOutcomeOrLockWait(
  dataSource: DataSource,
  backendPid: number,
  getOutcome: () => 'completed' | 'pending' | 'rejected',
): Promise<'blocked' | 'completed' | 'rejected'> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const outcome = getOutcome();
    if (outcome !== 'pending') {
      return outcome;
    }
    const activityRows = await dataSource.query<Array<{ waitEventType: string | null }>>(
      `SELECT "wait_event_type" AS "waitEventType"
       FROM "pg_stat_activity"
       WHERE "pid" = $1`,
      [backendPid],
    );
    if (activityRows[0]?.waitEventType === 'Lock') {
      return 'blocked';
    }
    await delay(10);
  }
  throw new Error(`PostgreSQL backend ${backendPid} did not finish or enter a lock wait.`);
}

async function observeApplicationOutcomeOrLockWait(
  dataSource: DataSource,
  applicationName: string,
  getOutcome: () => 'completed' | 'pending' | 'rejected',
): Promise<'blocked' | 'completed' | 'rejected'> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const outcome = getOutcome();
    if (outcome !== 'pending') {
      return outcome;
    }
    const activityRows = await dataSource.query<Array<{ waitEventType: string | null }>>(
      `SELECT "wait_event_type" AS "waitEventType"
       FROM "pg_stat_activity"
       WHERE "application_name" = $1
       ORDER BY "backend_start" DESC
       LIMIT 1`,
      [applicationName],
    );
    if (activityRows[0]?.waitEventType === 'Lock') {
      return 'blocked';
    }
    await delay(10);
  }
  throw new Error(
    `PostgreSQL application ${applicationName} did not finish or enter a lock wait.`,
  );
}
