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
  CustomerMailBoundaryError,
  customerOutboundMailToken,
} from '../src/mail-delivery/customer-mail-boundary';
import { CustomerFollowUpService } from '../src/follow-ups/follow-up.service';

interface DeliveredMessage {
  readonly to: string;
  readonly subject: string;
  readonly text: string;
  readonly html?: string;
}

describe('Customer follow-up ping draft and manual delivery', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let followUpService: CustomerFollowUpService;
  const delivered: DeliveredMessage[] = [];
  const submitted: OutboundCustomerMessage[] = [];
  const deliveredMessageFrozen: boolean[] = [];
  let deliveryMode: 'SUCCESS' | 'FAILED' | 'UNKNOWN' = 'SUCCESS';
  let deliveryStarted: (() => void) | null = null;
  let releaseDelivery: (() => void) | null = null;

  before(async () => {
    process.env['CORRESPONDENCE_MAILBOX_ADDRESS'] = 'project-maker@example.test';
    process.env['CORRESPONDENCE_MAILBOX_NAME'] = 'Project Maker';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(customerOutboundMailToken)
      .useValue({
        isConfigured: () => true,
        submit: async (message: OutboundCustomerMessage) => {
          submitted.push(message);
          deliveredMessageFrozen.push(Object.isFrozen(message));
          if (deliveryMode === 'FAILED') return { acceptance: 'REJECTED', messageReference: null } as const;
          if (deliveryMode === 'UNKNOWN') throw new CustomerMailBoundaryError('OUTCOME_UNKNOWN');
          delivered.push({
            to: message.recipientAddress,
            subject: message.subject,
            text: message.textContent,
            ...(message.htmlContent === undefined ? {} : { html: message.htmlContent }),
          });
          deliveryStarted?.();
          if (releaseDelivery) {
            await new Promise<void>((resolve) => {
              const release = releaseDelivery;
              releaseDelivery = () => {
                release?.();
                resolve();
              };
            });
          }
          return { acceptance: 'ACCEPTED', messageReference: null } as const;
        },
      })
      .compile();

    app = module.createNestApplication({ logger: false });
    await app.init();
    dataSource = app.get(DataSource);
    followUpService = app.get(CustomerFollowUpService);
  });

  beforeEach(async () => {
    await dataSource.query(
      'UPDATE customer_follow_ups SET enabled = false, next_ping_at = NULL WHERE enabled = true',
    );
    delivered.length = 0;
    submitted.length = 0;
    deliveryMode = 'SUCCESS';
    deliveryStarted = null;
    releaseDelivery = null;
  });

  after(async () => app.close());

  it('persists one normalized optimistic ping draft per project', async () => {
    const projectId = await createProject(app, 'draft');

    const initial = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up`)
      .expect(200);
    assert.equal(initial.body.messageDraft, null);
    assert.equal(initial.body.referencedFollowUpId, null);
    assert.equal(initial.body.draftVersion, 1);

    const saved = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({
        messageDraft: '  Kérlek, pontosítsd a nyitott kérdést.  ',
        referencedFollowUpId: null,
        expectedVersion: 1,
      })
      .expect(200);
    assert.equal(saved.body.messageDraft, 'Kérlek, pontosítsd a nyitott kérdést.');
    assert.equal(saved.body.referencedFollowUpId, null);
    assert.equal(saved.body.draftVersion, 2);

    const reloaded = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up`)
      .expect(200);
    assert.equal(reloaded.body.messageDraft, saved.body.messageDraft);
    assert.equal(reloaded.body.draftVersion, 2);
  });

  it('offers and persists only an open Discovery follow-up from the same project', async () => {
    const projectId = await createProject(app, 'reference');
    const otherProjectId = await createProject(app, 'other-reference');
    const eligible = await createDiscoveryFollowUp(app, projectId, 'Melyik üzleti szabály hiányzik?');
    await createDiscoveryFollowUp(app, otherProjectId, 'Másik projekt kérdése');

    const options = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up/reference-options`)
      .expect(200);
    assert.deepEqual(options.body, [
      {
        id: eligible.id,
        question: 'Melyik üzleti szabály hiányzik?',
        nextStep: 'Az ügyfél pontosítja a szabályt.',
        dueDate: '2026-09-15',
        version: 1,
      },
    ]);

    const saved = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({
        messageDraft: 'Kérlek, válaszolj a kapcsolódó kérdésre.',
        referencedFollowUpId: eligible.id,
        expectedVersion: 1,
      })
      .expect(200);
    assert.equal(saved.body.referencedFollowUpId, eligible.id);
    assert.equal(saved.body.draftVersion, 2);
  });

  it('previews the exact bounded projection and consumes it for one successful send', async () => {
    const projectId = await createProject(app, 'preview-send');
    const initialSenderIdentity = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up/sender-identity`)
      .expect(200);
    assert.deepEqual(initialSenderIdentity.body, {
      name: 'Project Maker',
      address: 'project-maker@example.test',
    });
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/preview`)
      .send({
        expectedVersion: 1,
        senderMode: 'CUSTOM',
        senderName: 'Téves feladó',
        senderAddress: 'personal@example.test',
      })
      .expect(400);
    const reference = await createDiscoveryFollowUp(
      app,
      projectId,
      'Melyik jóváhagyás hiányzik?',
    );
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({
        messageDraft: 'Kérlek, küldd el a hiányzó jóváhagyást.',
        referencedFollowUpId: reference.id,
        expectedVersion: 1,
      })
      .expect(200);

    const preview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/preview`)
      .send({
        expectedVersion: 2,
      })
      .expect(201);
    assert.match(preview.body.recipientName, /Ügyfél Anna/);
    assert.match(preview.body.recipientEmail, /@example\.test$/);
    assert.match(preview.body.subject, /^Pontosítás kérése — Customer ping preview-send/);
    assert.equal(preview.body.draftVersion, 2);
    assert.equal(preview.body.referencedFollowUpVersion, 1);
    assert.equal(preview.body.senderName, 'Project Maker');
    assert.equal(preview.body.senderAddress, 'project-maker@example.test');
    assert.equal(typeof preview.body.previewToken, 'string');
    assert.match(preview.body.text, /Kérlek, küldd el a hiányzó jóváhagyást\./);
    assert.match(preview.body.text, /Kérdés: Melyik jóváhagyás hiányzik\?/);
    assert.match(preview.body.text, /Következő lépés: Az ügyfél pontosítja a szabályt\./);
    assert.match(preview.body.text, /Határidő: 2026-09-15/);
    for (const forbidden of ['PO Péter', 'BUSINESS', reference.id, '.md', 'Markdown', 'Claude']) {
      assert.equal(preview.body.text.includes(forbidden), false);
    }

    const sent = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: preview.body.previewToken });
    assert.equal(sent.status, 201, JSON.stringify(sent.body));
    assert.equal(sent.body.state, 'SENT');
    assert.equal(sent.body.draftVersion, 2);
    assert.equal(delivered.length, 1);
    assert.equal(submitted.length, 1);
    assert.equal(submitted[0]?.senderName, 'Project Maker');
    assert.equal(submitted[0]?.senderAddress, 'project-maker@example.test');
    assert.match(submitted[0]?.replyToAddress ?? '', /^.+\+[A-Za-z0-9_-]+@example\.test$/);
    assert.equal(deliveredMessageFrozen.at(-1), true);
    assert.deepEqual(delivered[0], {
      to: preview.body.recipientEmail,
      subject: preview.body.subject,
      text: preview.body.text,
    });

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: preview.body.previewToken })
      .expect(409);
    assert.equal(delivered.length, 1);

    const outboundRows = await dataSource.query<Array<{
      source_type: string;
      source_id: string;
      sender_name: string;
      sender_address: string;
      reply_to_address: string;
    }>>(
      `SELECT source_type, source_id, sender_name, sender_address, reply_to_address
       FROM customer_outbound_communications
       WHERE project_id = $1`,
      [projectId],
    );
    assert.equal(outboundRows.length, 1);
    assert.equal(outboundRows[0]?.source_type, 'CUSTOMER_FOLLOW_UP_PING');
    assert.equal(outboundRows[0]?.sender_name, 'Project Maker');
    assert.equal(outboundRows[0]?.sender_address, 'project-maker@example.test');
    assert.equal(outboundRows[0]?.reply_to_address, submitted[0]?.replyToAddress);

    const correspondenceRows = await dataSource.query<Array<{
      outbound_communication_id: string;
    }>>(
      `SELECT outbound_communication_id
       FROM customer_correspondences
       WHERE project_id = $1`,
      [projectId],
    );
    assert.equal(correspondenceRows.length, 1);

    const unchangedSenderIdentity = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up/sender-identity`)
      .expect(200);
    assert.deepEqual(unchangedSenderIdentity.body, initialSenderIdentity.body);

    const audits = await dataSource.query<Array<{ event_type: string; payload: Record<string, string> }>>(
      'SELECT event_type, payload FROM audit_events WHERE project_id = $1 AND event_type = $2',
      [projectId, 'CUSTOMER_FOLLOW_UP_PING_SENT'],
    );
    assert.equal(audits.length, 1);
    const serializedAudit = JSON.stringify(audits[0].payload);
    for (const forbidden of [
      'Kérlek, küldd el',
      'Melyik jóváhagyás',
      'Ügyfél Anna',
      preview.body.recipientEmail,
    ]) {
      assert.equal(serializedAudit.includes(forbidden), false);
    }
  });

  it('rejects invalid, stale, cross-project, terminal, and archived draft operations', async () => {
    const projectId = await createProject(app, 'guards');
    const otherProjectId = await createProject(app, 'guards-other');
    const ownReference = await createDiscoveryFollowUp(app, projectId, 'Saját nyitott kérdés');
    const foreignReference = await createDiscoveryFollowUp(app, otherProjectId, 'Idegen kérdés');

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({ messageDraft: '   ', referencedFollowUpId: null, expectedVersion: 1 })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({ messageDraft: 'x'.repeat(10_001), referencedFollowUpId: null, expectedVersion: 1 })
      .expect(400);

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({ messageDraft: 'Megőrzendő saját piszkozat', referencedFollowUpId: null, expectedVersion: 1 })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({ messageDraft: 'Elavult felülírás', referencedFollowUpId: null, expectedVersion: 1 })
      .expect(409);
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({ messageDraft: 'Idegen hivatkozás', referencedFollowUpId: foreignReference.id, expectedVersion: 2 })
      .expect(409);

    const linked = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({ messageDraft: 'Aktuális hivatkozás', referencedFollowUpId: ownReference.id, expectedVersion: 2 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups/${ownReference.id}/resolve`)
      .send({ status: 'Megválaszolva', decisionOrAnswer: 'Az ügyfél lezárta.' })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/preview`)
      .send({ expectedVersion: linked.body.draftVersion })
      .expect(409);

    await request(app.getHttpServer()).post(`/projects/${projectId}/archive`).send({}).expect(201);
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({ messageDraft: 'Archivált módosítás', referencedFollowUpId: null, expectedVersion: 3 })
      .expect(409);
    const readable = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up`)
      .expect(200);
    assert.equal(readable.body.messageDraft, 'Aktuális hivatkozás');
    assert.equal(readable.body.referencedFollowUpId, ownReference.id);
  });

  it('allows only one active manual attempt for one preview token', async () => {
    const projectId = await createProject(app, 'single-flight');
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({ messageDraft: 'Egyszer küldhető üzenet', referencedFollowUpId: null, expectedVersion: 1 })
      .expect(200);
    const preview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/preview`)
      .send({ expectedVersion: 2 })
      .expect(201);

    let notifyStarted!: () => void;
    const started = new Promise<void>((resolve) => {
      notifyStarted = resolve;
    });
    deliveryStarted = notifyStarted;
    releaseDelivery = () => undefined;
    const first = request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: preview.body.previewToken })
      .then((response) => response);
    await started;

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: preview.body.previewToken })
      .expect(409);
    releaseDelivery?.();
    releaseDelivery = null;
    assert.equal((await first).status, 201);
    assert.equal(delivered.length, 1);
  });

  it('exposes a failed attempt after reload and retries it only by an explicit request', async () => {
    const projectId = await createProject(app, 'failed-retry');
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({ messageDraft: 'Kifejezetten újrapróbálható üzenet', referencedFollowUpId: null, expectedVersion: 1 })
      .expect(200);
    const preview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/preview`)
      .send({ expectedVersion: 2 })
      .expect(201);

    deliveryMode = 'FAILED';
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: preview.body.previewToken })
      .expect(503);

    const reloaded = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up`)
      .expect(200);
    assert.equal(reloaded.body.latestManualAttempt.state, 'FAILED');
    assert.equal(reloaded.body.latestManualAttempt.failureCode, 'SMTP_SEND_FAILED');
    assert.equal(reloaded.body.latestManualAttempt.draftVersion, 2);
    assert.equal(delivered.length, 0);
    assert.equal(submitted.length, 1);
    const firstReplyTo = submitted[0]?.replyToAddress;
    const identityBeforeRetry = await dataSource.query<Array<{
      outbound_communication_id: string;
      correspondence_id: string;
    }>>(
      `SELECT outbound_communication_id, correspondence_id
       FROM customer_follow_up_delivery_attempts WHERE id = $1`,
      [reloaded.body.latestManualAttempt.attemptId],
    );

    const settingsSaved = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up`)
      .send({ intervalMinutes: 2 })
      .expect(200);
    assert.equal(
      settingsSaved.body.latestManualAttempt.attemptId,
      reloaded.body.latestManualAttempt.attemptId,
    );
    assert.equal(settingsSaved.body.latestManualAttempt.state, 'FAILED');

    deliveryMode = 'SUCCESS';
    const retried = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/retry`)
      .send({
        attemptId: reloaded.body.latestManualAttempt.attemptId,
        acknowledgeDuplicateRisk: false,
      })
      .expect(201);
    assert.equal(retried.body.state, 'SENT');
    assert.equal(retried.body.attemptId, reloaded.body.latestManualAttempt.attemptId);
    assert.equal(delivered.length, 1);
    assert.equal(submitted.length, 2);
    assert.equal(submitted[1]?.replyToAddress, firstReplyTo);
    const identityAfterRetry = await dataSource.query<Array<{
      outbound_communication_id: string;
      correspondence_id: string;
    }>>(
      `SELECT outbound_communication_id, correspondence_id
       FROM customer_follow_up_delivery_attempts WHERE id = $1`,
      [reloaded.body.latestManualAttempt.attemptId],
    );
    assert.deepEqual(identityAfterRetry, identityBeforeRetry);
    const history = await dataSource.query<Array<{ outbound_count: string; correspondence_count: string; attempt_count: string }>>(
      `SELECT
        (SELECT COUNT(*)::text FROM customer_outbound_communications WHERE project_id = $1) AS outbound_count,
        (SELECT COUNT(*)::text FROM customer_correspondences WHERE project_id = $1) AS correspondence_count,
        (SELECT COUNT(*)::text FROM customer_outbound_attempts WHERE outbound_communication_id = $2) AS attempt_count`,
      [projectId, identityBeforeRetry[0]?.outbound_communication_id],
    );
    assert.deepEqual(history[0], {
      outbound_count: '1',
      correspondence_count: '1',
      attempt_count: '2',
    });
  });

  it('rejects a retry after the Customer contact email changes', async () => {
    const projectId = await createProject(app, 'changed-recipient-retry');
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({
        messageDraft: 'Csak az ellenőrzött címzettnek küldhető üzenet',
        referencedFollowUpId: null,
        expectedVersion: 1,
      })
      .expect(200);
    const preview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/preview`)
      .send({ expectedVersion: 2 })
      .expect(201);

    deliveryMode = 'FAILED';
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: preview.body.previewToken })
      .expect(503);
    const failed = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up`)
      .expect(200);

    await dataSource.query(
      'UPDATE projects SET customer_contact_email = $2 WHERE id = $1',
      [projectId, 'changed-retry-recipient@example.test'],
    );
    deliveryMode = 'SUCCESS';
    const retry = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/retry`)
      .send({ attemptId: failed.body.latestManualAttempt.attemptId })
      .expect(409);

    assert.equal(retry.body.code, 'FOLLOW_UP_RETRY_STALE');
    assert.equal(delivered.length, 0);
    assert.equal(submitted.length, 1);
    const unchanged = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up`)
      .expect(200);
    assert.equal(unchanged.body.latestManualAttempt.state, 'FAILED');
  });

  it('creates durable outbound identity when retrying a pre-0018 failed attempt', async () => {
    const projectId = await createProject(app, 'legacy-failed-retry');
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({ messageDraft: 'Migráció előtti sikertelen ping', referencedFollowUpId: null, expectedVersion: 1 })
      .expect(200);
    const projectRows = await dataSource.query<Array<{ customer_contact_email: string }>>(
      'SELECT customer_contact_email FROM projects WHERE id = $1',
      [projectId],
    );
    const attemptId = randomUUID();
    await dataSource.query(
      `INSERT INTO customer_follow_up_delivery_attempts (
         id, project_id, draft_version, referenced_follow_up_id,
         referenced_follow_up_version, state, recipient_email, subject_length,
         text_length, failure_code, attempted_at, sent_at
       ) VALUES ($1, $2, 2, NULL, NULL, 'FAILED', $3, 1, 1,
         'SMTP_SEND_FAILED', CURRENT_TIMESTAMP, NULL)`,
      [attemptId, projectId, projectRows[0]!.customer_contact_email],
    );

    const legacyState = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up`)
      .expect(200);
    assert.equal(legacyState.body.latestManualAttempt.state, 'FAILED');
    assert.equal(
      legacyState.body.latestManualAttempt.failureCode,
      'SMTP_SEND_FAILED',
    );

    const retried = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/retry`)
      .send({ attemptId, acknowledgeDuplicateRisk: false })
      .expect(201);

    assert.equal(retried.body.state, 'SENT');
    assert.equal(retried.body.attemptId, attemptId);
    const identity = await loadPingIdentity(dataSource, projectId);
    assert.ok(identity.outbound_communication_id);
    assert.ok(identity.correspondence_id);
    assert.match(identity.reply_to_address, /^project-maker\+[A-Za-z0-9_-]+@example\.test$/);
  });

  it('persists an uncertain result and requires acknowledgement on that exact retry request', async () => {
    const projectId = await createProject(app, 'unknown-retry');
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({ messageDraft: 'Bizonytalan kézbesítésű üzenet', referencedFollowUpId: null, expectedVersion: 1 })
      .expect(200);
    const preview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/preview`)
      .send({ expectedVersion: 2 })
      .expect(201);

    deliveryMode = 'UNKNOWN';
    const uncertain = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: preview.body.previewToken })
      .expect(503);
    assert.equal(uncertain.body.code, 'FOLLOW_UP_DELIVERY_UNKNOWN');

    const reloaded = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up`)
      .expect(200);
    assert.equal(reloaded.body.latestManualAttempt.state, 'UNKNOWN');
    assert.equal(reloaded.body.latestManualAttempt.failureCode, 'SMTP_DELIVERY_UNKNOWN');
    const unknownIdentity = await loadPingIdentity(dataSource, projectId);

    deliveryMode = 'SUCCESS';
    const blocked = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/retry`)
      .send({ attemptId: reloaded.body.latestManualAttempt.attemptId })
      .expect(409);
    assert.equal(blocked.body.code, 'FOLLOW_UP_DUPLICATE_RISK_ACKNOWLEDGEMENT_REQUIRED');
    assert.equal(delivered.length, 0);

    const retried = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/retry`)
      .send({
        attemptId: reloaded.body.latestManualAttempt.attemptId,
        acknowledgeDuplicateRisk: true,
      })
      .expect(201);
    assert.equal(retried.body.state, 'SENT');
    assert.equal(delivered.length, 1);
    const retriedIdentity = await loadPingIdentity(dataSource, projectId);
    assert.deepEqual(retriedIdentity, unknownIdentity);
    assert.equal(submitted[0]?.replyToAddress, unknownIdentity.reply_to_address);
    const outboundAttempts = await dataSource.query<Array<{ result: string }>>(
      `SELECT result FROM customer_outbound_attempts
       WHERE outbound_communication_id = $1 ORDER BY attempted_at ASC, id ASC`,
      [unknownIdentity.outbound_communication_id],
    );
    assert.deepEqual(outboundAttempts, [{ result: 'UNKNOWN' }, { result: 'ACCEPTED' }]);
  });

  it('creates new outbound and correspondence identities for a later logical ping delivery', async () => {
    const projectId = await createProject(app, 'later-delivery');
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({ messageDraft: 'Első logikai ping', referencedFollowUpId: null, expectedVersion: 1 })
      .expect(200);
    const firstPreview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/preview`)
      .send({ expectedVersion: 2 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: firstPreview.body.previewToken })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({ messageDraft: 'Második logikai ping', referencedFollowUpId: null, expectedVersion: 2 })
      .expect(200);
    const secondPreview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/preview`)
      .send({ expectedVersion: 3 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: secondPreview.body.previewToken })
      .expect(201);

    const identities = await dataSource.query<Array<{
      outbound_id: string;
      correspondence_id: string;
      reply_to_address: string;
    }>>(
      `SELECT outbound.id AS outbound_id, correspondence.id AS correspondence_id,
              outbound.reply_to_address
       FROM customer_outbound_communications outbound
       JOIN customer_correspondences correspondence
         ON correspondence.outbound_communication_id = outbound.id
       WHERE outbound.project_id = $1
       ORDER BY outbound.created_at ASC, outbound.id ASC`,
      [projectId],
    );
    assert.equal(identities.length, 2);
    assert.notEqual(identities[0]?.outbound_id, identities[1]?.outbound_id);
    assert.notEqual(identities[0]?.correspondence_id, identities[1]?.correspondence_id);
    assert.notEqual(identities[0]?.reply_to_address, identities[1]?.reply_to_address);
  });

  it('revalidates retry provenance and preserves project-level single flight', async () => {
    const staleProjectId = await createProject(app, 'stale-retry');
    await request(app.getHttpServer())
      .patch(`/projects/${staleProjectId}/follow-up/draft`)
      .send({ messageDraft: 'Első mentett változat', referencedFollowUpId: null, expectedVersion: 1 })
      .expect(200);
    const stalePreview = await request(app.getHttpServer())
      .post(`/projects/${staleProjectId}/follow-up/ping/preview`)
      .send({ expectedVersion: 2 })
      .expect(201);
    deliveryMode = 'FAILED';
    await request(app.getHttpServer())
      .post(`/projects/${staleProjectId}/follow-up/ping`)
      .send({ previewToken: stalePreview.body.previewToken })
      .expect(503);
    const staleState = await request(app.getHttpServer())
      .get(`/projects/${staleProjectId}/follow-up`)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/projects/${staleProjectId}/follow-up/draft`)
      .send({ messageDraft: 'Időközben módosított változat', referencedFollowUpId: null, expectedVersion: 2 })
      .expect(200);
    deliveryMode = 'SUCCESS';
    const staleRetry = await request(app.getHttpServer())
      .post(`/projects/${staleProjectId}/follow-up/ping/retry`)
      .send({ attemptId: staleState.body.latestManualAttempt.attemptId })
      .expect(409);
    assert.equal(staleRetry.body.code, 'FOLLOW_UP_RETRY_STALE');

    const projectId = await createProject(app, 'retry-single-flight');
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({ messageDraft: 'Csak egyszer induló retry', referencedFollowUpId: null, expectedVersion: 1 })
      .expect(200);
    const preview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/preview`)
      .send({ expectedVersion: 2 })
      .expect(201);
    deliveryMode = 'FAILED';
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: preview.body.previewToken })
      .expect(503);
    const current = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up`)
      .expect(200);

    let notifyStarted!: () => void;
    const started = new Promise<void>((resolve) => { notifyStarted = resolve; });
    deliveryStarted = notifyStarted;
    releaseDelivery = () => undefined;
    deliveryMode = 'SUCCESS';
    const first = request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/retry`)
      .send({ attemptId: current.body.latestManualAttempt.attemptId })
      .then((response) => response);
    await started;
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/retry`)
      .send({ attemptId: current.body.latestManualAttempt.attemptId })
      .expect(409);
    releaseDelivery?.();
    releaseDelivery = null;
    assert.equal((await first).status, 201);
    assert.equal(delivered.length, 1);
    assert.equal(submitted[0]?.senderName, 'Project Maker');
    assert.equal(submitted[0]?.senderAddress, 'project-maker@example.test');
    assert.match(submitted[0]?.replyToAddress ?? '', /^project-maker\+.+@example\.test$/);

    const archivedProjectId = await createProject(app, 'archived-retry');
    await request(app.getHttpServer())
      .patch(`/projects/${archivedProjectId}/follow-up/draft`)
      .send({ messageDraft: 'Archiválás előtt hibás küldés', referencedFollowUpId: null, expectedVersion: 1 })
      .expect(200);
    const archivedPreview = await request(app.getHttpServer())
      .post(`/projects/${archivedProjectId}/follow-up/ping/preview`)
      .send({ expectedVersion: 2 })
      .expect(201);
    deliveryMode = 'FAILED';
    await request(app.getHttpServer())
      .post(`/projects/${archivedProjectId}/follow-up/ping`)
      .send({ previewToken: archivedPreview.body.previewToken })
      .expect(503);
    const archivedState = await request(app.getHttpServer())
      .get(`/projects/${archivedProjectId}/follow-up`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/projects/${archivedProjectId}/archive`)
      .send({})
      .expect(201);
    deliveryMode = 'SUCCESS';
    await request(app.getHttpServer())
      .post(`/projects/${archivedProjectId}/follow-up/ping/retry`)
      .send({ attemptId: archivedState.body.latestManualAttempt.attemptId })
      .expect(409);
  });

  it('reconciles an expired delivery lease and requires explicit duplicate-risk acknowledgement', async () => {
    const projectId = await createProject(app, 'expired-delivery');
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({
        messageDraft: 'Ellenőrzött újraküldést igénylő üzenet',
        referencedFollowUpId: null,
        expectedVersion: 1,
      })
      .expect(200);
    const expiredAt = new Date(Date.now() - 16 * 60_000);
    await dataSource.query(
      `INSERT INTO customer_follow_up_delivery_attempts (
        id, project_id, draft_version, state, recipient_email,
        subject_length, text_length, failure_code, attempted_at
      ) VALUES ($1, $2, 2, 'SENDING', $3, $4, $5, NULL, $6)`,
      [
        randomUUID(),
        projectId,
        'expired-delivery@example.test',
        1,
        1,
        expiredAt,
      ],
    );
    const reconciledAfterReload = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up`)
      .expect(200);
    assert.equal(reconciledAfterReload.body.latestManualAttempt.state, 'UNKNOWN');
    const draftSaved = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({
        messageDraft: 'Az újabb draft sem kerülheti meg a kézbesítési ellenőrzést',
        referencedFollowUpId: null,
        expectedVersion: 2,
      })
      .expect(200);
    assert.equal(
      draftSaved.body.latestManualAttempt.attemptId,
      reconciledAfterReload.body.latestManualAttempt.attemptId,
    );
    assert.equal(draftSaved.body.latestManualAttempt.state, 'UNKNOWN');
    const preview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/preview`)
      .send({ expectedVersion: 3 })
      .expect(201);

    const blocked = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: preview.body.previewToken })
      .expect(409);
    assert.equal(blocked.body.code, 'FOLLOW_UP_DELIVERY_UNKNOWN');
    assert.equal(delivered.length, 0);
    const unknownActivity = await request(app.getHttpServer())
      .get(`/projects/${projectId}/activity`)
      .expect(200);
    assert.equal(
      unknownActivity.body.events.some(
        (event: { summary: string }) => event.summary ===
          'Az ügyfél-emlékeztető küldési eredménye bizonytalan; kézi ellenőrzés szükséges.',
      ),
      true,
    );

    const reconciled = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up`)
      .expect(200);
    assert.equal(reconciled.body.latestManualAttempt.state, 'UNKNOWN');
    const staleRetry = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/retry`)
      .send({
        attemptId: reconciled.body.latestManualAttempt.attemptId,
        acknowledgeDuplicateRisk: true,
      })
      .expect(409);
    assert.equal(staleRetry.body.code, 'FOLLOW_UP_RETRY_STALE');
    assert.equal(delivered.length, 0);

    const wrongAcknowledgement = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({
        previewToken: preview.body.previewToken,
        acknowledgeDuplicateRiskForAttemptId: randomUUID(),
      })
      .expect(409);
    assert.equal(wrongAcknowledgement.body.code, 'FOLLOW_UP_DELIVERY_UNKNOWN');
    assert.equal(delivered.length, 0);

    const freshSend = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({
        previewToken: preview.body.previewToken,
        acknowledgeDuplicateRiskForAttemptId:
          reconciled.body.latestManualAttempt.attemptId,
      })
      .expect(201);
    assert.equal(freshSend.body.state, 'SENT');
    assert.equal(delivered.length, 1);
  });

  it('describes draft, successful, and failed ping activity in employee language', async () => {
    const projectId = await createProject(app, 'activity');
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({
        messageDraft: 'Első ügyfél-ping',
        referencedFollowUpId: null,
        expectedVersion: 1,
      })
      .expect(200);
    const firstPreview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/preview`)
      .send({ expectedVersion: 2 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: firstPreview.body.previewToken })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({
        messageDraft: 'Második ügyfél-ping',
        referencedFollowUpId: null,
        expectedVersion: 2,
      })
      .expect(200);
    const failedPreview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/preview`)
      .send({ expectedVersion: 3 })
      .expect(201);
    deliveryMode = 'FAILED';
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: failedPreview.body.previewToken })
      .expect(503);
    deliveryMode = 'SUCCESS';

    const activity = await request(app.getHttpServer())
      .get(`/projects/${projectId}/activity`)
      .expect(200);
    assert.deepEqual(
      activity.body.events.map((event: { summary: string }) => event.summary),
      [
        'Az ügyfél-emlékeztető küldése sikertelen; újrapróbálható.',
        'Az ügyfél-emlékeztető piszkozata frissítve lett.',
        'Az ügyfél-emlékeztető elküldve az ügyfélnek.',
        'Az ügyfél-emlékeztető piszkozata frissítve lett.',
      ],
    );
  });

  it('rejects a preview after its recipient or referenced follow-up changes', async () => {
    const referencedProjectId = await createProject(app, 'stale-reference');
    const reference = await createDiscoveryFollowUp(
      app,
      referencedProjectId,
      'Melyik határidőt erősítsük meg?',
    );
    await request(app.getHttpServer())
      .patch(`/projects/${referencedProjectId}/follow-up/draft`)
      .send({
        messageDraft: 'Kérlek, erősítsd meg a kapcsolódó határidőt.',
        referencedFollowUpId: reference.id,
        expectedVersion: 1,
      })
      .expect(200);
    const referencePreview = await request(app.getHttpServer())
      .post(`/projects/${referencedProjectId}/follow-up/ping/preview`)
      .send({ expectedVersion: 2 })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/projects/${referencedProjectId}/discovery-follow-ups/${reference.id}`)
      .send({
        category: 'BUSINESS',
        question: 'Melyik módosított határidőt erősítsük meg?',
        owner: 'PO Péter',
        dueDate: '2026-09-16',
        nextStep: 'Az ügyfél pontosítja a módosított határidőt.',
        expectedVersion: 1,
      })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/projects/${referencedProjectId}/follow-up/ping`)
      .send({ previewToken: referencePreview.body.previewToken })
      .expect(409);

    const recipientProjectId = await createProject(app, 'stale-recipient');
    await request(app.getHttpServer())
      .patch(`/projects/${recipientProjectId}/follow-up/draft`)
      .send({
        messageDraft: 'Kérlek, válaszolj erre a rövid pontosításra.',
        referencedFollowUpId: null,
        expectedVersion: 1,
      })
      .expect(200);
    const recipientPreview = await request(app.getHttpServer())
      .post(`/projects/${recipientProjectId}/follow-up/ping/preview`)
      .send({ expectedVersion: 2 })
      .expect(201);
    await dataSource.query(
      'UPDATE projects SET customer_contact_email = $2 WHERE id = $1',
      [recipientProjectId, 'changed-recipient@example.test'],
    );
    await request(app.getHttpServer())
      .post(`/projects/${recipientProjectId}/follow-up/ping`)
      .send({ previewToken: recipientPreview.body.previewToken })
      .expect(409);

    assert.equal(delivered.length, 0);
  });

  it('pauses an automatic schedule after an uncertain submission until explicit recovery', async () => {
    const projectId = await createProject(app, 'scheduled-unknown');
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({
        messageDraft: 'Kérlek, erősítsd meg a még nyitott kérdést.',
        referencedFollowUpId: null,
        expectedVersion: 1,
      })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up`)
      .send({ enabled: true, intervalMinutes: 60 })
      .expect(200);

    const dueAt = new Date('2026-08-17T09:00:00.000Z');
    await dataSource.query(
      'UPDATE customer_follow_ups SET next_ping_at = $2 WHERE project_id = $1',
      [projectId, dueAt],
    );
    deliveryMode = 'UNKNOWN';

    await followUpService.processDuePings(dueAt);

    const paused = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up`)
      .expect(200);
    assert.equal(paused.body.enabled, true);
    assert.equal(paused.body.nextPingAt, null);
    assert.equal(paused.body.latestManualAttempt.state, 'UNKNOWN');
    assert.equal(paused.body.latestManualAttempt.draftVersion, 2);
    assert.equal(delivered.length, 0);

    deliveryMode = 'SUCCESS';
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/retry`)
      .send({
        attemptId: paused.body.latestManualAttempt.attemptId,
        acknowledgeDuplicateRisk: true,
      })
      .expect(201);
    const resumed = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up`)
      .expect(200);
    assert.equal(resumed.body.enabled, true);
    assert.notEqual(resumed.body.nextPingAt, null);
  });

  it('prevents a due schedule from bypassing an unresolved manual UNKNOWN attempt', async () => {
    const projectId = await createProject(app, 'manual-unknown-schedule');
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({
        messageDraft: 'Kérlek, erősítsd meg a még nyitott kérdést.',
        referencedFollowUpId: null,
        expectedVersion: 1,
      })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up`)
      .send({ enabled: true, intervalMinutes: 60 })
      .expect(200);
    const preview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/preview`)
      .send({ expectedVersion: 2 })
      .expect(201);

    deliveryMode = 'UNKNOWN';
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: preview.body.previewToken })
      .expect(503);

    const paused = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up`)
      .expect(200);
    assert.equal(paused.body.enabled, true);
    assert.equal(paused.body.nextPingAt, null);
    assert.equal(paused.body.latestManualAttempt.state, 'UNKNOWN');
    const unknownAttemptId = paused.body.latestManualAttempt.attemptId as string;

    const dueAt = new Date('2026-08-17T10:00:00.000Z');
    await dataSource.query(
      'UPDATE customer_follow_ups SET next_ping_at = $2 WHERE project_id = $1',
      [projectId, dueAt],
    );
    const processed = await followUpService.processDuePings(dueAt);
    assert.deepEqual(processed, []);
    const stillPaused = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up`)
      .expect(200);
    assert.equal(stillPaused.body.nextPingAt, null);
    assert.equal(stillPaused.body.latestManualAttempt.attemptId, unknownAttemptId);

    deliveryMode = 'SUCCESS';
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/retry`)
      .send({ attemptId: unknownAttemptId, acknowledgeDuplicateRisk: true })
      .expect(201);
    const resumed = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up`)
      .expect(200);
    assert.equal(resumed.body.enabled, true);
    assert.notEqual(resumed.body.nextPingAt, null);
  });

  it('pauses a stale scheduled reference before submission and resumes after a valid draft save', async () => {
    const projectId = await createProject(app, 'scheduled-reference-pause');
    const reference = await createDiscoveryFollowUp(
      app,
      projectId,
      'Melyik jóváhagyásra várunk?',
    );
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({
        messageDraft: 'Kérlek, jelezd a jóváhagyás állapotát.',
        referencedFollowUpId: reference.id,
        expectedVersion: 1,
      })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up`)
      .send({ enabled: true, intervalMinutes: 60 })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups/${reference.id}/resolve`)
      .send({ status: 'Megválaszolva', decisionOrAnswer: 'A jóváhagyás megérkezett.' })
      .expect(200);

    const dueAt = new Date('2026-08-17T11:00:00.000Z');
    await dataSource.query(
      'UPDATE customer_follow_ups SET next_ping_at = $2 WHERE project_id = $1',
      [projectId, dueAt],
    );
    await followUpService.processDuePings(dueAt);

    const paused = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up`)
      .expect(200);
    assert.equal(paused.body.enabled, true);
    assert.equal(paused.body.nextPingAt, null);
    assert.equal(paused.body.lastDeliveryStatus, 'NEVER');
    assert.equal(paused.body.lastDeliveryError, null);
    assert.equal(paused.body.latestManualAttempt, null);
    assert.equal(delivered.length, 0);

    const resumed = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({
        messageDraft: 'Kérlek, erősítsd meg a következő egyeztetés időpontját.',
        referencedFollowUpId: null,
        expectedVersion: 2,
      })
      .expect(200);
    assert.equal(resumed.body.enabled, true);
    assert.notEqual(resumed.body.nextPingAt, null);
  });

  it('claims one canonical scheduled ping across concurrent workers and advances from the controlled clock', async () => {
    const projectId = await createProject(app, 'scheduled-concurrency');
    const reference = await createDiscoveryFollowUp(
      app,
      projectId,
      'Melyik döntést kell megerősíteni?',
    );
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({
        messageDraft: 'Kérlek, erősítsd meg a döntést.',
        referencedFollowUpId: reference.id,
        expectedVersion: 1,
      })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up`)
      .send({ enabled: true, intervalMinutes: 60 })
      .expect(200);
    const dueAt = new Date('2026-08-17T12:00:00.000Z');
    await dataSource.query(
      'UPDATE customer_follow_ups SET next_ping_at = $2 WHERE project_id = $1',
      [projectId, dueAt],
    );
    let deliveryBegan!: () => void;
    const deliveryBeganPromise = new Promise<void>((resolve) => {
      deliveryBegan = resolve;
    });
    deliveryStarted = deliveryBegan;
    releaseDelivery = () => undefined;
    const projectChange = dataSource.createQueryRunner();
    await projectChange.connect();
    let firstWorker!: ReturnType<CustomerFollowUpService['processDuePings']>;
    try {
      await projectChange.startTransaction();
      await projectChange.query(
        'UPDATE projects SET customer_contact_email = $2 WHERE id = $1',
        [projectId, 'current-scheduled-recipient@example.test'],
      );
      firstWorker = followUpService.processDuePings(dueAt);
      await waitForProjectClaimLock(dataSource);
      await projectChange.commitTransaction();
    } finally {
      if (projectChange.isTransactionActive) {
        await projectChange.rollbackTransaction();
      }
      await projectChange.release();
    }
    await deliveryBeganPromise;

    const secondWorker = await followUpService.processDuePings(dueAt);
    assert.deepEqual(secondWorker, []);
    releaseDelivery?.();
    const firstResult = await firstWorker;

    assert.equal(firstResult.length, 1);
    assert.equal(firstResult[0].nextPingAt, '2026-08-17T13:00:00.000Z');
    assert.equal(delivered.length, 1);
    assert.equal(delivered[0].to, 'current-scheduled-recipient@example.test');
    assert.equal(submitted[0]?.senderName, 'Project Maker');
    assert.equal(submitted[0]?.senderAddress, 'project-maker@example.test');
    assert.match(submitted[0]?.replyToAddress ?? '', /^project-maker\+.+@example\.test$/);
    assert.match(delivered[0].text, /Kérlek, erősítsd meg a döntést\./);
    assert.match(delivered[0].text, /Kérdés: Melyik döntést kell megerősíteni\?/);
    assert.doesNotMatch(delivered[0].text, /\.md\b|Markdown|Claude Code|execution-plan revision/i);
    assert.equal(submitted[0]?.htmlContent, undefined);
    const attempts = await dataSource.query<Array<{ state: string }>>(
      'SELECT state FROM customer_follow_up_delivery_attempts WHERE project_id = $1',
      [projectId],
    );
    assert.deepEqual(attempts, [{ state: 'SENT' }]);
  });

  it('waits for the next cadence after a known scheduled rejection', async () => {
    const projectId = await createProject(app, 'scheduled-failed');
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up/draft`)
      .send({
        messageDraft: 'Kérlek, válaszolj a rövid emlékeztetőre.',
        referencedFollowUpId: null,
        expectedVersion: 1,
      })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up`)
      .send({ enabled: true, intervalMinutes: 90 })
      .expect(200);
    const dueAt = new Date('2026-08-17T14:00:00.000Z');
    await dataSource.query(
      'UPDATE customer_follow_ups SET next_ping_at = $2 WHERE project_id = $1',
      [projectId, dueAt],
    );
    deliveryMode = 'FAILED';

    await followUpService.processDuePings(dueAt);

    const state = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up`)
      .expect(200);
    assert.equal(state.body.enabled, true);
    assert.equal(state.body.nextPingAt, '2026-08-17T15:30:00.000Z');
    assert.equal(state.body.lastDeliveryStatus, 'FAILED');
    assert.equal(state.body.latestManualAttempt.state, 'FAILED');
    assert.equal(delivered.length, 0);
  });

  it('stops expired and archived schedules without creating a delivery attempt', async () => {
    const expiredProjectId = await createProject(app, 'scheduled-expired');
    const archivedProjectId = await createProject(app, 'scheduled-archived');
    for (const projectId of [expiredProjectId, archivedProjectId]) {
      await request(app.getHttpServer())
        .patch(`/projects/${projectId}/follow-up/draft`)
        .send({
          messageDraft: 'Kérlek, válaszolj az emlékeztetőre.',
          referencedFollowUpId: null,
          expectedVersion: 1,
        })
        .expect(200);
      await request(app.getHttpServer())
        .patch(`/projects/${projectId}/follow-up`)
        .send({ enabled: true, intervalMinutes: 60 })
        .expect(200);
    }
    await request(app.getHttpServer())
      .post(`/projects/${archivedProjectId}/archive`)
      .send({})
      .expect(201);
    const dueAt = new Date('2026-08-17T16:00:00.000Z');
    await dataSource.query(
      `UPDATE customer_follow_ups
       SET next_ping_at = $2::timestamptz,
           expires_at = CASE WHEN project_id = $1 THEN $2::timestamptz ELSE NULL END
       WHERE project_id = ANY($3::uuid[])`,
      [expiredProjectId, dueAt, [expiredProjectId, archivedProjectId]],
    );

    await followUpService.processDuePings(dueAt);

    for (const projectId of [expiredProjectId, archivedProjectId]) {
      const state = await request(app.getHttpServer())
        .get(`/projects/${projectId}/follow-up`)
        .expect(200);
      assert.equal(state.body.enabled, false);
      assert.equal(state.body.nextPingAt, null);
      assert.equal(state.body.latestManualAttempt, null);
    }
    assert.equal(delivered.length, 0);
  });
});

