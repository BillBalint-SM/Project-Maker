import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { DataSource } from 'typeorm';
import type {
  CustomerMailboxChangePage,
  CustomerMailboxCheckpoint,
  MailSubmissionResult,
  OutboundCustomerMessage,
} from '@project-maker/contracts';

import { AppModule } from '../src/app.module';
import {
  CustomerMailBoundaryError,
  customerMailboxChangesToken,
  customerOutboundMailToken,
  type CustomerMailboxChanges,
  type CustomerOutboundMail,
} from '../src/mail-delivery/customer-mail-boundary';

class ControlledMailGateway implements CustomerOutboundMail, CustomerMailboxChanges {
  readonly delivered: OutboundCustomerMessage[] = [];
  readonly deliveredMessageFrozen: boolean[] = [];
  mode: 'SUCCESS' | 'REJECTED' | 'UNKNOWN_FAILURE' | 'HOLD' = 'SUCCESS';
  releaseHeldDelivery: (() => void) | null = null;

  isConfigured(): boolean { return true; }

  async submit(message: OutboundCustomerMessage): Promise<MailSubmissionResult> {
    this.deliveredMessageFrozen.push(Object.isFrozen(message));
    if (this.mode === 'REJECTED') return { acceptance: 'REJECTED', messageReference: null };
    if (this.mode === 'UNKNOWN_FAILURE') throw new CustomerMailBoundaryError('OUTCOME_UNKNOWN');
    if (this.mode === 'HOLD') {
      await new Promise<void>((resolve) => { this.releaseHeldDelivery = resolve; });
    }
    this.delivered.push(message);
    return { acceptance: 'ACCEPTED', messageReference: null };
  }

  async readChanges(
    _checkpoint: CustomerMailboxCheckpoint | null,
  ): Promise<CustomerMailboxChangePage> {
    return {
      changes: [],
      nextPageCheckpoint: null,
      completedCheckpoint: { value: 'controlled-baseline' },
    };
  }
}

