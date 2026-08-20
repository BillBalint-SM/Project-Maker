import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import {
  CustomerMailBoundaryError,
  type CustomerMailboxChanges,
  type CustomerOutboundMail,
  customerMailboxChangesToken,
  customerOutboundMailToken,
} from '../src/mail-delivery/customer-mail-boundary';
import type {
  CustomerMailboxChange,
  CustomerMailboxChangePage,
  MailSubmissionResult,
  OutboundCustomerMessage,
} from '@project-maker/contracts';

class CustomerReplyMailFake implements CustomerOutboundMail, CustomerMailboxChanges {
  readonly sent: OutboundCustomerMessage[] = [];
  submitMode: 'SUCCESS' | 'UNKNOWN' = 'SUCCESS';
  private pages: readonly CustomerMailboxChangePage[] = [];
  private checkpointVersion = 0;
  private heldRead: { started: () => void; wait: Promise<void> } | null = null;

  isConfigured(): boolean { return true; }

  async submit(message: OutboundCustomerMessage): Promise<MailSubmissionResult> {
    this.sent.push(message);
    if (this.submitMode === 'UNKNOWN') throw new CustomerMailBoundaryError('OUTCOME_UNKNOWN');
    return { acceptance: 'ACCEPTED', messageReference: `outbound-${this.sent.length}` };
  }

  async readChanges(_checkpoint: { value: string } | null): Promise<CustomerMailboxChangePage> {
    if (this.heldRead) {
      const held = this.heldRead;
      this.heldRead = null;
      held.started();
      await held.wait;
    }
    this.checkpointVersion += 1;
    const page = this.pages[0];
    this.pages = this.pages.slice(1);
    return page ?? emptyMailboxPage(this.checkpointVersion);
  }