async function createProject(app: INestApplication, label: string): Promise<string> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await request(app.getHttpServer())
    .post('/projects')
    .send({
      name: `Customer ping ${label} ${suffix}`,
      customerContactName: 'Ügyfél Anna',
      customerContactEmail: `customer-ping-${suffix}@example.test`,
      internalOwnerName: 'PO Péter',
      nextActionOwnerRole: 'CUSTOMER_CONTACT',
    })
    .expect(201);
  return response.body.id as string;
}

async function loadPingIdentity(
  dataSource: DataSource,
  projectId: string,
): Promise<{
  readonly outbound_communication_id: string;
  readonly correspondence_id: string;
  readonly reply_to_address: string;
}> {
  const rows = await dataSource.query<Array<{
    outbound_communication_id: string;
    correspondence_id: string;
    reply_to_address: string;
  }>>(
    `SELECT attempt.outbound_communication_id, attempt.correspondence_id,
            outbound.reply_to_address
     FROM customer_follow_up_delivery_attempts attempt
     JOIN customer_outbound_communications outbound
       ON outbound.id = attempt.outbound_communication_id
     WHERE attempt.project_id = $1
     ORDER BY attempt.attempted_at DESC, attempt.id ASC
     LIMIT 1`,
    [projectId],
  );
  assert.equal(rows.length, 1);
  return rows[0]!;
}

async function createDiscoveryFollowUp(
  app: INestApplication,
  projectId: string,
  question: string,
): Promise<{ readonly id: string }> {
  const response = await request(app.getHttpServer())
    .post(`/projects/${projectId}/discovery-follow-ups`)
    .send({
      category: 'BUSINESS',
      question,
      owner: 'PO Péter',
      dueDate: '2026-09-15',
      nextStep: 'Az ügyfél pontosítja a szabályt.',
    })
    .expect(201);
  return response.body as { readonly id: string };
}

async function waitForProjectClaimLock(dataSource: DataSource): Promise<void> {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const waiting = await dataSource.query<Array<{ waiting: boolean }>>(
      `SELECT EXISTS (
         SELECT 1
         FROM pg_stat_activity
         WHERE datname = current_database()
           AND wait_event_type = 'Lock'
           AND query ILIKE '%project%'
       ) AS waiting`,
    );
    if (waiting[0]?.waiting) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error('Scheduled claim did not wait for the current project lock.');
}
