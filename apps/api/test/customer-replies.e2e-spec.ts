import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import {
  graphMailClientToken,
  type GraphMailClient,
  type GraphMailboxMessage,
  type GraphMailboxPage,
  type GraphOutboundMessage,
} from '../src/mail-delivery/graph-customer-mail-boundary';

class CustomerReplyGraphFake implements GraphMailClient {
  readonly sent: GraphOutboundMessage[] = [];
  private changes: readonly GraphMailboxMessage[] = [];
  private deltaVersion = 0;
  private heldRead: { started: () => void; wait: Promise<void> } | null = null;

  isConfigured(): boolean { return true; }

  async submit(message: GraphOutboundMessage) {
    this.sent.push(message);
    return { accepted: true, id: `outbound-${this.sent.length}` } as const;
  }

  async readMailboxPage(_checkpoint: string | null): Promise<GraphMailboxPage> {
    if (this.heldRead) {
      const held = this.heldRead;
      this.heldRead = null;
      held.started();
      await held.wait;
    }
    this.deltaVersion += 1;
    const value = this.changes;
    this.changes = [];
    return {
      value,
      nextCheckpoint: null,
      completedCheckpoint: `delta-${this.deltaVersion}`,
    };
  }

  queue(...changes: readonly GraphMailboxMessage[]): void {
    this.changes = changes;
  }

  holdNextRead(): { started: Promise<void>; release: () => void } {
    let signalStarted!: () => void;
    let release!: () => void;
    const started = new Promise<void>((resolve) => { signalStarted = resolve; });
    const wait = new Promise<void>((resolve) => { release = resolve; });
    this.heldRead = { started: signalStarted, wait };
    return { started, release };
  }
}

