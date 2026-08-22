import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';

describe('Question Bank reference files (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  before(async () => {
    process.env['NODE_ENV'] = 'test';
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
    dataSource = app.get(DataSource);
  });

  after(async () => app.close());

  it('publishes exact reference-file sets without copying unchanged bytes', async () => {
    const initialBank = await request(app.getHttpServer())
      .get('/settings/base-questions')
      .expect(200);
    const target = (initialBank.body.questions as BankQuestion[]).find(
      ({ type }) => type === 'LONG_TEXT',
    );
    assert.ok(target, 'The seeded Question Bank must contain a LONG_TEXT question.');
    const other = (initialBank.body.questions as BankQuestion[]).find(
      ({ id }) => id !== target.id,
    );
    assert.ok(other, 'The seeded Question Bank must contain another question.');

    await request(app.getHttpServer())
      .post(`/settings/base-questions/${target.id}/reference-files`)
      .attach('file', Buffer.from('unsafe', 'utf8'), {
        filename: 'unsafe<name>.txt',
        contentType: 'text/plain',
      })
      .expect(400);
    const unchangedBank = await request(app.getHttpServer())
      .get('/settings/base-questions')
      .expect(200);
    assert.equal(unchangedBank.body.version, initialBank.body.version);

    const uploaded = await request(app.getHttpServer())
      .post(`/settings/base-questions/${target.id}/reference-files`)
      .attach('file', Buffer.from('elfogadott üzleti háttér', 'utf8'), {
        filename: 'ügyfél-háttér.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    assert.equal(uploaded.body.version, initialBank.body.version + 1);
    const firstPublishedTarget = questionByKey(uploaded.body.questions, target.stableKey);
    assert.equal(firstPublishedTarget.referenceFiles.length, 1);
    const firstReference = firstPublishedTarget.referenceFiles[0];
    assert.equal(firstReference.originalName, 'ügyfél-háttér.txt');

    const downloadedReference = await request(app.getHttpServer())
      .get(
        `/settings/base-questions/${firstPublishedTarget.id}/reference-files/${firstReference.id}/download`,
      )
      .expect('Content-Type', /text\/plain/)
      .expect('Content-Disposition', /attachment/)
      .expect(200);
    assert.equal(downloadedReference.text, 'elfogadott üzleti háttér');

    const project = await request(app.getHttpServer())
      .post('/projects')
      .send({
        name: `Reference set ${randomUUID()}`,
        customerContactName: 'Customer Contact',
        customerContactEmail: 'reference-set@example.test',
        internalOwnerName: 'Internal PO',
        nextActionOwnerRole: 'INTERNAL_OWNER',
      })
      .expect(201);
    const schema = await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/question-schema`)
      .send({ questions: [{ stableKey: target.stableKey }] })
      .expect(201);
    assert.deepEqual(schema.body.questions[0].referenceFiles, [firstReference]);
    const round = await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    assert.deepEqual(round.body.questions[0].referenceFiles, [firstReference]);
    const savedAnswer = await request(app.getHttpServer())
      .patch(
        `/projects/${project.body.id as string}/rounds/${round.body.id as string}/answers/${round.body.questions[0].id as string}`,
      )
      .send({ value: 'Megőrzött referenciahalmaz.' })
      .expect(200);
    assert.deepEqual(savedAnswer.body.referenceFiles, [firstReference]);

    const currentOther = questionByKey(uploaded.body.questions, other.stableKey);
    const copiedBank = await request(app.getHttpServer())
      .patch('/settings/base-questions')
      .send({ id: currentOther.id, topic: `${currentOther.topic} – pontosítva` })
      .expect(200);
    const copiedTarget = questionByKey(copiedBank.body.questions, target.stableKey);
    assert.deepEqual(copiedTarget.referenceFiles, [firstReference]);
    const storageCounts = await dataSource.query<
      Array<{ contentCount: string; relationCount: string }>
    >(`SELECT
      (SELECT COUNT(*)::text FROM "question_reference_file_contents") AS "contentCount",
      (SELECT COUNT(*)::text FROM "question_reference_files") AS "relationCount"`);
    assert.deepEqual(storageCounts, [{ contentCount: '1', relationCount: '2' }]);

    const withSecondReference = await request(app.getHttpServer())
      .post(`/settings/base-questions/${copiedTarget.id}/reference-files`)
      .attach('file', Buffer.from('second reference', 'utf8'), {
        filename: 'második-forrás.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    const targetWithTwo = questionByKey(
      withSecondReference.body.questions,
      target.stableKey,
    );
    assert.equal(targetWithTwo.referenceFiles.length, 2);

    const retainedSchema = await request(app.getHttpServer())
      .get(`/projects/${project.body.id as string}/question-schema`)
      .expect(200);
    assert.deepEqual(retainedSchema.body.questions[0].referenceFiles, [firstReference]);

    const afterRemoval = await request(app.getHttpServer())
      .delete(
        `/settings/base-questions/${targetWithTwo.id}/reference-files/${firstReference.id}`,
      )
      .expect(200);
    const latestTarget = questionByKey(afterRemoval.body.questions, target.stableKey);
    assert.deepEqual(
      latestTarget.referenceFiles.map(({ originalName }) => originalName),
      ['második-forrás.txt'],
    );

    await request(app.getHttpServer())
      .get(
        `/settings/base-questions/${schema.body.questions[0].baseQuestionId as string}/reference-files/${firstReference.id}/download`,
      )
      .expect(200);
    await request(app.getHttpServer())
      .post(`/settings/base-questions/${targetWithTwo.id}/reference-files`)
      .attach('file', Buffer.from('stale change', 'utf8'), {
        filename: 'stale.txt',
        contentType: 'text/plain',
      })
      .expect(409);
  });
});

interface ReferenceFile {
  readonly id: string;
  readonly originalName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly sha256: string;
  readonly createdAt: string;
}

interface BankQuestion {
  readonly id: string;
  readonly stableKey: string;
  readonly topic: string;
  readonly type: string;
  readonly referenceFiles: readonly ReferenceFile[];
}

function questionByKey(questions: readonly BankQuestion[], stableKey: string): BankQuestion {
  const question = questions.find((candidate) => candidate.stableKey === stableKey);
  assert.ok(question);
  return question;
}
