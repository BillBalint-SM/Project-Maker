import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { Core0001Core1785916800000 } from '../src/migrations/0001-core';
import { QuestionsRounds0002QuestionsRounds1786003200000 } from '../src/migrations/0002-questions-rounds';
import { InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000 } from '../src/migrations/0005-initial-intake-open-round';

describe('Question bank and interview rounds (PostgreSQL e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  before(async () => {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required for the real PostgreSQL R2 proof.');
    }

    const migrationDataSource = new DataSource({
      type: 'postgres',
      url: databaseUrl,
      synchronize: false,
      migrations: [
        Core0001Core1785916800000,
        QuestionsRounds0002QuestionsRounds1786003200000,
        InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000,
      ],
    });
    await migrationDataSource.initialize();
    await migrationDataSource.runMigrations();
    await migrationDataSource.destroy();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
  });

  after(async () => {
    await app.close();
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
