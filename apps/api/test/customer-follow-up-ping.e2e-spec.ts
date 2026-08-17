import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import {
  customerMailerToken,
  type CustomerMailerMessage,
} from '../src/mail-delivery/smtp-mailer.service';

describe('Customer follow-up ping draft and manual delivery', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const delivered: CustomerMailerMessage[] = [];
  let deliveryShouldFail = false;
  let deliveryStarted: (() => void) | null = null;
  let releaseDelivery: (() => void) | null = null;

  before(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(customerMailerToken)
      .useValue({
        isConfigured: () => true,
        send: async (message: CustomerMailerMessage) => {
          if (deliveryShouldFail) {
            throw new Error('Deliberate SMTP boundary failure.');
          }
          delivered.push(message);
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
        },
      })
      .compile();

    app = module.createNestApplication({ logger: false });
    await app.init();
    dataSource = app.get(DataSource);
  });

  beforeEach(() => {
    delivered.length = 0;
    deliveryShouldFail = false;
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
      .send({ expectedVersion: 2 })
      .expect(201);
    assert.match(preview.body.recipientName, /Ügyfél Anna/);
    assert.match(preview.body.recipientEmail, /@example\.test$/);
    assert.match(preview.body.subject, /^Pontosítás kérése — Customer ping preview-send/);
    assert.equal(preview.body.draftVersion, 2);
    assert.equal(preview.body.referencedFollowUpVersion, 1);
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
      .send({ previewToken: preview.body.previewToken })
      .expect(201);
    assert.equal(sent.body.state, 'SENT');
    assert.equal(sent.body.draftVersion, 2);
    assert.equal(delivered.length, 1);
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
    const preview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/preview`)
      .send({ expectedVersion: 2 })
      .expect(201);

    const expiredAt = new Date(Date.now() - 16 * 60_000);
    await dataSource.query(
      `INSERT INTO customer_follow_up_delivery_attempts (
        id, project_id, draft_version, state, recipient_email,
        subject_length, text_length, failure_code, attempted_at
      ) VALUES ($1, $2, 2, 'SENDING', $3, $4, $5, NULL, $6)`,
      [
        randomUUID(),
        projectId,
        preview.body.recipientEmail,
        preview.body.subject.length,
        preview.body.text.length,
        expiredAt,
      ],
    );

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
      unknownActivity.body.events[0]?.summary,
      'Az ügyfél-ping küldési eredménye bizonytalan; kézi ellenőrzés szükséges.',
    );

    const sent = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({
        previewToken: preview.body.previewToken,
        acknowledgeDuplicateRisk: true,
      })
      .expect(201);
    assert.equal(sent.body.state, 'SENT');
    assert.equal(delivered.length, 1);

    const nextPreview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping/preview`)
      .send({ expectedVersion: 2 })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: nextPreview.body.previewToken })
      .expect(201);
    assert.equal(delivered.length, 2);
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
    deliveryShouldFail = true;
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/follow-up/ping`)
      .send({ previewToken: failedPreview.body.previewToken })
      .expect(503);
    deliveryShouldFail = false;

    const activity = await request(app.getHttpServer())
      .get(`/projects/${projectId}/activity`)
      .expect(200);
    assert.deepEqual(
      activity.body.events.map((event: { summary: string }) => event.summary),
      [
        'Az ügyfél-ping küldése sikertelen; újrapróbálható.',
        'Az ügyfél-ping piszkozata frissítve lett.',
        'Az ügyfél-ping elküldve az ügyfélnek.',
        'Az ügyfél-ping piszkozata frissítve lett.',
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