describe('Correlated Customer replies', () => {
  let app: INestApplication;
  let secondApp: INestApplication;
  const graph = new CustomerReplyGraphFake();

  before(async () => {
    process.env['CUSTOMER_MAILBOX_ADDRESS'] = 'reply51@pte.hu';
    process.env['CUSTOMER_MAILBOX_NAME'] = 'Project Maker';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(graphMailClientToken)
      .useValue(graph)
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
    const secondModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(graphMailClientToken)
      .useValue(graph)
      .compile();
    secondApp = secondModule.createNestApplication({ logger: false });
    await secondApp.init();
    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);
  });

  after(async () => Promise.all([app.close(), secondApp.close()]));

  it('correlates one tokenized handoff reply and ignores a provider replay', async () => {
    const providerMessageReference = `provider-reply-${Date.now()}-${Math.random()}`;
    const { projectId, roundId, customerEmail } = await createEndedInterview(app);
    const history = await request(app.getHttpServer())
      .get(`/projects/${projectId}/rounds/${roundId}/customer-handoffs`)
      .expect(200);
    const handoffId = history.body[0].id as string;
    const preview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/preview`)
      .send({ mode: 'CUSTOM', name: 'PO Péter', address: 'po.peter@pte.hu' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/send`)
      .send(sendInput(preview.body))
      .expect(201);
    const replyToAddress = graph.sent.at(-1)?.replyTo[0]?.emailAddress.address;
    assert.ok(replyToAddress);

    const reply: GraphMailboxMessage = {
      id: providerMessageReference,
      internetMessageId: '<reply-1@example.test>',
      from: { emailAddress: { address: customerEmail } },
      toRecipients: [{ emailAddress: { address: replyToAddress } }],
      subject: 'Re: Projektösszefoglaló',
      body: {
        contentType: 'html',
        content: '<p>Mehet a projekt.</p><script>steal()</script><p>On Monday wrote:</p><blockquote>Régi szöveg</blockquote>',
      },
      receivedDateTime: '2026-08-18T14:00:00.000Z',
      attachments: [{ name: 'scope.pdf', contentType: 'application/pdf', size: 2048 }],
    };
    graph.queue(reply);
    const held = graph.holdNextRead();
    const firstRefresh = request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201).then((response) => response);
    await held.started;
    const joinedRefresh = request(secondApp.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201).then((response) => response);
    await new Promise((resolve) => setTimeout(resolve, 30));
    held.release();
    await Promise.all([firstRefresh, joinedRefresh]);

    const correspondence = await request(app.getHttpServer())
      .get(`/projects/${projectId}/customer-correspondences`)
      .expect(200);
    assert.equal(correspondence.body.newReplyCount, 1);
    assert.equal(correspondence.body.correspondences[0].status, 'Új válasz');
    assert.equal(correspondence.body.correspondences[0].unreadMessageCount, 1);
    assert.deepEqual(correspondence.body.correspondences[0].messages, [{
      id: correspondence.body.correspondences[0].messages[0].id,
      providerMessageReference,
      internetMessageId: '<reply-1@example.test>',
      receivedAt: '2026-08-18T14:00:00.000Z',
      senderAddress: customerEmail,
      senderClassification: 'CUSTOMER_CONTACT',
      recipientAddresses: [replyToAddress],
      subject: 'Re: Projektösszefoglaló',
      textContent: 'Mehet a projekt.\nOn Monday wrote:\nRégi szöveg',
      visibleText: 'Mehet a projekt.',
      quotedText: 'On Monday wrote:\nRégi szöveg',
      attachmentCount: 1,
      attachments: [{ name: 'scope.pdf', contentType: 'application/pdf', size: 2048 }],
      correlationEvidence: 'TOKENIZED_REPLY_TO',
      classification: null,
    }]);

    const correspondenceId = correspondence.body.correspondences[0].id as string;
    assert.equal(correspondence.body.correspondences[0].processingVersion, 2);
    const reviewed = await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-correspondences/${correspondenceId}/commands`)
      .send({ command: 'MARK_REVIEWED', expectedVersion: 2 })
      .expect(201);
    assert.equal(reviewed.body.unreadMessageCount, 0);
    assert.equal(reviewed.body.processingVersion, 3);
    const reviewedAgain = await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-correspondences/${correspondenceId}/commands`)
      .send({ command: 'MARK_REVIEWED', expectedVersion: 2 })
      .expect(201);
    assert.equal(reviewedAgain.body.unreadMessageCount, 0);
    assert.equal(reviewedAgain.body.processingVersion, 3);

    graph.queue(reply);
    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);
    const replayed = await request(app.getHttpServer())
      .get(`/projects/${projectId}/customer-correspondences`)
      .expect(200);
    assert.equal(replayed.body.newReplyCount, 0);
    assert.equal(replayed.body.correspondences[0].messages.length, 1);
  });

  it('does not infer correlation and reopens a closed reply from an unrecognized sender', async () => {
    const messageSuffix = `${Date.now()}-${Math.random()}`;
    const mismatchId = `mismatch-${messageSuffix}`;
    const lateId = `late-${messageSuffix}`;
    const { projectId, roundId } = await createEndedInterview(app);
    const history = await request(app.getHttpServer())
      .get(`/projects/${projectId}/rounds/${roundId}/customer-handoffs`)
      .expect(200);
    const handoffId = history.body[0].id as string;
    const preview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/preview`)
      .send({ mode: 'CUSTOM', name: 'PO Péter', address: 'po.peter@pte.hu' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/send`)
      .send(sendInput(preview.body))
      .expect(201);
    const replyToAddress = graph.sent.at(-1)?.replyTo[0]?.emailAddress.address;
    assert.ok(replyToAddress);

    graph.queue({
      id: `unmatched-${messageSuffix}`,
      internetMessageHeaders: [{ name: 'In-Reply-To', value: '<outbound-2>' }],
      from: { emailAddress: { address: 'intruder@example.test' } },
      toRecipients: [{ emailAddress: { address: 'reply51+invalid@pte.hu' } }],
      subject: preview.body.subject,
      body: { contentType: 'text', content: `A tárgy és a header nem elegendő.` },
      receivedDateTime: '2026-08-18T15:00:00.000Z',
    });
    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);
    const withoutInference = await request(app.getHttpServer())
      .get(`/projects/${projectId}/customer-correspondences`)
      .expect(200);
    assert.equal(withoutInference.body.newReplyCount, 0);
    assert.equal(withoutInference.body.correspondences[0].messages.length, 0);

    graph.queue(inboundMessage(mismatchId, replyToAddress, '2026-08-18T16:00:00.000Z'));
    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);
    const mismatch = await request(app.getHttpServer())
      .get(`/projects/${projectId}/customer-correspondences`)
      .expect(200);
    assert.equal(mismatch.body.correspondences[0].messages[0].senderClassification, 'UNRECOGNIZED');
    const correspondenceId = mismatch.body.correspondences[0].id as string;

    await app.get(DataSource).query(
      `UPDATE "customer_correspondences" SET "status" = 'Lezárva', "unread_message_count" = 0 WHERE "id" = $1`,
      [correspondenceId],
    );
    graph.queue(inboundMessage(lateId, replyToAddress, '2026-08-18T17:00:00.000Z'));
    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);

    const reopened = await request(app.getHttpServer())
      .get(`/projects/${projectId}/customer-correspondences`)
      .expect(200);
    assert.equal(reopened.body.correspondences[0].status, 'Új válasz');
    assert.equal(reopened.body.correspondences[0].unreadMessageCount, 1);
    assert.deepEqual(
      reopened.body.correspondences[0].messages.map((message: { providerMessageReference: string }) => message.providerMessageReference),
      [mismatchId, lateId],
    );
    const summary = await request(app.getHttpServer()).get('/customer-correspondences/summary').expect(200);
    assert.equal(summary.body.newReplyCount >= 1, true);
    assert.equal(summary.body.projectCount >= 1, true);
    assert.equal(
      summary.body.projects.find((project: { projectId: string }) => project.projectId === projectId)?.newReplyCount,
      1,
    );
    await request(app.getHttpServer()).delete(`/projects/${projectId}`).expect(409);
  });

  it('processes every reply explicitly without changing Project lifecycle state', async () => {
    const { projectId, replyToAddress } = await createSentCorrespondence(app, graph);
    const suffix = `${Date.now()}-${Math.random()}`;
    graph.queue(
      inboundMessage(`accepted-${suffix}`, replyToAddress, '2026-08-18T18:00:00.000Z'),
      inboundMessage(`change-${suffix}`, replyToAddress, '2026-08-18T18:01:00.000Z'),
      inboundMessage(`question-${suffix}`, replyToAddress, '2026-08-18T18:02:00.000Z'),
      inboundMessage(`other-${suffix}`, replyToAddress, '2026-08-18T18:03:00.000Z'),
    );
    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);
    const initial = await request(app.getHttpServer())
      .get(`/projects/${projectId}/customer-correspondences`)
      .expect(200);
    const correspondence = initial.body.correspondences[0];
    const correspondenceId = correspondence.id as string;
    assert.equal(correspondence.status, 'Új válasz');
    assert.equal(correspondence.unreadMessageCount, 4);
    assert.equal(correspondence.processingVersion, 5);
    assert.deepEqual(
      correspondence.messages.map((message: { classification: string | null }) => message.classification),
      [null, null, null, null],
    );

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-correspondences/${correspondenceId}/commands`)
      .send({ command: 'SET_STATUS', expectedVersion: 5, status: 'not-a-status' })
      .expect(400);
    const competing = await Promise.all([
      request(app.getHttpServer())
        .post(`/projects/${projectId}/customer-correspondences/${correspondenceId}/commands`)
        .send({ command: 'SET_STATUS', expectedVersion: 5, status: 'Feldolgozás alatt' }),
      request(secondApp.getHttpServer())
        .post(`/projects/${projectId}/customer-correspondences/${correspondenceId}/commands`)
        .send({ command: 'SET_STATUS', expectedVersion: 5, status: 'Feldolgozás alatt' }),
    ]);
    assert.deepEqual(competing.map((response) => response.status).sort(), [201, 409]);

    const classifications = [
      'Elfogadva',
      'Módosítást kér',
      'Kérdés vagy válasz',
      'Egyéb',
    ] as const;
    let version = 6;
    for (const [index, classification] of classifications.entries()) {
      const classified = await request(app.getHttpServer())
        .post(`/projects/${projectId}/customer-correspondences/${correspondenceId}/commands`)
        .send({
          command: 'CLASSIFY_MESSAGE',
          expectedVersion: version,
          messageId: correspondence.messages[index].id,
          classification,
          closeCorrespondence: classification === 'Elfogadva',
        })
        .expect(201);
      version += 1;
      assert.equal(classified.body.messages[index].classification, classification);
    }
    const processed = await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-correspondences/${correspondenceId}/commands`)
      .send({ command: 'MARK_REVIEWED', expectedVersion: version })
      .expect(201);
    assert.equal(processed.body.status, 'Lezárva');
    assert.equal(processed.body.unreadMessageCount, 0);
    assert.deepEqual(
      processed.body.messages.map((message: { classification: string }) => message.classification),
      classifications,
    );

    const cockpit = await request(app.getHttpServer()).get(`/projects/${projectId}/cockpit`).expect(200);
    assert.equal(cockpit.body.status, 'DRAFT');
    const audit = await request(app.getHttpServer()).get(`/projects/${projectId}/audit-events`).expect(200);
    const processingEvents = audit.body.events.filter((event: { eventType: string }) =>
      event.eventType.startsWith('CUSTOMER_'),
    );
    assert.equal(processingEvents.length >= 6, true);
    const serializedAudit = JSON.stringify(processingEvents);
    assert.equal(serializedAudit.includes('@example.test'), false);
    assert.equal(serializedAudit.includes(`Válasz accepted-${suffix}`), false);
    const activity = await request(app.getHttpServer()).get(`/projects/${projectId}/activity`).expect(200);
    assert.equal(
      activity.body.events.some((event: { summary: string }) => event.summary.includes('Customer')),
      true,
    );

    await request(app.getHttpServer()).post(`/projects/${projectId}/archive`).expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-correspondences/${correspondenceId}/commands`)
      .send({ command: 'SET_STATUS', expectedVersion: version + 1, status: 'Feldolgozás alatt' })
      .expect(409);
    await request(app.getHttpServer())
      .get(`/projects/${projectId}/customer-correspondences`)
      .expect(200);
  });
});

function inboundMessage(id: string, replyToAddress: string, receivedAt: string): GraphMailboxMessage {
  return {
    id,
    from: { emailAddress: { address: 'intruder@example.test' } },
    toRecipients: [{ emailAddress: { address: replyToAddress } }],
    subject: 'Re: Projektösszefoglaló',
    body: { contentType: 'text', content: `Válasz ${id}` },
    receivedDateTime: receivedAt,
  };
}

function sendInput(preview: {
  sourceContentVersion: number;
  previewDigest: string;
  senderName: string;
  senderAddress: string;
}) {
  return {
    sourceContentVersion: preview.sourceContentVersion,
    previewDigest: preview.previewDigest,
    senderName: preview.senderName,
    senderAddress: preview.senderAddress,
  };
}

async function createEndedInterview(app: INestApplication): Promise<{
  projectId: string;
  roundId: string;
  customerEmail: string;
}> {
  const suffix = `${Date.now()}-${Math.random()}`;
  const customerEmail = `reply-${suffix}@example.test`;
  const project = await request(app.getHttpServer()).post('/projects').send({
    name: `Correlated reply ${suffix}`,
    customerContactName: 'Ügyfél Anna',
    customerContactEmail: customerEmail,
    internalOwnerName: 'PO Péter',
    nextActionOwnerRole: 'CUSTOMER_CONTACT',
  }).expect(201);
  const bank = await request(app.getHttpServer()).get('/settings/base-questions').expect(200);
  await request(app.getHttpServer()).post(`/projects/${project.body.id}/question-schema`).send({
    questions: [{ stableKey: bank.body.questions[0].stableKey, required: true, blocking: true }],
  }).expect(201);
  const round = await request(app.getHttpServer()).post(`/projects/${project.body.id}/rounds`)
    .send({ type: 'INITIAL_INTAKE' })
    .expect(201);
  await request(app.getHttpServer()).post(`/projects/${project.body.id}/rounds/${round.body.id}/finish`)
    .send({})
    .expect(201);
  return { projectId: project.body.id, roundId: round.body.id, customerEmail };
}

async function createSentCorrespondence(
  app: INestApplication,
  graph: CustomerReplyGraphFake,
): Promise<{ projectId: string; replyToAddress: string }> {
  const { projectId, roundId } = await createEndedInterview(app);
  const history = await request(app.getHttpServer())
    .get(`/projects/${projectId}/rounds/${roundId}/customer-handoffs`)
    .expect(200);
  const handoffId = history.body[0].id as string;
  const preview = await request(app.getHttpServer())
    .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/preview`)
    .send({ mode: 'CUSTOM', name: 'PO Péter', address: 'po.peter@pte.hu' })
    .expect(201);
  await request(app.getHttpServer())
    .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/send`)
    .send(sendInput(preview.body))
    .expect(201);
  const replyToAddress = graph.sent.at(-1)?.replyTo[0]?.emailAddress.address;
  assert.ok(replyToAddress);
  return { projectId, replyToAddress };
}
