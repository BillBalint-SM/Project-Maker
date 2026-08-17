import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { DataSource } from 'typeorm';
import type { OutboundCustomerMessage } from '@project-maker/contracts';

import { AppModule } from '../src/app.module';
import {
  customerMailerToken,
  type CustomerMailerMessage,
} from '../src/mail-delivery/smtp-mailer.service';

describe('Customer SMTP boundary', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const delivered: CustomerMailerMessage[] = [];

  before(async () => {
    process.env['CUSTOMER_MAILBOX_ADDRESS'] = 'project-maker@pte.hu';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(customerMailerToken)
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

  it('rejects revision input and keeps the manual ping payload free of Markdown', async () => {
    const projectId = await createProject(app, 'revision-free-ping');
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
    assertPingHasNoMarkdown(delivered[0], revision.body.content as string);

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
