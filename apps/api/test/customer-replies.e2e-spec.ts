import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import {
  graphMailClientToken,
  GraphMailClientError,
  type GraphMailClient,
  type GraphMailboxMessage,
  type GraphMailboxPage,
  type GraphOutboundMessage,
} from '../src/mail-delivery/graph-customer-mail-boundary';

class CustomerReplyGraphFake implements GraphMailClient {
  readonly sent: GraphOutboundMessage[] = [];
  submitMode: 'SUCCESS' | 'UNKNOWN' = 'SUCCESS';
  private changes: readonly GraphMailboxMessage[] = [];
  private deltaVersion = 0;
  private heldRead: { started: () => void; wait: Promise<void> } | null = null;

  isConfigured(): boolean { return true; }

  async submit(message: GraphOutboundMessage) {
    this.sent.push(message);
    if (this.submitMode === 'UNKNOWN') throw new GraphMailClientError('UNKNOWN_OUTCOME');
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

  it('retains an uncorrelated message for explicit triage without inferring a Project', async () => {
    const messageId = `unmatched-${Date.now()}-${Math.random()}`;
    graph.queue({
      id: messageId,
      internetMessageId: `<${messageId}@example.test>`,
      from: { emailAddress: { address: 'forwarded-customer@example.test' } },
      toRecipients: [{ emailAddress: { address: 'reply51@pte.hu' } }],
      subject: 'Továbbított Customer kérdés',
      body: { contentType: 'text', content: 'Ezt az üzenetet kézzel kell társítani.' },
      receivedDateTime: '2026-08-18T17:00:00.000Z',
    });

    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);

    const triage = await request(app.getHttpServer()).get('/customer-mail-triage').expect(200);
    const unmatched = triage.body.unmatchedMessages.find(
      (message: { providerMessageReference: string }) =>
        message.providerMessageReference === messageId,
    );
    assert.deepEqual(unmatched, {
      id: unmatched.id,
      kind: 'UNMATCHED_CUSTOMER_MESSAGE',
      providerMessageReference: messageId,
      receivedAt: '2026-08-18T17:00:00.000Z',
      senderAddress: 'forwarded-customer@example.test',
      subject: 'Továbbított Customer kérdés',
      visibleText: 'Ezt az üzenetet kézzel kell társítani.',
      quotedText: null,
      attachmentCount: 0,
      attachments: [],
      version: 1,
    });
    assert.equal('projectId' in unmatched, false);
    assert.equal('correspondenceId' in unmatched, false);
  });

