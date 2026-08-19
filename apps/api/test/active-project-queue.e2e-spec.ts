import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { DataSource, type QueryRunner } from 'typeorm';

import { AppModule } from '../src/app.module';
import {
  activeProjectQueueClockToken,
  classifyActiveProjectUrgency,
  compareActiveProjectQueueOrder,
} from '../src/projects/active-project-queue.service';
import { Project } from '../src/projects/project.entity';

const urgencyOrder = ['CUSTOMER_REPLY', 'OVERDUE', 'DUE_SOON', 'IN_PROGRESS'] as const;
const fixedNow = new Date('2026-03-22T11:00:00.000Z');

describe('Active project queue (e2e)', () => {
  let app: INestApplication;

  before(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(activeProjectQueueClockToken)
      .useValue({ now: () => fixedNow })
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  after(async () => {
    await app.close();
  });

  it('returns the first explainably ordered page of non-archived Projects', async () => {
    const created = await request(app.getHttpServer())
      .post('/projects')
      .send({
        name: `Active queue smoke ${Date.now()}`,
        customerContactName: 'Queue Customer',
        customerContactEmail: `active-queue-${Date.now()}@example.test`,
        internalOwnerName: 'Queue PO/PM',
        nextActionOwnerRole: 'INTERNAL_OWNER',
        nextAction: 'Folytasd a projekt előkészítését.',
      })
      .expect(201);

    const archived = await request(app.getHttpServer())
      .post('/projects')
      .send({
        name: `Archived queue smoke ${Date.now()}`,
        customerContactName: 'Archived Customer',
        customerContactEmail: `archived-queue-${Date.now()}@example.test`,
        internalOwnerName: 'Archived PO/PM',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${archived.body.id as string}/archive`)
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/projects/active-queue')
      .expect(200);

    assert.ok(Array.isArray(response.body.items));
    assert.ok(response.body.items.length <= 10);
    assert.ok(response.body.totalCount >= response.body.items.length);
    assert.equal(response.body.retrievedAt, fixedNow.toISOString());
    assert.equal(response.body.items.some((item: { projectId: string }) => item.projectId === archived.body.id), false);

    const activeProjects = await request(app.getHttpServer()).get('/projects').expect(200);
    const activeById = new Map(
      activeProjects.body
        .filter((project: { status: string }) => project.status !== 'ARCHIVED')
        .map((project: { id: string; status: string }) => [project.id, project]),
    );
    assert.ok(activeById.has(created.body.id as string));

    let previousUrgencyIndex = -1;
    for (const item of response.body.items as Array<{
      projectId: string;
      urgency: string;
      urgencyLabel: string;
      preparationStatus: { state: string; label: string; primaryAction: { target: string; label: string } };
      primaryAction: { target: string; label: string };
    }>) {
      assert.ok(activeById.has(item.projectId));
      const urgencyIndex = urgencyOrder.indexOf(item.urgency as (typeof urgencyOrder)[number]);
      assert.notEqual(urgencyIndex, -1);
      assert.ok(urgencyIndex >= previousUrgencyIndex);
      previousUrgencyIndex = urgencyIndex;
      assert.ok(item.urgencyLabel.length > 0);
      assert.ok(item.preparationStatus.state.length > 0);
      assert.ok(item.preparationStatus.label.length > 0);
      assert.ok(item.primaryAction.target.length > 0);
      assert.ok(item.primaryAction.label.length > 0);
    }
  });

  it('uses the controlled clock and Budapest calendar days across daylight-saving time', () => {
    assert.equal(
      classifyActiveProjectUrgency(new Date('2026-03-22T10:59:59.999Z'), false, fixedNow),
      'OVERDUE',
    );
    assert.equal(
      classifyActiveProjectUrgency(new Date('2026-03-29T21:59:59.999Z'), false, fixedNow),
      'DUE_SOON',
    );
    assert.equal(
      classifyActiveProjectUrgency(new Date('2026-03-29T22:00:00.000Z'), false, fixedNow),
      'IN_PROGRESS',
    );
    assert.equal(
      classifyActiveProjectUrgency(new Date('2026-03-01T00:00:00.000Z'), true, fixedNow),
      'CUSTOMER_REPLY',
    );
  });

  it('keeps Customer-reply urgency until correspondence processing changes its status', async () => {
    const { projectId, handoffId } = await createEndedQueueProject(
      app,
      `Customer reply queue ${Date.now()}`,
      '1800-01-01T00:00:00.000Z',
    );
    const correspondenceId = randomUUID();
    const outboundId = randomUUID();
    const uniqueToken = randomUUID().replaceAll('-', '').padEnd(64, '0');
    await app.get(DataSource).query(
      `INSERT INTO customer_outbound_communications (
         id, project_id, source_type, source_id, sender_name, sender_address,
         recipient_name, recipient_address, subject, html_content, text_content,
         source_content_version, preview_digest, reply_to_address, reply_token_hash
       ) VALUES ($1, $2, 'INTERVIEW_HANDOFF', $3, 'PO Péter', 'po.peter@pte.hu',
         'Ügyfél Anna', 'customer@example.test', 'Teszt', '<p>Teszt</p>', 'Teszt',
         1, $4, 'reply@example.test', $5)`,
      [outboundId, projectId, handoffId, uniqueToken, uniqueToken],
    );
    await app.get(DataSource).query(
      `INSERT INTO customer_correspondences (
         id, project_id, outbound_communication_id, status, unread_message_count
       ) VALUES ($1, $2, $3, 'Új válasz', 1)`,
      [correspondenceId, projectId, outboundId],
    );

    let item = await queueItem(app, projectId);
    assert.equal(item.urgency, 'CUSTOMER_REPLY');
    assert.equal(item.newReplyCount, 1);
    assert.deepEqual(item.primaryAction, {
      target: 'CUSTOMER_CORRESPONDENCE',
      label: 'Ügyféllevelezés megnyitása',
    });

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-correspondences/${correspondenceId}/commands`)
      .send({ command: 'MARK_REVIEWED', expectedVersion: 1 })
      .expect(201);
    item = await queueItem(app, projectId);
    assert.equal(item.urgency, 'CUSTOMER_REPLY');
    assert.equal(item.newReplyCount, 1);

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-correspondences/${correspondenceId}/commands`)
      .send({ command: 'SET_STATUS', status: 'Feldolgozás alatt', expectedVersion: 2 })
      .expect(201);
    item = await queueItem(app, projectId);
    assert.equal(item.urgency, 'OVERDUE');
    assert.notEqual(item.primaryAction.target, 'CUSTOMER_CORRESPONDENCE');
  });

  it('orders equal-urgency work by due time, normalized Hungarian name, then stable identity', () => {
    const sorted = [
      { urgency: 'IN_PROGRESS' as const, dueAt: null, projectName: 'Nincs határidő', projectId: '4' },
      { urgency: 'OVERDUE' as const, dueAt: new Date('2026-01-02T00:00:00Z'), projectName: 'Korábbi név', projectId: '3' },
      { urgency: 'OVERDUE' as const, dueAt: new Date('2026-01-01T00:00:00Z'), projectName: 'arviz', projectId: '2' },
      { urgency: 'OVERDUE' as const, dueAt: new Date('2026-01-01T00:00:00Z'), projectName: 'Árvíz', projectId: '1' },
      { urgency: 'CUSTOMER_REPLY' as const, dueAt: null, projectName: 'Válasz', projectId: '5' },
    ].sort(compareActiveProjectQueueOrder);

    assert.deepEqual(sorted.map(({ projectId }) => projectId), ['5', '1', '2', '3', '4']);
  });

  it('combines normalized name, multi-value urgency and preparation filters with stable facet counts', async () => {
    const token = randomUUID().slice(0, 8);
    const overdue = await createQueueProject(app, `Árvíztűrő ${token} lejárt`, '1800-01-01T00:00:00.000Z');
    await createQueueProject(app, `Árvíztűrő ${token} folyamatban`);
    const intake = await createQueueProject(app, `Árvíztűrő ${token} felmérés`, '1801-01-01T00:00:00.000Z');
    const bank = await request(app.getHttpServer()).get('/settings/base-questions').expect(200);
    const stableKey = bank.body.questions[0].stableKey as string;
    await request(app.getHttpServer()).post(`/projects/${intake.id}/question-schema`).send({
      questions: [{ stableKey, required: true, blocking: true }],
    }).expect(201);
    await request(app.getHttpServer()).post(`/projects/${intake.id}/rounds`).send({
      type: 'INITIAL_INTAKE',
    }).expect(201);

    const response = await request(app.getHttpServer())
      .get('/projects/active-queue')
      .query({
        q: `  ARVIZTURO ${token.toUpperCase()}  `,
        urgency: ['OVERDUE', 'DUE_SOON'],
        preparation: ['SCHEMA_REQUIRED', 'ESTIMATE_READY'],
      })
      .expect(200);

    assert.deepEqual(response.body.items.map((item: { projectId: string }) => item.projectId), [overdue.id]);
    assert.equal(response.body.totalCount, 1);
    assert.deepEqual(response.body.groupCounts, {
      CUSTOMER_REPLY: 0,
      OVERDUE: 1,
      DUE_SOON: 0,
      IN_PROGRESS: 1,
    });
  });

  it('keeps the database read count fixed as the active portfolio grows', async () => {
    const bank = await request(app.getHttpServer()).get('/settings/base-questions').expect(200);
    const stableKey = bank.body.questions[0].stableKey as string;
    await createEndedQueueProject(
      app,
      `Query count baseline ${Date.now()}`,
      '1799-01-01T00:00:00.000Z',
      stableKey,
    );
    const before = await countQueueReadQueries(app);

    for (let index = 0; index < 11; index += 1) {
      await createEndedQueueProject(
        app,
        `Query count Project ${String(index).padStart(2, '0')} ${Date.now()}`,
        `17${String(index).padStart(2, '0')}-01-01T00:00:00.000Z`,
        stableKey,
      );
    }

    const after = await countQueueReadQueries(app);
    assert.equal(after, before);
  });
});

interface QueueTestItem {
  readonly urgency: string;
  readonly newReplyCount: number;
  readonly primaryAction: { readonly target: string; readonly label: string };
}

async function queueItem(app: INestApplication, projectId: string): Promise<QueueTestItem> {
  const project = await app.get(DataSource).getRepository(Project).findOneByOrFail({ id: projectId });
  const response = await request(app.getHttpServer())
    .get('/projects/active-queue')
    .query({ q: project.name })
    .expect(200);
  const item = (response.body.items as Array<QueueTestItem & { projectId: string }>)
    .find((candidate) => candidate.projectId === projectId);
  assert.ok(item, `Expected Project ${projectId} on the first Active project queue page.`);
  return item;
}

async function createEndedQueueProject(
  app: INestApplication,
  name: string,
  dueAt: string,
  knownStableKey?: string,
): Promise<{ projectId: string; handoffId: string }> {
  const project = await request(app.getHttpServer()).post('/projects').send({
    name,
    customerContactName: 'Queue Customer',
    customerContactEmail: `queue-${Date.now()}-${Math.random()}@example.test`,
    internalOwnerName: 'Queue PO/PM',
    dueAt,
  }).expect(201);
  const stableKey = knownStableKey ?? (
    await request(app.getHttpServer()).get('/settings/base-questions').expect(200)
  ).body.questions[0].stableKey as string;
  await request(app.getHttpServer()).post(`/projects/${project.body.id as string}/question-schema`).send({
    questions: [{ stableKey, required: true, blocking: true }],
  }).expect(201);
  const round = await request(app.getHttpServer())
    .post(`/projects/${project.body.id as string}/rounds`)
    .send({ type: 'INITIAL_INTAKE' })
    .expect(201);
  await request(app.getHttpServer())
    .post(`/projects/${project.body.id as string}/rounds/${round.body.id as string}/finish`)
    .send({})
    .expect(201);
  const handoffs = await request(app.getHttpServer())
    .get(`/projects/${project.body.id as string}/rounds/${round.body.id as string}/customer-handoffs`)
    .expect(200);
  return { projectId: project.body.id as string, handoffId: handoffs.body[0].id as string };
}

async function createQueueProject(
  app: INestApplication,
  name: string,
  dueAt?: string,
): Promise<{ readonly id: string }> {
  const response = await request(app.getHttpServer()).post('/projects').send({
    name,
    customerContactName: 'Queue Customer',
    customerContactEmail: `queue-${Date.now()}-${Math.random()}@example.test`,
    internalOwnerName: 'Queue PO/PM',
    ...(dueAt ? { dueAt } : {}),
  }).expect(201);
  return { id: response.body.id as string };
}

async function countQueueReadQueries(app: INestApplication): Promise<number> {
  const dataSource = app.get(DataSource);
  const originalLogQuery = dataSource.logger.logQuery;
  let readCount = 0;
  dataSource.logger.logQuery = (
    query: string,
    _parameters?: readonly unknown[],
    _queryRunner?: QueryRunner,
  ) => {
    if (/^\s*(SELECT|WITH)\b/i.test(query)) {
      readCount += 1;
    }
  };
  try {
    await request(app.getHttpServer()).get('/projects/active-queue').expect(200);
  } finally {
    dataSource.logger.logQuery = originalLogQuery;
  }
  return readCount;
}
