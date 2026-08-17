import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { CustomerFollowUpService } from '../src/follow-ups/follow-up.service';
import {
  customerMailerToken,
  type CustomerMailerMessage,
} from '../src/mail-delivery/smtp-mailer.service';

describe('Customer SMTP boundary', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let followUpService: CustomerFollowUpService;
  const delivered: CustomerMailerMessage[] = [];

  before(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(customerMailerToken)
      .useValue({
        isConfigured: () => true,
        send: async (message: CustomerMailerMessage) => {
          delivered.push(message);
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
    const history = await request(app.getHttpServer())
      .get(`/projects/${projectId}/audit-events`)
      .expect(200);
    assert.ok(
      history.body.events.some(
        (event: { eventType: string; payload: Record<string, string> }) =>
          event.eventType === 'CUSTOMER_REVIEW_EMAIL_SENT' &&
          event.payload.revisionVersion === '3',
      ),
    );
  });

  it('rejects revision input and keeps manual and scheduled ping payloads free of Markdown', async () => {
    const projectId = await createProject(app, 'revision-free-ping');
    const revision = await request(app.getHttpServer())
      .post(`/projects/${projectId}/markdown-revisions`)
      .send({ reason: 'MANUAL' })
      .expect(201);

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
      .send({ expectedVersion: draft.body.draftVersion })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: preview.body.previewToken })
      .expect(201);
    assertPingHasNoMarkdown(delivered[0], revision.body.content as string);

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up`)
      .send({ enabled: true, intervalMinutes: 1, expiresAt: null })
      .expect(200);
    const dueAt = new Date('2030-01-01T00:00:00.000Z');
    await dataSource.query(
      `UPDATE "customer_follow_ups" SET "next_ping_at" = $2 WHERE "project_id" = $1`,
      [projectId, new Date(dueAt.getTime() - 60_000)],
    );

    await followUpService.processDuePings(dueAt);

    assert.equal(delivered.length, 2);
    assertPingHasNoMarkdown(delivered[1], revision.body.content as string);
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

function assertPingHasNoMarkdown(
  message: CustomerMailerMessage | undefined,
  revisionContent: string,
): void {
  assert.ok(message);
  assert.equal(message.html, undefined);
  assert.equal(message.text.includes(revisionContent), false);
  assert.doesNotMatch(message.text, /\.md\b|Claude Code|execution-plan revision/i);
}