describe('Interview customer handoff HTTP boundary', () => {
  let app: INestApplication;
  const mailGateway = new ControlledMailGateway();

  before(async () => {
    process.env['CORRESPONDENCE_MAILBOX_ADDRESS'] = 'project-maker@example.test';
    process.env['CORRESPONDENCE_MAILBOX_NAME'] = 'Project Maker';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(customerOutboundMailToken)
      .useValue(mailGateway)
      .overrideProvider(customerMailboxChangesToken)
      .useValue(mailGateway)
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
    await request(app.getHttpServer()).post(`/projects/${project.body.id}/rounds/${roundId}/customer-handoffs/${firstId}/preview`).send({ mode: 'CUSTOM', name: 'Téves', address: 'personal@example.test' }).expect(400);
    const firstPreview = await request(app.getHttpServer()).post(`/projects/${project.body.id}/rounds/${roundId}/customer-handoffs/${firstId}/preview`).send({}).expect(201);
    assert.match(firstPreview.body.textContent, /Nincs rögzített válasz/);
    assert.equal(firstPreview.body.senderName, 'Project Maker');
    assert.equal(firstPreview.body.senderAddress, 'project-maker@example.test');
    await request(app.getHttpServer()).post(`/projects/${project.body.id}/rounds/${roundId}/customer-handoffs/${firstId}/send`).send({ ...sendInput(firstPreview.body), senderAddress: 'personal@example.test' }).expect(400);
    const sent = await request(app.getHttpServer()).post(`/projects/${project.body.id}/rounds/${roundId}/customer-handoffs/${firstId}/send`).send(sendInput(firstPreview.body)).expect(201);
    assert.equal(sent.body.state, 'SENT');
    assert.equal(mailGateway.delivered.length, 1);
    assert.equal(mailGateway.deliveredMessageFrozen.at(-1), true);
    assert.equal(mailGateway.delivered[0]?.htmlContent, firstPreview.body.htmlContent);
    assert.equal(mailGateway.delivered[0]?.senderAddress, 'project-maker@example.test');
    assert.match(mailGateway.delivered[0]?.replyToAddress ?? '', /^project-maker\+[a-f0-9]{48}@example\.test$/);
    assert.equal(sent.body.mailSystemAcceptance, 'ACCEPTED');
    assert.equal(sent.body.correspondenceId.length, 36);
    const senderIdentity = await request(app.getHttpServer()).get(`/projects/${project.body.id}/rounds/${roundId}/customer-handoffs/sender-identity`).expect(200);
    assert.deepEqual(senderIdentity.body, {
      name: 'Project Maker',
      address: 'project-maker@example.test',
    });

    const second = await request(app.getHttpServer()).post(`/projects/${project.body.id}/rounds/${roundId}/customer-handoffs`).send({}).expect(201);
    assert.equal(second.body.version, 2);
    await request(app.getHttpServer()).put(`/projects/${project.body.id}/rounds/${roundId}/customer-handoffs/${second.body.id}/draft`).send({ modificationSummary: 'Az ügyfél pontosítást kért.' }).expect(200);
    await request(app.getHttpServer()).patch(`/projects/${project.body.id}/rounds/${roundId}/answers/${snapshotId}`).send({ value: 'Első pontosítás' }).expect(200);
    const secondPreview = await request(app.getHttpServer()).post(`/projects/${project.body.id}/rounds/${roundId}/customer-handoffs/${second.body.id}/preview`).send({}).expect(201);
    await request(app.getHttpServer()).patch(`/projects/${project.body.id}/rounds/${roundId}/answers/${snapshotId}`).send({ value: 'Második pontosítás' }).expect(200);
    await request(app.getHttpServer()).post(`/projects/${project.body.id}/rounds/${roundId}/customer-handoffs/${second.body.id}/send`).send(sendInput(secondPreview.body)).expect(409);

    const firstSnapshot = await request(app.getHttpServer()).get(`/projects/${project.body.id}/rounds/${roundId}/customer-handoffs/${firstId}`).expect(200);
    assert.equal(firstSnapshot.body.textContent, firstPreview.body.textContent);
  });

  it('retains exact failed content, requires acknowledgement for unknown delivery, and protects single-flight send', async () => {
    const { projectId, roundId } = await createEndedInterview(app, 'Recovery');
    const history = await request(app.getHttpServer()).get(`/projects/${projectId}/rounds/${roundId}/customer-handoffs`).expect(200);
    const handoffId = history.body[0].id as string;
    const preview = await request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/preview`).send({}).expect(201);
    const sendBody = sendInput(preview.body);

    mailGateway.mode = 'REJECTED';
    const failed = await request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/send`).send(sendBody).expect(201);
    assert.equal(failed.body.state, 'FAILED');
    assert.equal(failed.body.textContent, preview.body.textContent);
    mailGateway.mode = 'SUCCESS';
    const acceptedRetry = await request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/retry`).send({ acknowledgeDuplicateRisk: false }).expect(201);
    assert.equal(acceptedRetry.body.replyToAddress, failed.body.replyToAddress);
    assert.equal(acceptedRetry.body.correspondenceId, failed.body.correspondenceId);
    const retainedAttempts = await app.get(DataSource).query(`SELECT attempt."result" FROM "customer_outbound_attempts" attempt JOIN "customer_outbound_communications" outbound ON outbound."id" = attempt."outbound_communication_id" WHERE outbound."source_id" = $1 ORDER BY attempt."attempted_at"`, [handoffId]) as Array<{ result: string }>;
    assert.deepEqual(retainedAttempts.map(({ result }) => result), ['REJECTED', 'ACCEPTED']);
    await request(app.getHttpServer()).delete(`/projects/${projectId}`).expect(409);
    const retainedProject = await app.get(DataSource).query('SELECT "id" FROM "projects" WHERE "id" = $1', [projectId]) as Array<{ id: string }>;
    assert.deepEqual(retainedProject, [{ id: projectId }]);

    const second = await request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs`).send({}).expect(201);
    await request(app.getHttpServer()).put(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${second.body.id}/draft`).send({ modificationSummary: 'Új ügyfélpontosítás.' }).expect(200);
    const refreshedPreview = await request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${second.body.id}/preview`).send({}).expect(201);
    mailGateway.mode = 'UNKNOWN_FAILURE';
    const unknown = await request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${second.body.id}/send`).send(sendInput(refreshedPreview.body)).expect(201);
    assert.equal(unknown.body.state, 'UNKNOWN');
    await request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${second.body.id}/retry`).send({ acknowledgeDuplicateRisk: false }).expect(400);

    mailGateway.mode = 'SUCCESS';
    const recovered = await request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${second.body.id}/retry`).send({ acknowledgeDuplicateRisk: true }).expect(201);
    assert.equal(recovered.body.state, 'SENT');
    assert.equal(recovered.body.textContent, refreshedPreview.body.textContent);
    assert.equal(recovered.body.replyToAddress, unknown.body.replyToAddress);
    assert.notEqual(recovered.body.correspondenceId, acceptedRetry.body.correspondenceId);
    const correspondence = await app.get(DataSource).query('SELECT "predecessor_id" FROM "customer_correspondences" WHERE "id" = $1', [recovered.body.correspondenceId]) as Array<{ predecessor_id: string | null }>;
    assert.equal(correspondence[0]?.predecessor_id, acceptedRetry.body.correspondenceId);
    await app.get(DataSource).query('UPDATE "customer_correspondences" SET "status" = $1, "unread_message_count" = 1 WHERE "id" = $2', ['Új válasz', recovered.body.correspondenceId]);
    await assert.rejects(
      app.get(DataSource).query('UPDATE "customer_correspondences" SET "project_id" = $1 WHERE "id" = $2', [randomUUID(), recovered.body.correspondenceId]),
      /correspondence anchors are immutable/i,
    );
    await assert.rejects(
      app.get(DataSource).query('DELETE FROM "customer_correspondences" WHERE "id" = $1', [recovered.body.correspondenceId]),
      /correspondence anchors are immutable/i,
    );

    const third = await request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs`).send({}).expect(201);
    await request(app.getHttpServer()).put(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${third.body.id}/draft`).send({ modificationSummary: 'Harmadik verzió.' }).expect(200);
    const secondPreview = await request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${third.body.id}/preview`).send({}).expect(201);
    mailGateway.mode = 'HOLD';
    const firstAttempt = request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${third.body.id}/send`).send(sendInput(secondPreview.body)).then((response) => response);
    while (!mailGateway.releaseHeldDelivery) await new Promise((resolve) => setTimeout(resolve, 10));
    await request(app.getHttpServer()).post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${third.body.id}/send`).send(sendInput(secondPreview.body)).expect(409);
    mailGateway.releaseHeldDelivery();
    mailGateway.releaseHeldDelivery = null;
    assert.equal((await firstAttempt).status, 201);
    mailGateway.mode = 'SUCCESS';
  });
});

function sendInput(preview: { sourceContentVersion: number; previewDigest: string }) {
  return { sourceContentVersion: preview.sourceContentVersion, previewDigest: preview.previewDigest };
}

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
