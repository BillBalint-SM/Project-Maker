import type {
  CustomerMailboxChangePage,
  CustomerMailboxCheckpoint,
  MailSubmissionResult,
  OutboundCustomerMessage,
} from '@project-maker/contracts';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import {
  customerMailboxChangesToken,
  customerOutboundMailToken,
  type CustomerMailboxChanges,
  type CustomerOutboundMail,
} from '../src/mail-delivery/customer-mail-boundary';

class CapturingMailGateway implements CustomerOutboundMail, CustomerMailboxChanges {
  readonly delivered: OutboundCustomerMessage[] = [];
  nextAcceptance: MailSubmissionResult['acceptance'] = 'ACCEPTED';
  isConfigured(): boolean { return true; }
  async submit(message: OutboundCustomerMessage): Promise<MailSubmissionResult> {
    this.delivered.push(message);
    const acceptance = this.nextAcceptance;
    this.nextAcceptance = 'ACCEPTED';
    return { acceptance, messageReference: `<${randomUUID()}@example.test>` };
  }
  async readChanges(_checkpoint: CustomerMailboxCheckpoint | null): Promise<CustomerMailboxChangePage> {
    return { changes: [], nextPageCheckpoint: null, completedCheckpoint: { value: 'response-test' } };
  }
}

describe('Customer response request and deterministic notifications (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const mail = new CapturingMailGateway();
  const publicOrigin = 'http://customer.example.test';

  before(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['CUSTOMER_RESPONSE_ORIGIN'] = publicOrigin;
    process.env['CUSTOMER_RESPONSE_PREVIEW_SECRET'] = 'customer-response-preview-secret-at-least-32-bytes';
    process.env['CORRESPONDENCE_MAILBOX_ADDRESS'] = 'project-maker@example.test';
    process.env['CORRESPONDENCE_MAILBOX_NAME'] = 'Project Maker';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(customerOutboundMailToken).useValue(mail)
      .overrideProvider(customerMailboxChangesToken).useValue(mail)
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
    dataSource = app.get(DataSource);
  });

  after(async () => app.close());

  it('sends one frozen prompt set, accepts one immutable public response, reviews it, and exposes it as Evidence', async () => {
    await dataSource.query(`UPDATE "projects" SET "status" = 'ARCHIVED' WHERE "status" <> 'ARCHIVED'`);
    const project = await request(app.getHttpServer()).post('/projects').send({
      name: `Customer response ${randomUUID()}`,
      customerContactName: 'Ügyfél Anna',
      customerContactEmail: `response-${Date.now()}@example.test`,
      internalOwnerName: 'PO Péter',
      nextActionOwnerRole: 'INTERNAL_OWNER',
      dueAt: '2020-01-01T12:00:00.000Z',
    }).expect(201);
    const projectId = project.body.id as string;
    const bank = await request(app.getHttpServer()).get('/settings/base-questions').expect(200);
    const stableKey = bank.body.questions[0].stableKey as string;
    await request(app.getHttpServer()).post(`/projects/${projectId}/question-schema`).send({
      questions: [{ stableKey, required: true, blocking: false }],
    }).expect(201);
    const round = await request(app.getHttpServer()).post(`/projects/${projectId}/rounds`).send({
      type: 'STAKEHOLDER', selectedStableKeys: [stableKey],
    }).expect(201);

    const eligible = await request(app.getHttpServer())
      .get(`/projects/${projectId}/customer-response-requests/eligible-prompts`).expect(200);
    assert.equal(eligible.body.length, 1);
    const preview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-response-requests/preview`)
      .send({ prompts: [{ sourceKind: eligible.body[0].sourceKind, sourceId: eligible.body[0].sourceId }] })
      .expect(201);
    assert.match(preview.body.textContent, /Ügyfél Anna/);
    assert.match(preview.body.textContent, new RegExp(escapeRegExp(eligible.body[0].text)));

    const confirmed = await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-response-requests/confirm`)
      .send({ previewToken: preview.body.previewToken }).expect(201);
    assert.equal(confirmed.body.deliveryState, 'SENT');
    assert.equal(mail.delivered.length, 1);
    const capability = /\/respond#([A-Za-z0-9_-]+)/.exec(mail.delivered[0]?.textContent ?? '')?.[1];
    assert.ok(capability);

    const publicClient = request.agent(app.getHttpServer());
    const exchanged = await publicClient.post('/public/customer-response/exchange')
      .set('Origin', publicOrigin).send({ token: capability }).expect(201);
    const capabilityCookie = (exchanged.headers['set-cookie'] as unknown as string[])[0]!.split(';')[0]!;
    const publicRequest = await publicClient.get('/public/customer-response').set('Cookie', capabilityCookie).expect(200);
    assert.equal(publicRequest.body.projectName, project.body.name);
    assert.equal(publicRequest.body.prompts.length, 1);
    assert.equal(publicRequest.headers['cache-control'], 'no-store');

    const idempotencyKey = randomUUID();
    const submitted = await publicClient.post('/public/customer-response/submit')
      .set('Origin', publicOrigin)
      .set('Cookie', capabilityCookie)
      .send({ idempotencyKey, answers: [{ promptId: publicRequest.body.prompts[0].id, answer: 'A pilot ügyfélcsoporttal induljunk.' }] })
      .expect(201);
    await publicClient.post('/public/customer-response/submit')
      .set('Origin', publicOrigin)
      .set('Cookie', capabilityCookie)
      .send({ idempotencyKey, answers: [{ promptId: publicRequest.body.prompts[0].id, answer: 'A pilot ügyfélcsoporttal induljunk.' }] })
      .expect(201);

    const unchangedRound = await request(app.getHttpServer())
      .get(`/projects/${projectId}/rounds/${round.body.id as string}`).expect(200);
    assert.equal(unchangedRound.body.questions[0].answer, null);
    const notices = await request(app.getHttpServer()).get('/notifications').expect(200);
    assert.ok(notices.body.items.some((item: { kind: string; projectId: string }) => item.kind === 'CUSTOMER_RESPONSE' && item.projectId === projectId));
    assert.ok(notices.body.items.some((item: { kind: string; projectId: string }) => item.kind === 'PROJECT_OVERDUE' && item.projectId === projectId));

    const requests = await request(app.getHttpServer())
      .get(`/projects/${projectId}/customer-response-requests`).expect(200);
    const response = requests.body.find((item: { id: string }) => item.id === confirmed.body.id);
    assert.equal(response.submission.answers[0].answer, 'A pilot ügyfélcsoporttal induljunk.');
    const evidence = await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-response-requests/${confirmed.body.id as string}/answers/${response.submission.answers[0].id as string}/evidence`)
      .send({}).expect(201);
    assert.equal(evidence.body.kind, 'CUSTOMER_RESPONSE');
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-response-requests/${confirmed.body.id as string}/review`)
      .send({}).expect(201);
    const cleared = await request(app.getHttpServer()).get('/notifications').expect(200);
    assert.ok(!cleared.body.items.some((item: { kind: string; projectId: string }) => item.kind === 'CUSTOMER_RESPONSE' && item.projectId === projectId));

    await dataSource.query(`UPDATE "customer_correspondences" SET "unread_message_count" = 1 WHERE "id" = (SELECT "correspondence_id" FROM "customer_response_requests" WHERE "id" = $1)`, [confirmed.body.id]);
    const correspondenceWork = await request(app.getHttpServer())
      .get(`/projects/${projectId}/customer-correspondences`).expect(200);
    const correspondence = correspondenceWork.body.correspondences.find((item: { source: { type: string; requestId?: string } }) =>
      item.source.type === 'CUSTOMER_RESPONSE_REQUEST' && item.source.requestId === confirmed.body.id,
    );
    assert.ok(correspondence);
    const replyNotice = await request(app.getHttpServer()).get('/notifications').expect(200);
    assert.ok(replyNotice.body.items.some((item: { kind: string; projectId: string }) => item.kind === 'CUSTOMER_REPLY' && item.projectId === projectId));
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-correspondences/${correspondence.id as string}/commands`)
      .send({ command: 'MARK_REVIEWED', expectedVersion: correspondence.processingVersion }).expect(201);
    const replyCleared = await request(app.getHttpServer()).get('/notifications').expect(200);
    assert.ok(!replyCleared.body.items.some((item: { kind: string; projectId: string }) => item.kind === 'CUSTOMER_REPLY' && item.projectId === projectId));

    const failedPreview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-response-requests/preview`)
      .send({ prompts: [{ sourceKind: eligible.body[0].sourceKind, sourceId: eligible.body[0].sourceId }] })
      .expect(201);
    mail.nextAcceptance = 'REJECTED';
    const failed = await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-response-requests/confirm`)
      .send({ previewToken: failedPreview.body.previewToken }).expect(201);
    assert.equal(failed.body.deliveryState, 'FAILED');
    const failureNotice = await request(app.getHttpServer()).get('/notifications').expect(200);
    assert.ok(failureNotice.body.items.some((item: { kind: string; projectId: string }) => item.kind === 'CUSTOMER_DELIVERY_FAILURE' && item.projectId === projectId));
    const retried = await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-response-requests/${failed.body.id as string}/retry`)
      .send({}).expect(201);
    assert.equal(retried.body.deliveryState, 'SENT');
    const failureCleared = await request(app.getHttpServer()).get('/notifications').expect(200);
    assert.ok(!failureCleared.body.items.some((item: { kind: string; projectId: string }) => item.kind === 'CUSTOMER_DELIVERY_FAILURE' && item.projectId === projectId));

    await request(app.getHttpServer()).post('/public/customer-response/exchange')
      .set('Origin', publicOrigin).send({ token: 'invalid-capability' }).expect(404);
    await request(app.getHttpServer()).post('/public/customer-response/exchange')
      .set('Origin', publicOrigin).send({ token: capability }).expect(404);
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
