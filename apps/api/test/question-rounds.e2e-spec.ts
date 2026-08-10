import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import request from 'supertest';
import { DataSource, type QueryRunner } from 'typeorm';

import { AppModule } from '../src/app.module';
import { Core0001Core1785916800000 } from '../src/migrations/0001-core';
import { QuestionsRounds0002QuestionsRounds1786003200000 } from '../src/migrations/0002-questions-rounds';
import { MarkdownRevisions0003MarkdownRevisions1786089600000 } from '../src/migrations/0003-markdown-revisions';
import { InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000 } from '../src/migrations/0005-initial-intake-open-round';
import { RoundQuestionAssessmentOverrides0009RoundQuestionAssessmentOverrides1786608000000 } from '../src/migrations/0009-round-question-assessment-overrides';
import { RoundAnswerValidationParity0010RoundAnswerValidationParity1786694400000 } from '../src/migrations/0010-round-answer-validation-parity';

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
    databaseUrl = configuredDatabaseUrl;

    const migrationDataSource = new DataSource({
      type: 'postgres',
      url: databaseUrl,
      synchronize: false,
      migrations: [
        Core0001Core1785916800000,
        QuestionsRounds0002QuestionsRounds1786003200000,
        MarkdownRevisions0003MarkdownRevisions1786089600000,
        InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000,
        RoundQuestionAssessmentOverrides0009RoundQuestionAssessmentOverrides1786608000000,
        RoundAnswerValidationParity0010RoundAnswerValidationParity1786694400000,
      ],
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

    app = moduleFixture.createNestApplication();
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
    const { projectId } = await createProjectWithQuestionTypesSchema(
      app,
      `Assessment answer whitespace ${Date.now()}`,
      'assessment-answer-whitespace',
      ['TEXT', 'LONG_TEXT'],
    );
    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'STAKEHOLDER' })
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
    const { projectId } = await createProjectWithQuestionTypesSchema(
      app,
      `Assessment early date ${Date.now()}`,
      'assessment-early-date',
      ['DATE'],
    );
    const createdRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'STAKEHOLDER' })
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

  it('returns 404 for every foreign-project assessment route before an override lock is released', async () => {
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
    const projectBAssessmentUrl =
      `/projects/${projectBId}/rounds/${roundId}/answers/${snapshotId}/assessment`;
    const projectAAssessmentUrl =
      `/projects/${projectAId}/rounds/${roundId}/answers/${snapshotId}/assessment`;
    await request(app.getHttpServer())
      .put(projectBAssessmentUrl)
      .send({ status: 'Nem releváns', rationale: 'Project B scope proof' })
      .expect(200);

    const overrideRunner = await lockExistingRoundQuestionAssessmentOverride(
      controlDataSource,
      roundId,
      snapshotId,
    );
    let pendingResponse: Promise<{ status: number }> | undefined;
    try {
      const foreignProjectRoutes = [
        {
          name: 'PATCH',
          send: async () =>
            request(app.getHttpServer())
              .patch(`/projects/${projectAId}/rounds/${roundId}/answers/${snapshotId}`)
              .send({ value: null }),
        },
        {
          name: 'PUT',
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

      for (const route of foreignProjectRoutes) {
        let routeOutcome: 'completed' | 'pending' | 'rejected' = 'pending';
        pendingResponse = route.send();
        void pendingResponse.then(
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
        const response = await pendingResponse;
        pendingResponse = undefined;
        assert.equal(response.status, 404);
      }
    } finally {
      if (overrideRunner.isTransactionActive) {
        await overrideRunner.rollbackTransaction();
      }
      await overrideRunner.release();
      if (pendingResponse) {
        await pendingResponse;
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

  it('keeps answer clearing, completion gates, and completed assessment immutability consistent', async () => {
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
      .expect(409);
    assert.deepEqual(partialCompletionResponse.body.missingSnapshotIds, [snapshotId]);

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
    assert.equal(completedResponse.body.status, 'COMPLETED');
    assert.equal(completedResponse.body.questions[0].checklistStatus, 'Nem releváns');
    assert.equal(completedResponse.body.questions[0].assessmentRationale, rationale);

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
      'An open initial intake round already exists for this project.',
    );
  });

  it('returns null after initial intake completion and allows a new initial intake round', async () => {
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
    assert.equal(activeRoundResponse.body, null);

    const restartedRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);

    assert.notEqual(restartedRoundResponse.body.id, roundId);
    assert.equal(restartedRoundResponse.body.status, 'OPEN');
    assert.equal(restartedRoundResponse.body.type, 'INITIAL_INTAKE');
  });

  it('keeps prior round snapshots immutable and blocks completion until required answers exist', async () => {
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
      'UPDATE "interview_rounds" SET "status" = \'COMPLETED\', "completed_at" = CURRENT_TIMESTAMP WHERE "id" = $1',
      [firstRoundId],
    );
    await assert.rejects(gateUpdate, /required answers/);
    await assert.rejects(
      dataSource.query(
        `INSERT INTO "interview_rounds" (
          "id", "project_id", "project_schema_id", "type", "status", "completed_at", "source"
        ) VALUES ($1, $2, $3, 'INITIAL_INTAKE', 'COMPLETED', CURRENT_TIMESTAMP, 'DIRECT_TEST')`,
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
      .send({ type: 'CLARIFICATION' })
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

    const blockedResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${secondRoundId}/complete`)
      .expect(409);
    assert.deepEqual(blockedResponse.body.missingSnapshotIds, [secondSnapshotId]);

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/rounds/${secondRoundId}/answers/${secondSnapshotId}`)
      .send({ value: 'A required answer' })
      .expect(200);

    const completedResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${secondRoundId}/complete`)
      .expect(201);
    assert.equal(completedResponse.body.status, 'COMPLETED');

    await assert.rejects(
      dataSource.query('UPDATE "interview_rounds" SET "type" = \'STAKEHOLDER\' WHERE "id" = $1', [secondRoundId]),
      /completed|immutable/,
    );
    await assert.rejects(
      dataSource.query('DELETE FROM "interview_rounds" WHERE "id" = $1', [secondRoundId]),
      /completed|immutable/,
    );
    const completedAnswerRows = await dataSource.query<Array<{ id: string }>>(
      'SELECT "id" FROM "round_answers" WHERE "round_id" = $1',
      [secondRoundId],
    );
    await assert.rejects(
      dataSource.query('UPDATE "round_answers" SET "value" = $1 WHERE "id" = $2', [JSON.stringify('changed'), completedAnswerRows[0].id]),
      /completed|immutable/,
    );
    await assert.rejects(
      dataSource.query('DELETE FROM "round_answers" WHERE "id" = $1', [completedAnswerRows[0].id]),
      /completed|immutable/,
    );
    await assert.rejects(
      dataSource.query(
        'UPDATE "round_answers" SET "round_id" = $1, "snapshot_id" = $2 WHERE "id" = $3',
        [firstRoundId, firstSnapshotId, completedAnswerRows[0].id],
      ),
      /completed|immutable|identity/,
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
        stableKey: `r2-date-${Date.now()}`,
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
      })
      .expect(201);
    const dateProjectId = dateProjectResponse.body.id as string;
    await request(app.getHttpServer())
      .post(`/projects/${dateProjectId}/question-schema`)
      .send({ questions: [{ stableKey: dateQuestion.stableKey, required: true, blocking: true }] })
      .expect(201);
    const dateRoundResponse = await request(app.getHttpServer())
      .post(`/projects/${dateProjectId}/rounds`)
      .send({ type: 'STAKEHOLDER' })
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
    await assert.rejects(
      dataSource.query(
        'UPDATE "interview_rounds" SET "status" = \'COMPLETED\', "completed_at" = CURRENT_TIMESTAMP WHERE "id" = $1',
        [dateRoundResponse.body.id],
      ),
      /type|valid|answer|completion/,
    );
  });
});

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
): Promise<{ projectId: string }> {
  const stableKeys: string[] = [];
  for (const [index, questionType] of questionTypes.entries()) {
    const bankResponse = await request(app.getHttpServer())
      .get('/settings/base-questions')
      .expect(200);
    const stableKey = `${emailPrefix}-${questionType.toLowerCase().replaceAll('_', '-')}-${Date.now()}-${index}`;
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

  return { projectId };
}

function createDatabaseUrlWithApplicationName(
  databaseUrl: string,
  applicationName: string,
): string {
  const parsedUrl = new URL(databaseUrl);
  parsedUrl.searchParams.set('application_name', applicationName);
  return parsedUrl.toString();
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
