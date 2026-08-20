import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { DataSource } from 'typeorm';
import type { OutboundCustomerMessage } from '@project-maker/contracts';

import { AppModule } from '../src/app.module';
import { customerOutboundMailToken } from '../src/mail-delivery/customer-mail-boundary';
import { CustomerFollowUpService } from '../src/follow-ups/follow-up.service';

interface DeliveredMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
}

describe('Customer SMTP boundary', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let followUpService: CustomerFollowUpService;
  const delivered: DeliveredMessage[] = [];

  before(async () => {
    process.env['CORRESPONDENCE_MAILBOX_ADDRESS'] = 'project-maker@pte.hu';
    process.env['CORRESPONDENCE_MAILBOX_NAME'] = 'Project Maker';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(customerOutboundMailToken)
      .useValue({
        isConfigured: () => true,
        submit: async (message: OutboundCustomerMessage) => {
          delivered.push({ to: message.recipientAddress, subject: message.subject, text: message.textContent, html: message.htmlContent });
          return { acceptance: 'ACCEPTED', messageReference: null } as const;
        },
      })
      .compile();

    app = module.createNestApplication({ logger: false });
    await app.init();
    dataSource = app.get(DataSource);
    followUpService = app.get(CustomerFollowUpService);
  });

  beforeEach(() => {
    delivered.length = 0;
  });

  after(async () => app.close());

  it('removes the legacy customer-review route without creating a new legacy audit event', async () => {
    const projectId = await createProject(app, 'legacy-route');

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-review-email`)
      .send({})
      .expect(404);

    const rows = await dataSource.query<Array<{ count: string }>>(
      `SELECT COUNT(*)::text AS "count"
       FROM "audit_events"
       WHERE "project_id" = $1
         AND "event_type" IN ('CUSTOMER_REVIEW_EMAIL_SENT', 'CUSTOMER_REVIEW_EMAIL_FAILED')`,
      [projectId],
    );
    assert.equal(rows[0]?.count, '0');
    assert.equal(delivered.length, 0);

    const historicalEventId = randomUUID();
    await dataSource.query(
      `INSERT INTO "audit_events" ("id", "project_id", "event_type", "payload")
       VALUES ($1, $2, 'CUSTOMER_REVIEW_EMAIL_SENT', $3::jsonb)`,
      [historicalEventId, projectId, JSON.stringify({ revisionVersion: '3' })],
    );
    const history = await dataSource.query<Array<{ event_type: string; payload: Record<string, string> }>>(
      `SELECT "event_type", "payload"
       FROM "audit_events"
       WHERE "project_id" = $1`,
      [projectId],
    );
    assert.ok(history.some(
      (event) =>
        event.event_type === 'CUSTOMER_REVIEW_EMAIL_SENT' &&
        event.payload.revisionVersion === '3',
    ));
  });

  it('rejects revision input and keeps the manual ping free of internal delivery content', async () => {
    const projectId = await createProject(app, 'revision-free-ping');
    const handoffText = await createInterviewHandoffPreview(app, projectId);
    const revision = await request(app.getHttpServer())
      .post(`/projects/${projectId}/markdown-revisions`)
      .send({ reason: 'MANUAL' });
    assert.equal(revision.status, 201, JSON.stringify(revision.body));

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ revisionId: revision.body.id })
      .expect(400);
    assert.equal(delivered.length, 0);

    const draft = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({
        messageDraft: 'Rövid, revision-free ügyfél-ping.',
        referencedFollowUpId: null,
        expectedVersion: 1,
      })
      .expect(200);
    const preview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/preview`)
      .send({ expectedVersion: draft.body.draftVersion });
    assert.equal(preview.status, 201, JSON.stringify(preview.body));
    const sent = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: preview.body.previewToken });
    assert.equal(sent.status, 201, JSON.stringify(sent.body));
    assertPingHasNoInternalDeliveryContent(
      delivered[0],
      revision.body.content as string,
      handoffText,
    );
  });

  it('keeps the scheduled ping free of internal delivery content', async () => {
    const projectId = await createProject(app, 'scheduled-boundary');
    const handoffText = await createInterviewHandoffPreview(app, projectId);
    const revision = await request(app.getHttpServer())
      .post(`/projects/${projectId}/markdown-revisions`)
      .send({ reason: 'MANUAL' })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({
        messageDraft: 'Kérlek, jelezd a következő egyeztetés időpontját.',
        referencedFollowUpId: null,
        expectedVersion: 1,
      })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up`)
      .send({ enabled: true, intervalMinutes: 60 })
      .expect(200);

    const dueAt = new Date('2030-01-01T12:00:00.000Z');
    await dataSource.query(
      'UPDATE customer_follow_ups SET next_ping_at = $2 WHERE project_id = $1',
      [projectId, dueAt],
    );
    const results = await followUpService.processDuePings(dueAt);

    assert.equal(results.length, 1);
    assertPingHasNoInternalDeliveryContent(
      delivered[0],
      revision.body.content as string,
      handoffText,
    );

  });
});

async function createProject(app: INestApplication, label: string): Promise<string> {
  const response = await request(app.getHttpServer())
    .post('/projects')
    .send({
      name: `SMTP boundary ${label} ${Date.now()}-${Math.random()}`,
      customerContactName: 'Teszt Ügyfél',
      customerContactEmail: `smtp-boundary-${Date.now()}-${Math.random()}@example.test`,
      internalOwnerName: 'Teszt PO/PM',
      nextActionOwnerRole: 'INTERNAL_OWNER',
    })
    .expect(201);
  return response.body.id as string;
}

async function createInterviewHandoffPreview(
  app: INestApplication,
  projectId: string,
): Promise<string> {
  const bank = await request(app.getHttpServer())
    .get('/settings/base-questions')
    .expect(200);
  const stableKey = bank.body.questions[0]?.stableKey as string | undefined;
  assert.ok(stableKey);
  await request(app.getHttpServer())
    .post(`/projects/${projectId}/question-schema`)
    .send({ questions: [{ stableKey, required: true, blocking: true }] })
    .expect(201);
  const round = await request(app.getHttpServer())
    .post(`/projects/${projectId}/rounds`)
    .send({ type: 'INITIAL_INTAKE' })
    .expect(201);
  await request(app.getHttpServer())
    .post(`/projects/${projectId}/rounds/${round.body.id}/finish`)
    .send({})
    .expect(201);
  const handoffs = await request(app.getHttpServer())
    .get(`/projects/${projectId}/rounds/${round.body.id}/customer-handoffs`)
    .expect(200);
  const handoffId = handoffs.body[0]?.id as string | undefined;
  assert.ok(handoffId);
  const preview = await request(app.getHttpServer())
    .post(`/projects/${projectId}/rounds/${round.body.id}/customer-handoffs/${handoffId}/preview`)
    .send({})
    .expect(201);
  return preview.body.textContent as string;
}

function assertPingHasNoInternalDeliveryContent(
  message: DeliveredMessage | undefined,
  revisionContent: string,
  handoffText: string,
): void {
  assert.ok(message);
  assert.equal(message.html, undefined);
  assert.equal(message.text.includes(revisionContent), false);
  assert.equal(message.text.includes(handoffText), false);
  assert.doesNotMatch(message.text, /Nincs rögzített válasz/);
  assert.doesNotMatch(message.text, /\.md\b|Claude Code|execution-plan revision/i);
}