  queue(...pages: readonly CustomerMailboxChangePage[]): void {
    this.pages = pages;
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
  const mail = new CustomerReplyMailFake();

  before(async () => {
    process.env['CORRESPONDENCE_MAILBOX_ADDRESS'] = 'reply51@example.test';
    process.env['CORRESPONDENCE_MAILBOX_NAME'] = 'Project Maker';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(customerOutboundMailToken)
      .useValue(mail)
      .overrideProvider(customerMailboxChangesToken)
      .useValue(mail)
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
    const secondModule = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(customerOutboundMailToken)
      .useValue(mail)
      .overrideProvider(customerMailboxChangesToken)
      .useValue(mail)
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
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/send`)
      .send(sendInput(preview.body))
      .expect(201);
    const replyToAddress = mail.sent.at(-1)?.replyToAddress;
    assert.ok(replyToAddress);

    const reply = inboundMessage(providerMessageReference, replyToAddress, '2026-08-18T14:00:00.000Z', {
      internetMessageId: '<reply-1@example.test>',
      senderAddress: customerEmail,
      textContent: 'Mehet a projekt.\nOn Monday wrote:\nRégi szöveg',
      attachmentCount: 1,
      attachments: [{ name: 'scope.pdf', contentType: 'application/pdf', size: 2048 }],
    });
    mail.queue(mailboxPage(reply));
    const held = mail.holdNextRead();
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

    mail.queue(mailboxPage(reply));
    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);
    mail.queue(mailboxPage({ ...reply, messageReference: `${providerMessageReference}-reissued` }));
    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);
    const replayed = await request(app.getHttpServer())
      .get(`/projects/${projectId}/customer-correspondences`)
      .expect(200);
    assert.equal(replayed.body.newReplyCount, 0);
    assert.equal(replayed.body.correspondences[0].messages.length, 1);
  });

  it('retains an uncorrelated message for explicit triage without inferring a Project', async () => {
    const messageId = `unmatched-${Date.now()}-${Math.random()}`;
    mail.queue(mailboxPage(inboundMessage(messageId, 'reply51@example.test', '2026-08-18T17:00:00.000Z', {
      internetMessageId: `<${messageId}@example.test>`,
      senderAddress: 'forwarded-customer@example.test',
      subject: 'Továbbított Customer kérdés',
      textContent: 'Ezt az üzenetet kézzel kell társítani.',
    })));

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
    const target = await createSentCorrespondence(app, mail);
    const suffix = `${Date.now()}-${Math.random()}`;
    mail.queue(mailboxPage(
      {
        ...inboundMessage(`dsn-${suffix}`, target.replyToAddress, '2026-08-18T17:05:00.000Z'),
        internetMessageId: `<dsn-${suffix}@example.test>`,
        automationKind: 'DELIVERY_REPORT',
      },
      {
        ...inboundMessage(`dsn-${suffix}-reissued`, target.replyToAddress, '2026-08-18T17:05:00.000Z'),
        internetMessageId: `<dsn-${suffix}@example.test>`,
        automationKind: 'DELIVERY_REPORT',
      },
      {
        ...inboundMessage(`ooo-${suffix}`, target.replyToAddress, '2026-08-18T17:06:00.000Z'),
        automationKind: 'OUT_OF_OFFICE',
      },
      {
        ...inboundMessage(`loop-${suffix}`, target.replyToAddress, '2026-08-18T17:07:00.000Z'),
        senderAddress: 'REPLY51@EXAMPLE.TEST',
      },
      {
        ...inboundMessage(`automated-${suffix}`, target.replyToAddress, '2026-08-18T17:08:00.000Z'),
        automationKind: 'UNKNOWN_AUTOMATION',
      },
    ));

    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);

    const correspondence = await request(app.getHttpServer())
      .get(`/projects/${target.projectId}/customer-correspondences`)
      .expect(200);
    assert.equal(correspondence.body.newReplyCount, 0);
    assert.equal(correspondence.body.correspondences[0].unreadMessageCount, 0);
    const triage = await request(app.getHttpServer()).get('/customer-mail-triage').expect(200);
    assert.deepEqual(
      triage.body.mailSystemEvents
        .filter((event: { providerMessageReference: string }) => event.providerMessageReference.includes(suffix))
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
    const target = await createSentCorrespondence(app, mail);
    const correspondenceWork = await request(app.getHttpServer())
      .get(`/projects/${target.projectId}/customer-correspondences`)
      .expect(200);
    const correspondenceId = correspondenceWork.body.correspondences[0].id as string;
    const messageId = `manual-link-${Date.now()}-${Math.random()}`;
    mail.queue(mailboxPage(inboundMessage(messageId, 'reply51@example.test', '2026-08-18T17:15:00.000Z', {
      internetMessageId: `<${messageId}@example.test>`,
      senderAddress: 'forwarded-customer@example.test',
      subject: 'Kézzel társítandó Customer kérdés',
      textContent: 'A társítás után ez egy Customer válasz.',
    })));
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
    await request(app.getHttpServer())
      .post(`/projects/${target.projectId}/customer-correspondences/${correspondenceId}/commands`)
      .send({
        command: 'SET_STATUS',
        expectedVersion: updated.body.correspondences[0].processingVersion,
        status: 'Lezárva',
      })
      .expect(409);

    const classified = await request(app.getHttpServer())
      .post(`/projects/${target.projectId}/customer-correspondences/${correspondenceId}/commands`)
      .send({
        command: 'CLASSIFY_MESSAGE',
        expectedVersion: updated.body.correspondences[0].processingVersion,
        messageId: unmatched.id,
        classification: 'Elfogadva',
        closeCorrespondence: true,
      })
      .expect(201);
    assert.equal(classified.body.status, 'Lezárva');
    assert.equal(classified.body.messages[0].classification, 'Elfogadva');

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
    mail.queue(mailboxPage(inboundMessage(messageId, 'reply51@example.test', '2026-08-18T17:30:00.000Z', {
      internetMessageId: `<${messageId}@example.test>`,
      senderAddress: 'newsletter@example.test',
      subject: 'Nem projektüzenet',
      textContent: 'Ez az üzenet nem tartozik projekthez.',
    })));
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
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/send`)
      .send(sendInput(preview.body))
      .expect(201);
    const replyToAddress = mail.sent.at(-1)?.replyToAddress;
    assert.ok(replyToAddress);

    mail.queue(mailboxPage(inboundMessage(`unmatched-${messageSuffix}`, 'reply51+invalid@example.test', '2026-08-18T15:00:00.000Z', {
      inReplyTo: '<outbound-2>',
      subject: preview.body.subject,
      textContent: 'A tárgy és a header nem elegendő.',
    })));
    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);
    const withoutInference = await request(app.getHttpServer())
      .get(`/projects/${projectId}/customer-correspondences`)
      .expect(200);
    assert.equal(withoutInference.body.newReplyCount, 0);
    assert.equal(withoutInference.body.correspondences[0].messages.length, 0);

    mail.queue(mailboxPage(inboundMessage(mismatchId, replyToAddress, '2026-08-18T16:00:00.000Z')));
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
    mail.queue(mailboxPage(inboundMessage(lateId, replyToAddress, '2026-08-18T17:00:00.000Z')));
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
    const { projectId, replyToAddress } = await createSentCorrespondence(app, mail);
    const suffix = `${Date.now()}-${Math.random()}`;
    mail.queue(mailboxPage(
      inboundMessage(`accepted-${suffix}`, replyToAddress, '2026-08-18T18:00:00.000Z'),
      inboundMessage(`change-${suffix}`, replyToAddress, '2026-08-18T18:01:00.000Z'),
      inboundMessage(`question-${suffix}`, replyToAddress, '2026-08-18T18:02:00.000Z'),
      inboundMessage(`other-${suffix}`, replyToAddress, '2026-08-18T18:03:00.000Z'),
    ));
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
      activity.body.events.some((event: { summary: string }) => event.summary.includes('ügyfél')),
      true,
    );
    assert.equal(
      activity.body.events.some((event: { summary: string }) => event.summary.includes('Customer')),
      false,
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
      .send({})
      .expect(201);
    const firstSent = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${firstHandoffId}/send`)
      .send(sendInput(firstPreview.body))
      .expect(201);
    const firstReplyTo = mail.sent.at(-1)?.replyToAddress;
    assert.ok(firstReplyTo);

    mail.queue(mailboxPage({
      ...inboundMessage(`change-request-${Date.now()}-${Math.random()}`, firstReplyTo, '2026-08-18T19:00:00.000Z'),
      senderAddress: customerEmail,
    }));
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
      .send({})
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
    mail.submitMode = 'UNKNOWN';
    const unknown = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: preview.body.previewToken })
      .expect(503);
    mail.submitMode = 'SUCCESS';
    assert.equal(unknown.body.code, 'FOLLOW_UP_DELIVERY_UNKNOWN');
    const stateBeforeReply = await request(app.getHttpServer()).get(`/projects/${projectId}/follow-up`).expect(200);
    const attemptId = stateBeforeReply.body.latestManualAttempt.attemptId as string;
    const replyToAddress = mail.sent.at(-1)?.replyToAddress;
    assert.ok(replyToAddress);

    mail.queue(mailboxPage({
      ...inboundMessage(`unknown-receipt-${suffix}`, replyToAddress, '2026-08-18T20:00:00.000Z'),
      senderAddress: customerEmail,
    }));
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
    mail.queue(mailboxPage({
      ...inboundMessage(`archived-receipt-${suffix}`, replyToAddress, '2026-08-18T20:30:00.000Z'),
      senderAddress: customerEmail,
    }));
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
      .send({})
      .expect(201);
    mail.submitMode = 'UNKNOWN';
    const unknown = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/send`)
      .send(sendInput(preview.body))
      .expect(201);
    mail.submitMode = 'SUCCESS';
    assert.equal(unknown.body.state, 'UNKNOWN');
    const replyToAddress = mail.sent.at(-1)?.replyToAddress;
    assert.ok(replyToAddress);
    mail.queue(mailboxPage({
      ...inboundMessage(`unknown-handoff-receipt-${suffix}`, replyToAddress, '2026-08-18T21:00:00.000Z'),
      senderAddress: customerEmail,
    }));
    await request(app.getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);

