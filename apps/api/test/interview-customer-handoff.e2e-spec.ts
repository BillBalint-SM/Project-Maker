import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import type { OutboundCustomerMessage } from '@project-maker/contracts';

import { AppModule } from '../src/app.module';
import { customerMailerToken, type CustomerMailerMessage } from '../src/mail-delivery/smtp-mailer.service';

describe('Interview customer handoff HTTP boundary', () => {
  let app: INestApplication;
  const delivered: CustomerMailerMessage[] = [];
  let deliveryMode: 'SUCCESS' | 'SMTP_FAILURE' | 'UNKNOWN_FAILURE' | 'HOLD' = 'SUCCESS';
  let releaseHeldDelivery: (() => void) | null = null;

  before(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(customerMailerToken)
      .useValue({
        isConfigured: () => true,
        submit: async (message: OutboundCustomerMessage) => {
          if (deliveryMode === 'SMTP_FAILURE') return { acceptance: 'REJECTED', messageReference: null } as const;
          if (deliveryMode === 'UNKNOWN_FAILURE') throw new Error('Connection outcome unknown.');
          if (deliveryMode === 'HOLD') await new Promise<void>((resolve) => { releaseHeldDelivery = resolve; });
          delivered.push({ to: message.recipientAddress, subject: message.subject, text: message.textContent, html: message.htmlContent });
          return { acceptance: 'ACCEPTED', messageReference: null } as const;
        },
      })
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });

  after(async () => app.close());

  it('ends an incomplete meeting, sends immutable v1, and requires a fresh preview for v2 changes', async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const project = await request(app.getHttpServer()).post('/projects').send({
      name: `Handoff ${suffix}`,
      customerContactName: 'Ügyfél Anna',
      customerContactEmail: `handoff-${Date.now()}@example.test`,
      internalOwnerName: 'PO Péter',
      nextActionOwnerRole: 'CUSTOMER_CONTACT',
    }).expect(201);
    const bank = await request(app.getHttpServer()).get('/settings/base-questions').expect(200);
    const stableKey = bank.body.questions[0].stableKey as string;
    await request(app.getHttpServer()).post(`/projects/${project.body.id}/question-schema`).send({ questions: [{ stableKey, required: true, blocking: true }] }).expect(201);
    const created = await request(app.getHttpServer()).post(`/projects/${project.body.id}/rounds`).send({ type: 'INITIAL_INTAKE' }).expect(201);
    const roundId = created.body.id as string;
    const snapshotId = created.body.questions[0].id as string;

    const ended = await request(app.getHttpServer()).post(`/projects/${project.body.id}/rounds/${roundId}/finish`).send({}).expect(201);
    assert.equal(ended.body.status, 'ENDED');
    assert.equal(ended.body.questions[0].answer, null);

    const history = await request(app.getHttpServer()).get(`/projects/${project.body.id}/rounds/${roundId}/customer-handoffs`).expect(200);
    assert.equal(history.body.length, 1);
    assert.equal(history.body[0].state, 'DRAFT');
    const firstId = history.body[0].id as string;
    const firstPreview = await request(app.getHttpServer()).get(`/projects/${project.body.id}/rounds/${roundId}/customer-handoffs/${firstId}/preview`).expect(200);
    assert.match(firstPreview.body.textContent, /Nincs rögzített válasz/);
    const sent = await request(app.getHttpServer()).post(`/projects/${project.body.id}/rounds/${roundId}/customer-handoffs/${firstId}/send`).send({ sourceContentVersion: firstPreview.body.sourceContentVersion, previewDigest: firstPreview.body.previewDigest }).expect(201);
    assert.equal(sent.body.state, 'SENT');
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0].text, firstPreview.body.textContent);
    assert.equal(delivered[0].html, firstPreview.body.htmlContent);

    const second = await request(app.getHttpServer()).post(`/projects/${project.body.id}/rounds/${roundId}/customer-handoffs`).send({}).expect(201);
    assert.equal(second.body.version, 2);
    await request(app.getHttpServer()).put(`/projects/${project.body.id}/rounds/${roundId}/customer-handoffs/${second.body.id}/draft`).send({ modificationSummary: 'Az ügyfél pontosítást kért.' }).expect(200);
    await request(app.getHttpServer()).patch(`/projects/${project.body.id}/rounds/${roundId}/answers/${snapshotId}`).send({ value: 'Első pontosítás' }).expect(200);
    const secondPreview = await request(app.getHttpServer()).get(`/projects/${project.body.id}/rounds/${roundId}/customer-handoffs/${second.body.id}/preview`).expect(200);
    await request(app.getHttpServer()).patch(`/projects/${project.body.id}/rounds/${roundId}/answers/${snapshotId}`).send({ value: 'Második pontosítás' }).expect(200);
    await request(app.getHttpServer()).post(`/projects/${project.body.id}/rounds/${roundId}/customer-handoffs/${second.body.id}/send`).send({ sourceContentVersion: secondPreview.body.sourceContentVersion, previewDigest: secondPreview.body.previewDigest }).expect(409);

    const firstSnapshot = await request(app.getHttpServer()).get(`/projects/${project.body.id}/rounds/${roundId}/customer-handoffs/${firstId}`).expect(200);
    assert.equal(firstSnapshot.body.textContent, firstPreview.body.textContent);
  });

  it('retains exact failed content, requires acknowledgement for unknown delivery, and protects single-flight send', async () => {
    const { projectId, roundId } = await createEndedInterview(app, 'Recovery');
    const history = await request(app.getHttpServer()).get(`/projects/${projectId}/rounds/${roundId}/customer-handoffs`).expect(200);
    const handoffId = history.body[0].id as string;
    const preview = await request(app.getHttpServer()).get(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/preview`).expect(200);
    const sendBody = { sourceContentVersion: preview.body.sourceContentVersion, previewDigest: preview.body.previewDigest };

    deliveryMode = 'SMTP_FAILURE';
    const failed = await request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/send`).send(sendBody).expect(201);
    assert.equal(failed.body.state, 'FAILED');
    assert.equal(failed.body.textContent, preview.body.textContent);
    await request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/resume-editing`).send({}).expect(201);

    const refreshedPreview = await request(app.getHttpServer()).get(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/preview`).expect(200);
    deliveryMode = 'UNKNOWN_FAILURE';
    const unknown = await request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/send`).send({ sourceContentVersion: refreshedPreview.body.sourceContentVersion, previewDigest: refreshedPreview.body.previewDigest }).expect(201);
    assert.equal(unknown.body.state, 'UNKNOWN');
    await request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/retry`).send({ acknowledgeDuplicateRisk: false }).expect(400);

    deliveryMode = 'SUCCESS';
    const recovered = await request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/retry`).send({ acknowledgeDuplicateRisk: true }).expect(201);
    assert.equal(recovered.body.state, 'SENT');
    assert.equal(recovered.body.textContent, refreshedPreview.body.textContent);

    const second = await request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs`).send({}).expect(201);
    await request(app.getHttpServer()).put(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${second.body.id}/draft`).send({ modificationSummary: 'Új ügyfélpontosítás.' }).expect(200);
    const secondPreview = await request(app.getHttpServer()).get(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${second.body.id}/preview`).expect(200);
    deliveryMode = 'HOLD';
    const firstAttempt = request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${second.body.id}/send`).send({ sourceContentVersion: secondPreview.body.sourceContentVersion, previewDigest: secondPreview.body.previewDigest }).then((response) => response);
    while (!releaseHeldDelivery) await new Promise((resolve) => setTimeout(resolve, 10));
    await request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${second.body.id}/send`).send({ sourceContentVersion: secondPreview.body.sourceContentVersion, previewDigest: secondPreview.body.previewDigest }).expect(409);
    releaseHeldDelivery();
    releaseHeldDelivery = null;
    assert.equal((await firstAttempt).status, 201);
    deliveryMode = 'SUCCESS';
  });
});

async function createEndedInterview(app: INestApplication, label: string): Promise<{ projectId: string; roundId: string }> {
  const suffix = `${Date.now()}-${Math.random()}`;
  const project = await request(app.getHttpServer()).post('/projects').send({
    name: `${label} ${suffix}`,
    customerContactName: 'Ügyfél Anna',
    customerContactEmail: `handoff-${Date.now()}-${Math.random()}@example.test`,
    internalOwnerName: 'PO Péter',
    nextActionOwnerRole: 'CUSTOMER_CONTACT',
  }).expect(201);
  const bank = await request(app.getHttpServer()).get('/settings/base-questions').expect(200);
  await request(app.getHttpServer()).post(`/projects/${project.body.id}/question-schema`).send({ questions: [{ stableKey: bank.body.questions[0].stableKey, required: true, blocking: true }] }).expect(201);
  const round = await request(app.getHttpServer()).post(`/projects/${project.body.id}/rounds`).send({ type: 'INITIAL_INTAKE' }).expect(201);
  await request(app.getHttpServer()).post(`/projects/${project.body.id}/rounds/${round.body.id}/finish`).send({}).expect(201);
  return { projectId: project.body.id, roundId: round.body.id };
}