  it('separates mail-system events, ignores self-originated loops, and keeps uncertain automation reviewable', async () => {
    const target = await createSentCorrespondence(app, graph);
    const suffix = `${Date.now()}-${Math.random()}`;
    graph.queue(
      {
        ...inboundMessage(`dsn-${suffix}`, target.replyToAddress, '2026-08-18T17:05:00.000Z'),
        internetMessageHeaders: [
          { name: 'Content-Type', value: 'multipart/report; report-type=delivery-status' },
        ],
      },
      {
        ...inboundMessage(`ooo-${suffix}`, target.replyToAddress, '2026-08-18T17:06:00.000Z'),
        internetMessageHeaders: [{ name: 'Auto-Submitted', value: 'auto-replied' }],
      },
      {
        ...inboundMessage(`loop-${suffix}`, target.replyToAddress, '2026-08-18T17:07:00.000Z'),
        from: { emailAddress: { address: 'REPLY51@PTE.HU' } },
      },
      {
        ...inboundMessage(`automated-${suffix}`, target.replyToAddress, '2026-08-18T17:08:00.000Z'),
        internetMessageHeaders: [{ name: 'Auto-Submitted', value: 'auto-generated' }],
      },
    );

    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);

    const correspondence = await request(app.getHttpServer())
      .get(`/projects/${target.projectId}/customer-correspondences`)
      .expect(200);
    assert.equal(correspondence.body.newReplyCount, 0);
    assert.equal(correspondence.body.correspondences[0].unreadMessageCount, 0);
    const triage = await request(app.getHttpServer()).get('/customer-mail-triage').expect(200);
    assert.deepEqual(
      triage.body.mailSystemEvents
        .filter((event: { providerMessageReference: string }) => event.providerMessageReference.endsWith(suffix))
        .map((event: { type: string }) => event.type)
        .sort(),
      ['DELIVERY_REPORT', 'OUT_OF_OFFICE'],
    );
    const uncertain = triage.body.unmatchedMessages.find(
      (message: { providerMessageReference: string }) =>
        message.providerMessageReference === `automated-${suffix}`,
    );
    assert.equal(uncertain.kind, 'UNKNOWN_AUTOMATION');
    const serialized = JSON.stringify(triage.body);
    assert.equal(serialized.includes(`loop-${suffix}`), false);
  });

  it('links one unmatched message idempotently through an explicit correspondence command', async () => {
    const target = await createSentCorrespondence(app, graph);
    const correspondenceWork = await request(app.getHttpServer())
      .get(`/projects/${target.projectId}/customer-correspondences`)
      .expect(200);
    const correspondenceId = correspondenceWork.body.correspondences[0].id as string;
    const messageId = `manual-link-${Date.now()}-${Math.random()}`;
    graph.queue({
      id: messageId,
      internetMessageId: `<${messageId}@example.test>`,
      from: { emailAddress: { address: 'forwarded-customer@example.test' } },
      toRecipients: [{ emailAddress: { address: 'reply51@pte.hu' } }],
      subject: 'Kézzel társítandó Customer kérdés',
      body: { contentType: 'text', content: 'A társítás után ez egy Customer válasz.' },
      receivedDateTime: '2026-08-18T17:15:00.000Z',
    });
    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);
    const triage = await request(app.getHttpServer()).get('/customer-mail-triage').expect(200);
    assert.equal(
      triage.body.eligibleCorrespondences.some(
        (candidate: { projectId: string; correspondenceId: string }) =>
          candidate.projectId === target.projectId && candidate.correspondenceId === correspondenceId,
      ),
      true,
    );
    const unmatched = triage.body.unmatchedMessages.find(
      (message: { providerMessageReference: string }) =>
        message.providerMessageReference === messageId,
    );
    assert.ok(unmatched);

    const command = {
      command: 'LINK',
      correspondenceId,
      expectedVersion: unmatched.version,
    };
    const linked = await request(app.getHttpServer())
      .post(`/customer-mail-triage/${unmatched.id}/commands`)
      .send(command)
      .expect(201);
    assert.deepEqual(linked.body, {
      messageId: unmatched.id,
      state: 'LINKED',
      version: 2,
      projectId: target.projectId,
      correspondenceId,
    });
    const repeated = await request(app.getHttpServer())
      .post(`/customer-mail-triage/${unmatched.id}/commands`)
      .send(command)
      .expect(201);
    assert.deepEqual(repeated.body, linked.body);

    const updated = await request(app.getHttpServer())
      .get(`/projects/${target.projectId}/customer-correspondences`)
      .expect(200);
    assert.equal(updated.body.correspondences[0].status, 'Új válasz');
    assert.equal(updated.body.correspondences[0].unreadMessageCount, 1);
    const linkedMessage = updated.body.correspondences[0].messages.find(
      (message: { providerMessageReference: string }) =>
        message.providerMessageReference === messageId,
    );
    assert.equal(linkedMessage.correlationEvidence, 'MANUAL_TRIAGE');

    const audit = await request(app.getHttpServer())
      .get(`/projects/${target.projectId}/audit-events`)
      .expect(200);
    const linkEvents = audit.body.events.filter(
      (event: { eventType: string }) => event.eventType === 'CUSTOMER_UNMATCHED_MESSAGE_LINKED',
    );
    assert.equal(linkEvents.length, 1);
    assert.equal(JSON.stringify(linkEvents).includes('A társítás után'), false);
    assert.equal(JSON.stringify(linkEvents).includes('Kézzel társítandó'), false);
  });

  it('dismisses an irrelevant unmatched message idempotently and removes it from active triage', async () => {
    const messageId = `dismiss-${Date.now()}-${Math.random()}`;
    graph.queue({
      id: messageId,
      internetMessageId: `<${messageId}@example.test>`,
      from: { emailAddress: { address: 'newsletter@example.test' } },
      toRecipients: [{ emailAddress: { address: 'reply51@pte.hu' } }],
      subject: 'Nem projektüzenet',
      body: { contentType: 'text', content: 'Ez az üzenet nem tartozik projekthez.' },
      receivedDateTime: '2026-08-18T17:30:00.000Z',
    });
    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);
    const before = await request(app.getHttpServer()).get('/customer-mail-triage').expect(200);
    const unmatched = before.body.unmatchedMessages.find(
      (message: { providerMessageReference: string }) =>
        message.providerMessageReference === messageId,
    );
    assert.ok(unmatched);
    const command = { command: 'DISMISS', expectedVersion: unmatched.version };

    const dismissed = await request(app.getHttpServer())
      .post(`/customer-mail-triage/${unmatched.id}/commands`)
      .send(command)
      .expect(201);
    assert.deepEqual(dismissed.body, {
      messageId: unmatched.id,
      state: 'DISMISSED',
      version: 2,
      projectId: null,
      correspondenceId: null,
    });
    const repeated = await request(app.getHttpServer())
      .post(`/customer-mail-triage/${unmatched.id}/commands`)
      .send(command)
      .expect(201);
    assert.deepEqual(repeated.body, dismissed.body);
    const after = await request(app.getHttpServer()).get('/customer-mail-triage').expect(200);
    assert.equal(
      after.body.unmatchedMessages.some(
        (message: { providerMessageReference: string }) =>
          message.providerMessageReference === messageId,
      ),
      false,
    );
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
    const priorMessageId = mismatch.body.correspondences[0].messages[0].id as string;
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-correspondences/${correspondenceId}/commands`)
      .send({
        command: 'CLASSIFY_MESSAGE',
        expectedVersion: mismatch.body.correspondences[0].processingVersion,
        messageId: priorMessageId,
        classification: 'Elfogadva',
        closeCorrespondence: true,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-correspondences/${correspondenceId}/commands`)
      .send({ command: 'MARK_REVIEWED', expectedVersion: mismatch.body.correspondences[0].processingVersion + 1 })
      .expect(201);
    graph.queue(inboundMessage(lateId, replyToAddress, '2026-08-18T17:00:00.000Z'));
    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);

    const reopened = await request(app.getHttpServer())
      .get(`/projects/${projectId}/customer-correspondences`)
      .expect(200);
    assert.equal(reopened.body.correspondences[0].status, 'Új válasz');
    assert.equal(reopened.body.correspondences[0].unreadMessageCount, 1);
    assert.equal(reopened.body.correspondences[0].messages[0].classification, 'Elfogadva');
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
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-correspondences/${correspondenceId}/commands`)
      .send({ command: 'SET_STATUS', expectedVersion: 5, status: 'Lezárva' })
      .expect(409);
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
      'Módosítást kér',
      'Kérdés vagy válasz',
      'Egyéb',
      'Elfogadva',
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

  it('connects a change-request reply to the established handoff revision command and predecessor correspondence', async () => {
    const { projectId, roundId, customerEmail } = await createEndedInterview(app);
    const history = await request(app.getHttpServer())
      .get(`/projects/${projectId}/rounds/${roundId}/customer-handoffs`)
      .expect(200);
    const firstHandoffId = history.body[0].id as string;
    const firstPreview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${firstHandoffId}/preview`)
      .send({ mode: 'CUSTOM', name: 'PO Péter', address: 'po.peter@pte.hu' })
      .expect(201);
    const firstSent = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${firstHandoffId}/send`)
      .send(sendInput(firstPreview.body))
      .expect(201);
    const firstReplyTo = graph.sent.at(-1)?.replyTo[0]?.emailAddress.address;
    assert.ok(firstReplyTo);

    graph.queue({
      ...inboundMessage(`change-request-${Date.now()}-${Math.random()}`, firstReplyTo, '2026-08-18T19:00:00.000Z'),
      from: { emailAddress: { address: customerEmail } },
    });
    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);
    const received = await request(app.getHttpServer())
      .get(`/projects/${projectId}/customer-correspondences`)
      .expect(200);
    const firstCorrespondence = received.body.correspondences[0];
    const classified = await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-correspondences/${firstCorrespondence.id}/commands`)
      .send({
        command: 'CLASSIFY_MESSAGE',
        expectedVersion: firstCorrespondence.processingVersion,
        messageId: firstCorrespondence.messages[0].id,
        classification: 'Módosítást kér',
      })
      .expect(201);
    assert.deepEqual(classified.body.source, {
      type: 'INTERVIEW_HANDOFF',
      roundId,
      handoffId: firstHandoffId,
      version: 1,
      state: 'SENT',
    });
    assert.equal(classified.body.predecessorId, null);

    const revision = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${classified.body.source.roundId}/customer-handoffs`)
      .send({})
      .expect(201);
    assert.equal(revision.body.version, 2);
    assert.equal(revision.body.supersedesHandoffId, firstHandoffId);
    await request(app.getHttpServer())
      .put(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${revision.body.id}/draft`)
      .send({ modificationSummary: 'A Customer módosítási kérésének átvezetése.' })
      .expect(200);
    const secondPreview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${revision.body.id}/preview`)
      .send({ mode: 'CUSTOM', name: 'PO Péter', address: 'po.peter@pte.hu' })
      .expect(201);
    const secondSent = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${revision.body.id}/send`)
      .send(sendInput(secondPreview.body))
      .expect(201);
    assert.notEqual(secondSent.body.correspondenceId, firstSent.body.correspondenceId);

    const linked = await request(app.getHttpServer())
      .get(`/projects/${projectId}/customer-correspondences`)
      .expect(200);
    const secondCorrespondence = linked.body.correspondences.find(
      (correspondence: { id: string }) => correspondence.id === secondSent.body.correspondenceId,
    );
    assert.equal(secondCorrespondence.predecessorId, firstSent.body.correspondenceId);
    assert.equal(linked.body.correspondences.length, 2);
  });

  it('retains UNKNOWN ping receipt evidence and source review state across archive and restore', async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const customerEmail = `ping-reply-${suffix}@example.test`;
    const project = await request(app.getHttpServer()).post('/projects').send({
      name: `Ping reply ${suffix}`,
      customerContactName: 'Ügyfél Anna',
      customerContactEmail: customerEmail,
      internalOwnerName: 'PO Péter',
      nextActionOwnerRole: 'CUSTOMER_CONTACT',
    }).expect(201);
    const projectId = project.body.id as string;
    const followUp = await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups`)
      .send({
        category: 'BUSINESS',
        question: 'Melyik üzleti szabály hiányzik?',
        owner: 'PO Péter',
        dueDate: '2026-09-15',
        nextStep: 'Az ügyfél pontosítja a szabályt.',
      })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({
        messageDraft: 'Kérlek, pontosítsd a nyitott kérdést.',
        referencedFollowUpId: followUp.body.id,
        expectedVersion: 1,
      })
      .expect(200);
    const preview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/preview`)
      .send({ expectedVersion: 2 })
      .expect(201);
    graph.submitMode = 'UNKNOWN';
    const unknown = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: preview.body.previewToken })
      .expect(503);
    graph.submitMode = 'SUCCESS';
    assert.equal(unknown.body.code, 'FOLLOW_UP_DELIVERY_UNKNOWN');
    const stateBeforeReply = await request(app.getHttpServer()).get(`/projects/${projectId}/follow-up`).expect(200);
    const attemptId = stateBeforeReply.body.latestManualAttempt.attemptId as string;
    const replyToAddress = graph.sent.at(-1)?.replyTo[0]?.emailAddress.address;
    assert.ok(replyToAddress);

    graph.queue({
      ...inboundMessage(`unknown-receipt-${suffix}`, replyToAddress, '2026-08-18T20:00:00.000Z'),
      from: { emailAddress: { address: customerEmail } },
    });
    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);
    const received = await request(app.getHttpServer())
      .get(`/projects/${projectId}/customer-correspondences`)
      .expect(200);
    const correspondence = received.body.correspondences[0];
    assert.deepEqual(correspondence.source, {
      type: 'CUSTOMER_FOLLOW_UP_PING',
      attemptId,
      state: 'UNKNOWN',
      followUpId: followUp.body.id,
      followUpVersion: 1,
    });
    assert.equal(correspondence.unknownDeliveryReceiptEvidence, true);
    const stateWithEvidence = await request(app.getHttpServer()).get(`/projects/${projectId}/follow-up`).expect(200);
    assert.equal(stateWithEvidence.body.latestManualAttempt.state, 'UNKNOWN');
    assert.equal(stateWithEvidence.body.latestManualAttempt.receiptEvidence, true);
    const blockedRetry = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/retry`)
      .send({ attemptId, acknowledgeDuplicateRisk: true })
      .expect(409);
    assert.equal(blockedRetry.body.code, 'FOLLOW_UP_RECEIPT_EVIDENCE');

    const classified = await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-correspondences/${correspondence.id}/commands`)
      .send({
        command: 'CLASSIFY_MESSAGE',
        expectedVersion: correspondence.processingVersion,
        messageId: correspondence.messages[0].id,
        classification: 'Kérdés vagy válasz',
      })
      .expect(201);
    await request(app.getHttpServer()).post(`/projects/${projectId}/archive`).send({}).expect(201);
    graph.queue({
      ...inboundMessage(`archived-receipt-${suffix}`, replyToAddress, '2026-08-18T20:30:00.000Z'),
      from: { emailAddress: { address: customerEmail } },
    });
    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);
    const archived = await request(app.getHttpServer())
      .get(`/projects/${projectId}/customer-correspondences`)
      .expect(200);
    assert.equal(archived.body.correspondences[0].unreadMessageCount, 2);
    assert.equal(archived.body.correspondences[0].status, 'Új válasz');
    assert.equal(archived.body.correspondences[0].messages[0].classification, 'Kérdés vagy válasz');
    assert.deepEqual(archived.body.correspondences[0].source, correspondence.source);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/customer-correspondences/${correspondence.id}/commands`)
      .send({ command: 'MARK_REVIEWED', expectedVersion: classified.body.processingVersion + 1 })
      .expect(409);

    await request(app.getHttpServer()).post(`/projects/${projectId}/restore`).send({}).expect(201);
    const restored = await request(app.getHttpServer())
      .get(`/projects/${projectId}/customer-correspondences`)
      .expect(200);
    assert.equal(restored.body.correspondences[0].unreadMessageCount, 2);
    assert.equal(restored.body.correspondences[0].processingVersion, classified.body.processingVersion + 1);
    assert.equal(restored.body.correspondences[0].messages.length, 2);
    assert.deepEqual(restored.body.correspondences[0].source, correspondence.source);
  });

  it('suppresses retry for an UNKNOWN handoff after a correlated receipt while preserving UNKNOWN', async () => {
    const suffix = `${Date.now()}-${Math.random()}`;
    const { projectId, roundId, customerEmail } = await createEndedInterview(app);
    const history = await request(app.getHttpServer())
      .get(`/projects/${projectId}/rounds/${roundId}/customer-handoffs`)
      .expect(200);
    const handoffId = history.body[0].id as string;
    const preview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/preview`)
      .send({ mode: 'CUSTOM', name: 'PO Péter', address: 'po.peter@pte.hu' })
      .expect(201);
    graph.submitMode = 'UNKNOWN';
    const unknown = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/send`)
      .send(sendInput(preview.body))
      .expect(201);
    graph.submitMode = 'SUCCESS';
    assert.equal(unknown.body.state, 'UNKNOWN');
    const replyToAddress = graph.sent.at(-1)?.replyTo[0]?.emailAddress.address;
    assert.ok(replyToAddress);
    graph.queue({
      ...inboundMessage(`unknown-handoff-receipt-${suffix}`, replyToAddress, '2026-08-18T21:00:00.000Z'),
      from: { emailAddress: { address: customerEmail } },
    });
    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);

    const withReceipt = await request(app.getHttpServer())
      .get(`/projects/${projectId}/rounds/${roundId}/customer-handoffs`)
      .expect(200);
    assert.equal(withReceipt.body[0].state, 'UNKNOWN');
    assert.equal(withReceipt.body[0].receiptEvidence, true);
    const submittedCount = graph.sent.length;
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/retry`)
      .send({ acknowledgeDuplicateRisk: true })
      .expect(409);
    assert.equal(graph.sent.length, submittedCount);
    const stillUnknown = await request(app.getHttpServer())
      .get(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}`)
      .expect(200);
    assert.equal(stillUnknown.body.state, 'UNKNOWN');
    assert.equal(stillUnknown.body.receiptEvidence, true);

    const revision = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs`)
      .send({})
      .expect(201);
    assert.equal(revision.body.state, 'DRAFT');
    assert.equal(revision.body.version, 2);
    assert.equal(revision.body.supersedesHandoffId, handoffId);
    const preservedUnknown = await request(app.getHttpServer())
      .get(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}`)
      .expect(200);
    assert.equal(preservedUnknown.body.state, 'UNKNOWN');
    assert.equal(preservedUnknown.body.receiptEvidence, true);
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