    const withReceipt = await request(app.getHttpServer())
      .get(`/projects/${projectId}/rounds/${roundId}/customer-handoffs`)
      .expect(200);
    assert.equal(withReceipt.body[0].state, 'UNKNOWN');
    assert.equal(withReceipt.body[0].receiptEvidence, true);
    const submittedCount = mail.sent.length;
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/retry`)
      .send({ acknowledgeDuplicateRisk: true })
      .expect(409);
    assert.equal(mail.sent.length, submittedCount);
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

function inboundMessage(
  messageReference: string,
  replyToAddress: string,
  receivedAt: string,
  overrides: Partial<CustomerMailboxChange> = {},
): CustomerMailboxChange {
  return {
    changeType: 'UPSERTED',
    automationKind: 'HUMAN',
    messageReference,
    internetMessageId: null,
    inReplyTo: null,
    senderAddress: 'intruder@example.test',
    recipientAddresses: [replyToAddress],
    subject: 'Re: Projektösszefoglaló',
    textContent: `Válasz ${messageReference}`,
    receivedAt,
    attachmentCount: 0,
    attachments: [],
    ...overrides,
  };
}

function mailboxPage(...changes: readonly CustomerMailboxChange[]): CustomerMailboxChangePage {
  return {
    changes,
    nextPageCheckpoint: null,
    completedCheckpoint: { value: 'test-checkpoint' },
  };
}

function emptyMailboxPage(checkpointVersion: number): CustomerMailboxChangePage {
  return {
    changes: [],
    nextPageCheckpoint: null,
    completedCheckpoint: { value: `checkpoint-${checkpointVersion}` },
  };
}

function sendInput(preview: {
  sourceContentVersion: number;
  previewDigest: string;
}) {
  return {
    sourceContentVersion: preview.sourceContentVersion,
    previewDigest: preview.previewDigest,
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
  mail: CustomerReplyMailFake,
): Promise<{ projectId: string; replyToAddress: string }> {
  const { projectId, roundId } = await createEndedInterview(app);
  const history = await request(app.getHttpServer())
    .get(`/projects/${projectId}/rounds/${roundId}/customer-handoffs`)
    .expect(200);
  const handoffId = history.body[0].id as string;
  const preview = await request(app.getHttpServer())
    .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/preview`)
    .send({})
    .expect(201);
  await request(app.getHttpServer())
    .post(`/projects/${projectId}/rounds/${roundId}/customer-handoffs/${handoffId}/send`)
    .send(sendInput(preview.body))
    .expect(201);
  const replyToAddress = mail.sent.at(-1)?.replyToAddress;
  assert.ok(replyToAddress);
  return { projectId, replyToAddress };
}
