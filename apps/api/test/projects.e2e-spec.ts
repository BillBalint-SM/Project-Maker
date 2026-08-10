import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';

describe('ProjectsController (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  before(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
  });

  after(async () => {
    await app.close();
  });

  it('creates a draft project and returns it from the list and cockpit', async () => {
    const projectId = await createProject('create');

    const response = await request(app.getHttpServer())
      .get(`/projects/${projectId}/cockpit`)
      .expect(200);
    if (response.body.projectId !== projectId || response.body.status !== 'DRAFT') {
      throw new Error('cockpit response did not identify the created draft project');
    }

    const listResponse = await request(app.getHttpServer()).get('/projects').expect(200);
    if (!listResponse.body.some((project: { id: string }) => project.id === projectId)) {
      throw new Error('created project was not returned by GET /projects');
    }
  });

  it('creates a project with the expected workspace and contact values', async () => {
    const response = await request(app.getHttpServer())
      .post('/projects')
      .send({
        name: `R1 project create-values ${Date.now()}`,
        customerContactName: 'Ada Lovelace',
        customerContactEmail: 'ada@example.test',
        ballOwner: 'Grace Hopper',
        nextAction: 'Confirm scope',
        dueAt: '2026-08-20T12:00:00.000Z',
      })
      .expect(201);

    assertProjectResponse(response.body, 'DRAFT');
    if (response.body.dueAt !== '2026-08-20T12:00:00.000Z') {
      throw new Error('created project did not preserve the UTC dueAt value');
    }
  });

  it('updates workspace fields, archives, and restores to DRAFT', async () => {
    const projectId = await createProject('archive-flow');
    const workspaceResponse = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/workspace`)
      .send({
        ballOwner: 'Katherine Johnson',
        nextAction: null,
        dueAt: null,
        status: 'WAITING_INTERNAL',
      })
      .expect(200);
    assertProjectResponse(workspaceResponse.body, 'WAITING_INTERNAL');

    const archivedResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/archive`)
      .expect(201);
    assertProjectResponse(archivedResponse.body, 'ARCHIVED');

    const restoredResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/restore`)
      .expect(201);
    assertProjectResponse(restoredResponse.body, 'DRAFT');

    const auditEvents = await dataSource.query<
      Array<{ event_type: string; payload: Record<string, unknown> }>
    >(
      'SELECT "event_type", "payload" FROM "audit_events" WHERE "project_id" = $1 ORDER BY "created_at" ASC',
      [projectId],
    );
    assert.deepEqual(auditEvents, [
      {
        event_type: 'PROJECT_ARCHIVED',
        payload: { fromStatus: 'WAITING_INTERNAL', toStatus: 'ARCHIVED' },
      },
      {
        event_type: 'PROJECT_RESTORED',
        payload: { fromStatus: 'ARCHIVED', toStatus: 'DRAFT' },
      },
    ]);
    assert.doesNotMatch(JSON.stringify(auditEvents), /Ada Lovelace|ada@example\.test/);
  });

  it('rejects invalid email, dueAt, and status without echoing submitted values', async () => {
    const projectId = await createProject('validation');
    const invalidCreateResponse = await request(app.getHttpServer())
      .post('/projects')
      .send({
        name: 'Invalid project',
        customerContactName: 'Private Contact',
        customerContactEmail: 'private-secret-value',
        dueAt: '2026-08-20T12:00:00.000Z',
      })
      .expect(400);
    assertNoSubmittedValues(invalidCreateResponse.body, 'private-secret-value');

    const invalidWorkspaceResponse = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/workspace`)
      .send({ dueAt: 'not-a-utc-date', status: 'NOT_A_STATUS' })
      .expect(400);
    assertNoSubmittedValues(invalidWorkspaceResponse.body, 'not-a-utc-date');
    assertNoSubmittedValues(invalidWorkspaceResponse.body, 'NOT_A_STATUS');
  });

  it('returns an unsaved default follow-up state and persists only after PATCH', async () => {
    const projectId = await createProject('follow-up-read-only');

    const getResponse = await request(app.getHttpServer())
      .get(`/projects/${projectId}/follow-up`)
      .expect(200);
    assert.deepEqual(getResponse.body, {
      projectId,
      enabled: false,
      intervalMinutes: 10_080,
      expiresAt: null,
      lastPingAt: null,
      nextPingAt: null,
      lastDeliveryStatus: 'NEVER',
      lastDeliveryError: null,
    });

    const beforePatch = await dataSource.query<Array<{ count: string }>>(
      'SELECT COUNT(*)::text AS "count" FROM "customer_follow_ups" WHERE "project_id" = $1',
      [projectId],
    );
    assert.equal(beforePatch[0]?.count, '0');

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/follow-up`)
      .send({ enabled: false, intervalMinutes: 10_080, expiresAt: null })
      .expect(200);

    const afterPatch = await dataSource.query<Array<{ count: string }>>(
      'SELECT COUNT(*)::text AS "count" FROM "customer_follow_ups" WHERE "project_id" = $1',
      [projectId],
    );
    assert.equal(afterPatch[0]?.count, '1');
  });

  it('lists no discovery follow-ups for an existing project without writing a row', async () => {
    const projectId = await createProject('discovery-follow-ups-empty');

    const response = await request(app.getHttpServer())
      .get(`/projects/${projectId}/discovery-follow-ups`)
      .expect(200);

    assert.deepEqual(response.body, []);
    const rows = await dataSource.query<Array<{ count: string }>>(
      'SELECT COUNT(*)::text AS "count" FROM "discovery_follow_ups" WHERE "project_id" = $1',
      [projectId],
    );
    assert.equal(rows[0]?.count, '0');
  });

  it('returns 404 when listing discovery follow-ups for a missing project', async () => {
    await request(app.getHttpServer())
      .get('/projects/00000000-0000-4000-8000-000000000000/discovery-follow-ups')
      .expect(404);
  });

  it('creates discovery follow-ups with the canonical initial status and deterministic list order', async () => {
    const projectId = await createProject('discovery-follow-up-create');

    const later = await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups`)
      .send({
        category: 'TECHNICAL',
        question: '  Which API version is supported?  ',
        owner: '  API team  ',
        dueDate: '2026-09-17',
        nextStep: '  Confirm against the vendor contract.  ',
      })
      .expect(201);
    const earlier = await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups`)
      .send({
        category: 'BUSINESS',
        question: 'What approval is required?',
        owner: 'Product owner',
        dueDate: '2026-09-16',
        nextStep: 'Book an approval decision.',
      })
      .expect(201);

    assert.equal(later.body.status, 'Nyitott');
    assert.equal(later.body.question, 'Which API version is supported?');
    assert.equal(later.body.owner, 'API team');
    assert.equal(later.body.nextStep, 'Confirm against the vendor contract.');
    assert.equal(later.body.dueDate, '2026-09-17');
    assert.equal(later.body.decisionOrAnswer, null);
    assert.equal(later.body.version, 1);
    assert.equal(earlier.body.version, 1);

    const list = await request(app.getHttpServer())
      .get(`/projects/${projectId}/discovery-follow-ups`)
      .expect(200);
    assert.deepEqual(
      list.body.map((value: { id: string; dueDate: string }) => ({
        id: value.id,
        dueDate: value.dueDate,
      })),
      [
        { id: earlier.body.id, dueDate: '2026-09-16' },
        { id: later.body.id, dueDate: '2026-09-17' },
      ],
    );
    const reloadedLater = list.body.find(
      (value: { id: string }) => value.id === later.body.id,
    ) as { decisionOrAnswer: string | null; version: number } | undefined;
    if (!reloadedLater) {
      throw new Error('created discovery follow-up was not returned after reload');
    }
    assert.equal(reloadedLater.decisionOrAnswer, null);
    assert.equal(reloadedLater.version, 1);

    const auditRows = await dataSource.query<
      Array<{ event_type: string; payload: Record<string, unknown> }>
    >(
      'SELECT "event_type", "payload" FROM "audit_events" WHERE "project_id" = $1 AND "event_type" = $2 ORDER BY "created_at" ASC, "id" ASC',
      [projectId, 'DISCOVERY_FOLLOW_UP_CREATED'],
    );
    assert.deepEqual(auditRows, [
      {
        event_type: 'DISCOVERY_FOLLOW_UP_CREATED',
        payload: {
          followUpId: later.body.id,
          category: 'TECHNICAL',
          dueDate: '2026-09-17',
          status: 'Nyitott',
        },
      },
      {
        event_type: 'DISCOVERY_FOLLOW_UP_CREATED',
        payload: {
          followUpId: earlier.body.id,
          category: 'BUSINESS',
          dueDate: '2026-09-16',
          status: 'Nyitott',
        },
      },
    ]);
    assert.doesNotMatch(JSON.stringify(auditRows), /API team|vendor contract|approval decision/);
  });

  it('edits an open discovery follow-up with normalization, fixed-order audit data, and a safe no-op', async () => {
    const projectId = await createProject('discovery-follow-up-edit');
    const created = await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups`)
      .send({
        category: 'BUSINESS',
        question: 'Which API version is supported?',
        owner: 'API team',
        dueDate: '2026-09-17',
        nextStep: 'Confirm against the vendor contract.',
      })
      .expect(201);

    const edited = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/discovery-follow-ups/${created.body.id}`)
      .send({
        category: 'TECHNICAL',
        question: '  Which API version is supported now?  ',
        owner: '  Platform team  ',
        dueDate: '2026-09-15',
        nextStep: '  Confirm the supported version.  ',
        expectedVersion: created.body.version,
      })
      .expect(200);

    assert.equal(edited.body.category, 'TECHNICAL');
    assert.equal(edited.body.question, 'Which API version is supported now?');
    assert.equal(edited.body.owner, 'Platform team');
    assert.equal(edited.body.dueDate, '2026-09-15');
    assert.equal(edited.body.nextStep, 'Confirm the supported version.');
    assert.equal(edited.body.status, 'Nyitott');
    assert.equal(edited.body.decisionOrAnswer, null);
    assert.equal(edited.body.version, created.body.version + 1);

    const list = await request(app.getHttpServer())
      .get(`/projects/${projectId}/discovery-follow-ups`)
      .expect(200);
    const reloaded = list.body.find(
      (value: { id: string }) => value.id === created.body.id,
    ) as
      | {
          category: string;
          question: string;
          owner: string;
          dueDate: string;
          nextStep: string;
          version: number;
        }
      | undefined;
    if (!reloaded) {
      throw new Error('edited discovery follow-up was not returned after reload');
    }
    assert.deepEqual(
      {
        category: reloaded.category,
        question: reloaded.question,
        owner: reloaded.owner,
        dueDate: reloaded.dueDate,
        nextStep: reloaded.nextStep,
        version: reloaded.version,
      },
      {
        category: 'TECHNICAL',
        question: 'Which API version is supported now?',
        owner: 'Platform team',
        dueDate: '2026-09-15',
        nextStep: 'Confirm the supported version.',
        version: edited.body.version,
      },
    );

    const updateAuditRows = await dataSource.query<
      Array<{ event_type: string; payload: Record<string, unknown> }>
    >(
      'SELECT "event_type", "payload" FROM "audit_events" WHERE "project_id" = $1 AND "event_type" = $2 ORDER BY "created_at" ASC, "id" ASC',
      [projectId, 'DISCOVERY_FOLLOW_UP_UPDATED'],
    );
    assert.deepEqual(updateAuditRows, [
      {
        event_type: 'DISCOVERY_FOLLOW_UP_UPDATED',
        payload: {
          followUpId: created.body.id,
          changedFields: 'category,question,owner,dueDate,nextStep',
        },
      },
    ]);
    for (const submittedValue of [
      'Which API version is supported?',
      'Which API version is supported now?',
      'API team',
      'Platform team',
      'Confirm against the vendor contract.',
      'Confirm the supported version.',
      'decisionOrAnswer',
      'expectedVersion',
      'version',
    ]) {
      assertNoSubmittedValues(updateAuditRows, submittedValue);
    }

    const noOp = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/discovery-follow-ups/${created.body.id}`)
      .send({
        category: 'TECHNICAL',
        question: '  Which API version is supported now?  ',
        owner: ' Platform team ',
        dueDate: '2026-09-15',
        nextStep: ' Confirm the supported version. ',
        expectedVersion: edited.body.version,
      })
      .expect(200);
    assert.equal(noOp.body.version, edited.body.version);
    assert.equal(await countDiscoveryFollowUpUpdateAudit(projectId), 1);
  });

  it('rejects invalid discovery follow-up edits without echoing submitted values', async () => {
    const projectId = await createProject('discovery-follow-up-edit-validation');
    const tooLongQuestion = 'E'.repeat(10_001);
    const tooLongOwner = 'R'.repeat(256);
    const tooLongNextStep = 'T'.repeat(10_001);
    const invalidBodies: ReadonlyArray<{
      readonly body: Record<string, unknown>;
      readonly forbidden: readonly string[];
      readonly messageOnlyForbidden?: readonly string[];
      readonly rejectedFields?: readonly string[];
    }> = [
      {
        body: {
          category: 'BUSINESS',
          question: 'missing-version-question-sentinel',
          owner: 'Owner',
          dueDate: '2026-09-16',
          nextStep: 'Next',
        },
        forbidden: ['missing-version-question-sentinel'],
        rejectedFields: ['expectedVersion'],
      },
      {
        body: discoveryFollowUpUpdateBody(0, 'zero-version-sentinel'),
        forbidden: ['zero-version-sentinel'],
        messageOnlyForbidden: ['0'],
        rejectedFields: ['expectedVersion'],
      },
      {
        body: discoveryFollowUpUpdateBody(1.5, 'fractional-version-sentinel'),
        forbidden: ['fractional-version-sentinel', '1.5'],
        rejectedFields: ['expectedVersion'],
      },
      {
        body: {
          ...discoveryFollowUpUpdateBody(1, 'extra-status-sentinel'),
          status: 'unexpected-status-value-sentinel',
        },
        forbidden: ['extra-status-sentinel', 'unexpected-status-value-sentinel'],
        rejectedFields: ['status'],
      },
      {
        body: {
          ...discoveryFollowUpUpdateBody(1, 'extra-answer-sentinel'),
          decisionOrAnswer: 'unexpected-answer-value-sentinel',
        },
        forbidden: ['extra-answer-sentinel', 'unexpected-answer-value-sentinel'],
        rejectedFields: ['decisionOrAnswer'],
      },
      {
        body: {
          ...discoveryFollowUpUpdateBody(1, 'extra-project-sentinel'),
          projectId: 'unexpected-project-value-sentinel',
        },
        forbidden: ['extra-project-sentinel', 'unexpected-project-value-sentinel'],
        rejectedFields: ['projectId'],
      },
      {
        body: {
          ...discoveryFollowUpUpdateBody(1, 'extra-source-sentinel'),
          sourceChecklistItemId: 'unexpected-source-value-sentinel',
        },
        forbidden: ['extra-source-sentinel', 'unexpected-source-value-sentinel'],
        rejectedFields: ['sourceChecklistItemId'],
      },
      {
        body: {
          ...discoveryFollowUpUpdateBody(1, 'unknown-category-sentinel'),
          category: 'NOT_A_CATEGORY',
        },
        forbidden: ['unknown-category-sentinel', 'NOT_A_CATEGORY'],
        rejectedFields: ['category'],
      },
      {
        body: {
          ...discoveryFollowUpUpdateBody(1, 'blank-question-sentinel'),
          question: '   ',
        },
        forbidden: ['blank-question-sentinel'],
        rejectedFields: ['question'],
      },
      {
        body: {
          ...discoveryFollowUpUpdateBody(1, 'blank-owner-sentinel'),
          owner: '   ',
        },
        forbidden: ['blank-owner-sentinel'],
        rejectedFields: ['owner'],
      },
      {
        body: {
          ...discoveryFollowUpUpdateBody(1, 'blank-next-step-sentinel'),
          nextStep: '   ',
        },
        forbidden: ['blank-next-step-sentinel'],
        rejectedFields: ['nextStep'],
      },
      {
        body: {
          ...discoveryFollowUpUpdateBody(1, 'long-question-sentinel'),
          question: tooLongQuestion,
        },
        forbidden: ['long-question-sentinel', tooLongQuestion],
        rejectedFields: ['question'],
      },
      {
        body: {
          ...discoveryFollowUpUpdateBody(1, 'long-owner-sentinel'),
          owner: tooLongOwner,
        },
        forbidden: ['long-owner-sentinel', tooLongOwner],
        rejectedFields: ['owner'],
      },
      {
        body: {
          ...discoveryFollowUpUpdateBody(1, 'long-next-step-sentinel'),
          nextStep: tooLongNextStep,
        },
        forbidden: ['long-next-step-sentinel', tooLongNextStep],
        rejectedFields: ['nextStep'],
      },
      {
        body: {
          ...discoveryFollowUpUpdateBody(1, 'impossible-date-sentinel'),
          dueDate: '2026-02-30',
        },
        forbidden: ['impossible-date-sentinel', '2026-02-30'],
        rejectedFields: ['dueDate'],
      },
    ];

    for (const [index, invalid] of invalidBodies.entries()) {
      const followUp = await createDiscoveryFollowUp(
        projectId,
        `edit-invalid-${index}`,
      );
      const response = await request(app.getHttpServer())
        .patch(`/projects/${projectId}/discovery-follow-ups/${followUp.id}`)
        .send(invalid.body)
        .expect(400);
      for (const value of invalid.forbidden) {
        assertNoSubmittedValues(response.body, value);
      }
      for (const value of invalid.messageOnlyForbidden ?? []) {
        assertNoSubmittedValues(response.body.message, value);
      }
      for (const field of invalid.rejectedFields ?? []) {
        assert.equal(response.body.fields.includes(field), true);
      }
    }
  });

  it('returns 400 for malformed edit ids and 404 for missing or mismatched edit resources', async () => {
    const projectId = await createProject('discovery-follow-up-edit-missing');
    const otherProjectId = await createProject('discovery-follow-up-edit-other-project');
    const otherFollowUp = await createDiscoveryFollowUp(
      otherProjectId,
      'edit-other-project',
    );
    const validBody = discoveryFollowUpUpdateBody(1, 'edit-missing-resource');
    const malformedFollowUpId = 'not-an-edit-follow-up-uuid';

    const malformedResponse = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/discovery-follow-ups/${malformedFollowUpId}`)
      .send(validBody)
      .expect(400);
    assertNoSubmittedValues(malformedResponse.body, malformedFollowUpId);

    await request(app.getHttpServer())
      .patch(
        '/projects/00000000-0000-4000-8000-000000000000/discovery-follow-ups/00000000-0000-4000-8000-000000000000',
      )
      .send(validBody)
      .expect(404);
    await request(app.getHttpServer())
      .patch(
        `/projects/${projectId}/discovery-follow-ups/00000000-0000-4000-8000-000000000000`,
      )
      .send(validBody)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/discovery-follow-ups/${otherFollowUp.id}`)
      .send(validBody)
      .expect(404);
  });

  it('rejects editing while archived and permits a matching-version edit after restore', async () => {
    const projectId = await createProject('discovery-follow-up-edit-archive');
    const followUp = await createDiscoveryFollowUp(projectId, 'edit-archive');
    const updateBody = discoveryFollowUpUpdateBody(
      followUp.version,
      'edit-after-restore',
    );

    await request(app.getHttpServer()).post(`/projects/${projectId}/archive`).expect(201);
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/discovery-follow-ups/${followUp.id}`)
      .send(updateBody)
      .expect(409);
    await request(app.getHttpServer()).post(`/projects/${projectId}/restore`).expect(201);
    const edited = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/discovery-follow-ups/${followUp.id}`)
      .send(updateBody)
      .expect(200);

    assert.equal(edited.body.question, 'Question for edit-after-restore');
    assert.equal(edited.body.version, followUp.version + 1);
    assert.equal(await countDiscoveryFollowUpUpdateAudit(projectId), 1);
  });

  it('rejects editing a resolved discovery follow-up without an update audit', async () => {
    const projectId = await createProject('discovery-follow-up-edit-resolved');
    const followUp = await createDiscoveryFollowUp(projectId, 'edit-resolved');
    const resolved = await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups/${followUp.id}/resolve`)
      .send({
        status: 'Megválaszolva',
        decisionOrAnswer: 'Terminal answer retained after rejected edit.',
      })
      .expect(200);

    const response = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/discovery-follow-ups/${followUp.id}`)
      .send(discoveryFollowUpUpdateBody(resolved.body.version, 'edit-resolved-rejected'))
      .expect(409);
    assert.equal(response.body.message, 'Discovery follow-up is not open.');
    assert.equal(await countDiscoveryFollowUpUpdateAudit(projectId), 0);
  });

  it('rejects a stale edit without overwriting the first update or duplicating its audit', async () => {
    const projectId = await createProject('discovery-follow-up-edit-stale');
    const followUp = await createDiscoveryFollowUp(projectId, 'edit-stale');
    const firstBody = discoveryFollowUpUpdateBody(followUp.version, 'first-stale-edit');
    const secondBody = discoveryFollowUpUpdateBody(followUp.version, 'second-stale-edit');

    const first = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/discovery-follow-ups/${followUp.id}`)
      .send(firstBody)
      .expect(200);
    const stale = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/discovery-follow-ups/${followUp.id}`)
      .send(secondBody)
      .expect(409);

    assert.equal(first.body.question, 'Question for first-stale-edit');
    assert.equal(stale.body.message, 'Discovery follow-up has changed.');
    const list = await request(app.getHttpServer())
      .get(`/projects/${projectId}/discovery-follow-ups`)
      .expect(200);
    const reloaded = list.body.find(
      (value: { id: string }) => value.id === followUp.id,
    ) as { question: string; version: number } | undefined;
    assert.equal(reloaded?.question, 'Question for first-stale-edit');
    assert.equal(reloaded?.version, followUp.version + 1);
    assert.equal(await countDiscoveryFollowUpUpdateAudit(projectId), 1);
  });

  it('prioritizes terminal state over a stale edit and retains the resolution', async () => {
    const projectId = await createProject('discovery-follow-up-edit-terminal-stale');
    const followUp = await createDiscoveryFollowUp(projectId, 'edit-terminal-stale');
    const terminalAnswer = 'Resolved answer must survive a stale edit.';
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups/${followUp.id}/resolve`)
      .send({ status: 'Megválaszolva', decisionOrAnswer: terminalAnswer })
      .expect(200);

    const response = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/discovery-follow-ups/${followUp.id}`)
      .send(
        discoveryFollowUpUpdateBody(
          followUp.version,
          'terminal-stale-edit-rejected',
        ),
      )
      .expect(409);
    assert.equal(response.body.message, 'Discovery follow-up is not open.');

    const list = await request(app.getHttpServer())
      .get(`/projects/${projectId}/discovery-follow-ups`)
      .expect(200);
    const reloaded = list.body.find(
      (value: { id: string }) => value.id === followUp.id,
    ) as
      | { status: string; decisionOrAnswer: string | null; version: number }
      | undefined;
    assert.equal(reloaded?.status, 'Megválaszolva');
    assert.equal(reloaded?.decisionOrAnswer, terminalAnswer);
    assert.equal(reloaded?.version, followUp.version + 1);
    assert.equal(await countDiscoveryFollowUpUpdateAudit(projectId), 0);
  });

  it('resolves discovery follow-ups with a persisted answer and a redacted audit event', async () => {
    const projectId = await createProject('discovery-follow-up-resolve');
    const created = await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups`)
      .send({
        category: 'BUSINESS',
        question: 'Which sponsor decision is required?',
        owner: 'Programme sponsor',
        dueDate: '2026-09-22',
        nextStep: 'Record the sponsor decision.',
      })
      .expect(201);

    const resolutionResponse = await request(app.getHttpServer())
      .post(
        '/projects/' +
          projectId +
          '/discovery-follow-ups/' +
          created.body.id +
          '/resolve',
      )
      .send({
        status: 'Megválaszolva',
        decisionOrAnswer: '  Sponsor approval is recorded in CAB-42.  ',
      })
      .expect(200);

    assert.equal(resolutionResponse.body.status, 'Megválaszolva');
    assert.equal(
      resolutionResponse.body.decisionOrAnswer,
      'Sponsor approval is recorded in CAB-42.',
    );
    assert.equal(resolutionResponse.body.version, 2);

    const reloaded = await request(app.getHttpServer())
      .get(`/projects/${projectId}/discovery-follow-ups`)
      .expect(200);
    const reloadedFollowUp = reloaded.body.find(
      (value: { id: string }) => value.id === created.body.id,
    ) as { status: string; decisionOrAnswer: string | null } | undefined;
    if (!reloadedFollowUp) {
      throw new Error('resolved discovery follow-up was not returned after reload');
    }
    assert.equal(reloadedFollowUp.status, 'Megválaszolva');
    assert.equal(
      reloadedFollowUp.decisionOrAnswer,
      'Sponsor approval is recorded in CAB-42.',
    );

    const resolutionAuditRows = await dataSource.query<
      Array<{ event_type: string; payload: Record<string, unknown> }>
    >(
      'SELECT "event_type", "payload" FROM "audit_events" WHERE "project_id" = $1 AND "event_type" = $2 ORDER BY "created_at" ASC, "id" ASC',
      [projectId, 'DISCOVERY_FOLLOW_UP_RESOLVED'],
    );
    assert.deepEqual(resolutionAuditRows, [
      {
        event_type: 'DISCOVERY_FOLLOW_UP_RESOLVED',
        payload: {
          followUpId: created.body.id,
          status: 'Megválaszolva',
        },
      },
    ]);
    assert.doesNotMatch(
      JSON.stringify(resolutionAuditRows),
      /Sponsor approval|CAB-42|Which sponsor decision|Programme sponsor|Record the sponsor decision/,
    );

    const second = await createDiscoveryFollowUp(projectId, 'resolve-nem-relevans');
    const secondResolution = await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups/${second.id}/resolve`)
      .send({
        status: 'Nem releváns',
        decisionOrAnswer: 'This dependency does not apply to the delivery scope.',
      })
      .expect(200);
    assert.equal(secondResolution.body.status, 'Nem releváns');
  });

  it('rejects invalid discovery follow-up resolution input without echoing submitted values', async () => {
    const projectId = await createProject('discovery-follow-up-resolution-validation');
    const tooLongAnswer = 'A'.repeat(10_001);
    const invalidBodies: ReadonlyArray<{
      readonly body: Record<string, string>;
      readonly forbidden: readonly string[];
    }> = [
      {
        body: { status: 'Folyamatban', decisionOrAnswer: 'invalid-status-sentinel' },
        forbidden: ['Folyamatban', 'invalid-status-sentinel'],
      },
      {
        body: { status: 'Megválaszolva', decisionOrAnswer: '   ' },
        forbidden: ['Megválaszolva'],
      },
      {
        body: { status: 'Megválaszolva', decisionOrAnswer: tooLongAnswer },
        forbidden: [tooLongAnswer],
      },
      {
        body: { decisionOrAnswer: 'missing-status-sentinel' },
        forbidden: ['missing-status-sentinel'],
      },
      {
        body: { status: 'Megválaszolva' },
        forbidden: ['Megválaszolva'],
      },
      {
        body: {
          status: 'Megválaszolva',
          decisionOrAnswer: 'unexpected-answer-sentinel',
          ignored: 'unexpected-field-sentinel',
        },
        forbidden: ['unexpected-answer-sentinel', 'unexpected-field-sentinel'],
      },
    ];

    for (const [index, { body, forbidden }] of invalidBodies.entries()) {
      const followUp = await createDiscoveryFollowUp(projectId, `resolution-invalid-${index}`);
      const response = await request(app.getHttpServer())
        .post(`/projects/${projectId}/discovery-follow-ups/${followUp.id}/resolve`)
        .send(body)
        .expect(400);
      for (const value of forbidden) {
        assertNoSubmittedValues(response.body, value);
      }
    }
  });

  it('returns 400 for malformed resolution ids and 404 for missing resolution resources', async () => {
    const projectId = await createProject('discovery-follow-up-resolution-missing');
    const validRequest = {
      status: 'Megválaszolva',
      decisionOrAnswer: 'The missing resource test uses a valid resolution body.',
    };

    const invalidFollowUpId = 'not-a-follow-up-uuid';
    const invalidResponse = await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups/${invalidFollowUpId}/resolve`)
      .send(validRequest)
      .expect(400);
    assertNoSubmittedValues(invalidResponse.body, invalidFollowUpId);

    await request(app.getHttpServer())
      .post(
        `/projects/${projectId}/discovery-follow-ups/00000000-0000-4000-8000-000000000000/resolve`,
      )
      .send(validRequest)
      .expect(404);

    await request(app.getHttpServer())
      .post(
        '/projects/00000000-0000-4000-8000-000000000000/discovery-follow-ups/00000000-0000-4000-8000-000000000000/resolve',
      )
      .send(validRequest)
      .expect(404);
  });

  it('rejects resolution while archived and permits it after restoration', async () => {
    const projectId = await createProject('discovery-follow-up-resolution-archive');
    const followUp = await createDiscoveryFollowUp(projectId, 'resolution-archive');
    const resolutionBody = {
      status: 'Megválaszolva',
      decisionOrAnswer: 'The archived project was restored before resolution.',
    };

    await request(app.getHttpServer()).post(`/projects/${projectId}/archive`).expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups/${followUp.id}/resolve`)
      .send(resolutionBody)
      .expect(409);
    await request(app.getHttpServer()).post(`/projects/${projectId}/restore`).expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups/${followUp.id}/resolve`)
      .send(resolutionBody)
      .expect(200);

    const resolutionAuditRows = await dataSource.query<Array<{ event_type: string }>>(
      'SELECT "event_type" FROM "audit_events" WHERE "project_id" = $1 AND "event_type" = $2',
      [projectId, 'DISCOVERY_FOLLOW_UP_RESOLVED'],
    );
    assert.deepEqual(resolutionAuditRows, [{ event_type: 'DISCOVERY_FOLLOW_UP_RESOLVED' }]);
  });

  it('rejects a duplicate discovery follow-up resolution without another audit event', async () => {
    const projectId = await createProject('discovery-follow-up-resolution-duplicate');
    const followUp = await createDiscoveryFollowUp(projectId, 'resolution-duplicate');
    const resolutionBody = {
      status: 'Nem releváns',
      decisionOrAnswer: 'The duplicate command must not create another audit event.',
    };

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups/${followUp.id}/resolve`)
      .send(resolutionBody)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups/${followUp.id}/resolve`)
      .send(resolutionBody)
      .expect(409);

    const resolutionAuditRows = await dataSource.query<Array<{ count: string }>>(
      'SELECT COUNT(*)::text AS "count" FROM "audit_events" WHERE "project_id" = $1 AND "event_type" = $2',
      [projectId, 'DISCOVERY_FOLLOW_UP_RESOLVED'],
    );
    assert.equal(resolutionAuditRows[0]?.count, '1');
  });

  it('rejects invalid discovery follow-up input without echoing submitted values', async () => {
    const projectId = await createProject('discovery-follow-up-validation');
    const tooLongQuestion = 'Q'.repeat(10_001);
    const tooLongOwner = 'O'.repeat(256);
    const tooLongNextStep = 'N'.repeat(10_001);
    const invalidBodies: ReadonlyArray<{
      readonly body: Record<string, string>;
      readonly forbidden: readonly string[];
    }> = [
      {
        body: {
          category: 'NOT_A_CATEGORY',
          question: 'unknown-category-question-sentinel',
          owner: 'Owner',
          dueDate: '2026-09-16',
          nextStep: 'Next',
        },
        forbidden: ['NOT_A_CATEGORY', 'unknown-category-question-sentinel'],
      },
      {
        body: {
          question: 'missing-category-question-sentinel',
          owner: 'Owner',
          dueDate: '2026-09-16',
          nextStep: 'Next',
        },
        forbidden: ['missing-category-question-sentinel'],
      },
      {
        body: {
          category: 'BUSINESS',
          question: '   ',
          owner: 'Owner',
          dueDate: '2026-09-16',
          nextStep: 'blank-question-next-step-sentinel',
        },
        forbidden: ['blank-question-next-step-sentinel'],
      },
      {
        body: {
          category: 'BUSINESS',
          question: 'blank-owner-question-sentinel',
          owner: '   ',
          dueDate: '2026-09-16',
          nextStep: 'Next',
        },
        forbidden: ['blank-owner-question-sentinel'],
      },
      {
        body: {
          category: 'BUSINESS',
          question: 'blank-next-step-question-sentinel',
          owner: 'Owner',
          dueDate: '2026-09-16',
          nextStep: '   ',
        },
        forbidden: ['blank-next-step-question-sentinel'],
      },
      {
        body: {
          category: 'BUSINESS',
          question: 'missing-next-step-question-sentinel',
          owner: 'Owner',
          dueDate: '2026-09-16',
        },
        forbidden: ['missing-next-step-question-sentinel'],
      },
      {
        body: {
          category: 'BUSINESS',
          question: 'missing-due-date-question-sentinel',
          owner: 'Owner',
          nextStep: 'Next',
        },
        forbidden: ['missing-due-date-question-sentinel'],
      },
      {
        body: {
          category: 'BUSINESS',
          question: 'owner-limit-question-sentinel',
          owner: tooLongOwner,
          dueDate: '2026-09-16',
          nextStep: 'Next',
        },
        forbidden: ['owner-limit-question-sentinel', tooLongOwner],
      },
      {
        body: {
          category: 'BUSINESS',
          question: tooLongQuestion,
          owner: 'Owner',
          dueDate: '2026-09-16',
          nextStep: 'Next',
        },
        forbidden: [tooLongQuestion],
      },
      {
        body: {
          category: 'BUSINESS',
          question: 'impossible-date-question-sentinel',
          owner: 'Owner',
          dueDate: '2026-02-30',
          nextStep: 'Next',
        },
        forbidden: ['impossible-date-question-sentinel', '2026-02-30'],
      },
      {
        body: {
          category: 'BUSINESS',
          question: 'next-step-limit-question-sentinel',
          owner: 'Owner',
          dueDate: '2026-09-16',
          nextStep: tooLongNextStep,
        },
        forbidden: ['next-step-limit-question-sentinel', tooLongNextStep],
      },
      {
        body: {
          category: 'BUSINESS',
          question: 'malformed-date-question-sentinel',
          owner: 'Owner',
          dueDate: 'not-a-date',
          nextStep: 'Next',
        },
        forbidden: ['malformed-date-question-sentinel', 'not-a-date'],
      },
      {
        body: {
          category: 'BUSINESS',
          question: 'unexpected-status-question-sentinel',
          owner: 'Owner',
          dueDate: '2026-09-16',
          nextStep: 'unexpected-status-next-step-sentinel',
          status: 'Folyamatban',
        },
        forbidden: [
          'unexpected-status-question-sentinel',
          'unexpected-status-next-step-sentinel',
          'Folyamatban',
        ],
      },
    ];

    for (const { body, forbidden } of invalidBodies) {
      const response = await request(app.getHttpServer())
        .post(`/projects/${projectId}/discovery-follow-ups`)
        .send(body)
        .expect(400);
      for (const value of forbidden) {
        assertNoSubmittedValues(response.body, value);
      }
    }
  });

  it('keeps discovery follow-ups readable while archived and permits creation after restore', async () => {
    const projectId = await createProject('discovery-follow-up-archive');
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups`)
      .send({
        category: 'OPERATIONS',
        question: 'Who owns operational handoff?',
        owner: 'Delivery lead',
        dueDate: '2026-09-18',
        nextStep: 'Assign an owner.',
      })
      .expect(201);
    await request(app.getHttpServer()).post(`/projects/${projectId}/archive`).expect(201);
    await request(app.getHttpServer())
      .get(`/projects/${projectId}/discovery-follow-ups`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups`)
      .send({
        category: 'OPERATIONS',
        question: 'Blocked while archived',
        owner: 'Delivery lead',
        dueDate: '2026-09-19',
        nextStep: 'Restore first.',
      })
      .expect(409);
    await request(app.getHttpServer()).post(`/projects/${projectId}/restore`).expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups`)
      .send({
        category: 'OPERATIONS',
        question: 'Created after restore',
        owner: 'Delivery lead',
        dueDate: '2026-09-19',
        nextStep: 'Continue handoff.',
      })
      .expect(201);
  });

  it('deletes a bare DRAFT project and makes it unreachable', async () => {
    const projectId = await createProject('delete-empty-draft');

    await request(app.getHttpServer()).delete(`/projects/${projectId}`).expect(204);
    await request(app.getHttpServer()).get(`/projects/${projectId}/cockpit`).expect(404);

    const listResponse = await request(app.getHttpServer()).get('/projects').expect(200);
    assert.equal(listResponse.body.some((project: { id: string }) => project.id === projectId), false);
  });

  it('rejects deletion for a non-DRAFT project and for a DRAFT with audit history', async () => {
    const nonDraftProjectId = await createProject('delete-non-draft');
    await request(app.getHttpServer())
      .patch(`/projects/${nonDraftProjectId}/workspace`)
      .send({ status: 'WAITING_INTERNAL' })
      .expect(200);
    await expectProjectDeletionConflict(nonDraftProjectId);

    const retainedProjectId = await createProject('delete-audit-history');
    await request(app.getHttpServer()).post(`/projects/${retainedProjectId}/archive`).expect(201);
    await request(app.getHttpServer()).post(`/projects/${retainedProjectId}/restore`).expect(201);
    await expectProjectDeletionConflict(retainedProjectId);
  });

  it('rejects deletion for DRAFT projects with Markdown and follow-up persistence', async () => {
    const markdownProjectId = await createProject('delete-markdown');
    await request(app.getHttpServer())
      .patch(`/projects/${markdownProjectId}/workspace`)
      .send({ status: 'READY_FOR_PLANNING' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/projects/${markdownProjectId}/workspace`)
      .send({ status: 'DRAFT' })
      .expect(200);
    await expectProjectDeletionConflict(markdownProjectId);

    const followUpProjectId = await createProject('delete-follow-up');
    await request(app.getHttpServer())
      .patch(`/projects/${followUpProjectId}/follow-up`)
      .send({ enabled: false, intervalMinutes: 10_080, expiresAt: null })
      .expect(200);
    await clearProjectAuditEvents(followUpProjectId);
    await expectProjectDeletionConflict(followUpProjectId);
  });

  it('rejects deletion for a DRAFT project with a persisted discovery follow-up before issuing DELETE', async () => {
    const projectId = await createProject('delete-discovery-follow-up');
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups`)
      .send({
        category: 'SECURITY',
        question: 'Which security approval is required?',
        owner: 'Security lead',
        dueDate: '2026-09-20',
        nextStep: 'Schedule the review.',
      })
      .expect(201);
    await clearProjectAuditEvents(projectId);

    try {
      await dataSource.query(`
        CREATE OR REPLACE FUNCTION "e2e_fail_discovery_follow_up_project_delete"()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          RAISE EXCEPTION 'Discovery follow-up deletion guard did not stop DELETE' USING ERRCODE = '55000';
        END;
        $$
      `);
      await dataSource.query(`
        CREATE TRIGGER "trg_e2e_fail_discovery_follow_up_project_delete"
        BEFORE DELETE ON "projects"
        FOR EACH ROW
        EXECUTE FUNCTION "e2e_fail_discovery_follow_up_project_delete"()
      `);

      await expectProjectDeletionConflict(projectId);
    } finally {
      await dataSource.query(
        'DROP TRIGGER IF EXISTS "trg_e2e_fail_discovery_follow_up_project_delete" ON "projects"',
      );
      await dataSource.query(
        'DROP FUNCTION IF EXISTS "e2e_fail_discovery_follow_up_project_delete"()',
      );
    }
  });

  it('rejects deletion for a project with a published question schema', async () => {
    const projectId = await createProject('delete-schema');
    const bankResponse = await request(app.getHttpServer()).get('/settings/base-questions').expect(200);
    const stableKey = bankResponse.body.questions[0]?.stableKey as string | undefined;
    if (!stableKey) {
      throw new Error('The seeded question bank did not return a stable key.');
    }

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/question-schema`)
      .send({ questions: [{ stableKey, required: true, blocking: true }] })
      .expect(201);
    await clearProjectAuditEvents(projectId);
    await expectProjectDeletionConflict(projectId);
  });

  it('serializes concurrent deletes to one 204 and one 404', async () => {
    const projectId = await createProject('concurrent-delete');
    try {
      await dataSource.query(`
        CREATE OR REPLACE FUNCTION "e2e_delay_project_delete"()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          PERFORM pg_sleep(0.2);
          RETURN OLD;
        END;
        $$
      `);
      await dataSource.query(`
        CREATE TRIGGER "trg_e2e_delay_project_delete"
        BEFORE DELETE ON "projects"
        FOR EACH ROW
        EXECUTE FUNCTION "e2e_delay_project_delete"()
      `);

      const [first, second] = await Promise.all([
        request(app.getHttpServer()).delete(`/projects/${projectId}`),
        request(app.getHttpServer()).delete(`/projects/${projectId}`),
      ]);
      assert.deepEqual(
        [first.status, second.status].sort((left, right) => left - right),
        [204, 404],
      );
    } finally {
      await dataSource.query('DROP TRIGGER IF EXISTS "trg_e2e_delay_project_delete" ON "projects"');
      await dataSource.query('DROP FUNCTION IF EXISTS "e2e_delay_project_delete"()');
    }
  });

  it('maps a late restrict-violation deletion race to a conflict and retains the project', async () => {
    const projectId = await createProject('late-delete-blocker');
    try {
      await dataSource.query(`
        CREATE OR REPLACE FUNCTION "e2e_add_project_delete_blocker"()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          INSERT INTO "customer_follow_ups" ("id", "project_id")
          VALUES ('00000000-0000-4000-8000-000000000001', OLD."id");
          RETURN OLD;
        END;
        $$
      `);
      await dataSource.query(`
        CREATE TRIGGER "trg_e2e_add_project_delete_blocker"
        BEFORE DELETE ON "projects"
        FOR EACH ROW
        EXECUTE FUNCTION "e2e_add_project_delete_blocker"()
      `);

      const response = await request(app.getHttpServer()).delete(`/projects/${projectId}`);
      assert.equal(response.status, 409);
      assert.equal(response.body.message, projectDeletionConflictMessage);
      await request(app.getHttpServer()).get(`/projects/${projectId}/cockpit`).expect(200);
    } finally {
      await dataSource.query(
        'DROP TRIGGER IF EXISTS "trg_e2e_add_project_delete_blocker" ON "projects"',
      );
      await dataSource.query('DROP FUNCTION IF EXISTS "e2e_add_project_delete_blocker"()');
    }
  });

  it('maps a late foreign-key violation deletion race to a conflict and retains the project', async () => {
    const projectId = await createProject('late-delete-fk-blocker');
    try {
      await dataSource.query(`
        CREATE OR REPLACE FUNCTION "e2e_add_deleted_project_fk_blocker"()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          INSERT INTO "customer_follow_ups" ("id", "project_id")
          VALUES ('00000000-0000-4000-8000-000000000002', OLD."id");
          RETURN OLD;
        END;
        $$
      `);
      await dataSource.query(`
        CREATE TRIGGER "trg_e2e_add_deleted_project_fk_blocker"
        AFTER DELETE ON "projects"
        FOR EACH ROW
        EXECUTE FUNCTION "e2e_add_deleted_project_fk_blocker"()
      `);

      const response = await request(app.getHttpServer()).delete(`/projects/${projectId}`);
      assert.equal(response.status, 409);
      assert.equal(response.body.message, projectDeletionConflictMessage);
      await request(app.getHttpServer()).get(`/projects/${projectId}/cockpit`).expect(200);
    } finally {
      await dataSource.query(
        'DROP TRIGGER IF EXISTS "trg_e2e_add_deleted_project_fk_blocker" ON "projects"',
      );
      await dataSource.query('DROP FUNCTION IF EXISTS "e2e_add_deleted_project_fk_blocker"()');
    }
  });

  it('returns 404 for a missing project and 400 without echoing a malformed project id', async () => {
    const missingProjectId = '00000000-0000-4000-8000-000000000000';
    await request(app.getHttpServer()).delete(`/projects/${missingProjectId}`).expect(404);

    const invalidProjectId = 'not-a-project-uuid';
    const invalidResponse = await request(app.getHttpServer())
      .delete(`/projects/${invalidProjectId}`)
      .expect(400);
    assertNoSubmittedValues(invalidResponse.body, invalidProjectId);
  });

  it('rejects empty patches, archived updates, duplicate archives, active restores, and missing projects', async () => {
    const projectId = await createProject('negative');

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/workspace`)
      .send({})
      .expect(400);

    await request(app.getHttpServer()).post(`/projects/${projectId}/archive`).expect(201);

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/workspace`)
      .send({ nextAction: 'Should not update while archived' })
      .expect(409);

    await request(app.getHttpServer()).post(`/projects/${projectId}/archive`).expect(409);

    const activeProjectId = await createProject('active-restore');
    await request(app.getHttpServer()).post(`/projects/${activeProjectId}/restore`).expect(409);

    const missingProjectId = '00000000-0000-4000-8000-000000000000';
    await request(app.getHttpServer())
      .get(`/projects/${missingProjectId}/cockpit`)
      .expect(404);
  });

  it('serializes concurrent archive requests to one transition and one audit event', async () => {
    const projectId = await createProject('concurrent-archive');
    try {
      await dataSource.query(`
        CREATE OR REPLACE FUNCTION "set_projects_updated_at"()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          PERFORM pg_sleep(0.2);
          NEW."updated_at" = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$
      `);

      const [firstResponse, secondResponse] = await Promise.all([
        request(app.getHttpServer()).post(`/projects/${projectId}/archive`),
        request(app.getHttpServer()).post(`/projects/${projectId}/archive`),
      ]);

      assert.deepEqual(
        [firstResponse.status, secondResponse.status].sort((left, right) => left - right),
        [201, 409],
      );

      const auditEvents = await dataSource.query<Array<{ event_type: string }>>(
        'SELECT "event_type" FROM "audit_events" WHERE "project_id" = $1',
        [projectId],
      );
      assert.deepEqual(auditEvents, [{ event_type: 'PROJECT_ARCHIVED' }]);
    } finally {
      await dataSource.query(`
        CREATE OR REPLACE FUNCTION "set_projects_updated_at"()
        RETURNS trigger
        LANGUAGE plpgsql
        AS $$
        BEGIN
          NEW."updated_at" = CURRENT_TIMESTAMP;
          RETURN NEW;
        END;
        $$
      `);
    }
  });

  async function createProject(label: string): Promise<string> {
    const response = await request(app.getHttpServer())
      .post('/projects')
      .send({
        name: `R1 project ${label} ${Date.now()}-${Math.random()}`,
        customerContactName: 'Test Contact',
        customerContactEmail: 'test@example.test',
      })
      .expect(201);

    return response.body.id as string;
  }

  async function createDiscoveryFollowUp(
    projectId: string,
    label: string,
  ): Promise<{ id: string; version: number }> {
    const response = await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups`)
      .send({
        category: 'OPERATIONS',
        question: `Question for ${label}`,
        owner: 'Delivery lead',
        dueDate: '2026-09-23',
        nextStep: `Next step for ${label}`,
      })
      .expect(201);

    return {
      id: response.body.id as string,
      version: response.body.version as number,
    };
  }

  async function countDiscoveryFollowUpUpdateAudit(
    projectId: string,
  ): Promise<number> {
    const rows = await dataSource.query<Array<{ count: string }>>(
      'SELECT COUNT(*)::text AS "count" FROM "audit_events" WHERE "project_id" = $1 AND "event_type" = $2',
      [projectId, 'DISCOVERY_FOLLOW_UP_UPDATED'],
    );
    return Number(rows[0]?.count);
  }

  async function expectProjectDeletionConflict(projectId: string): Promise<void> {
    const response = await request(app.getHttpServer()).delete(`/projects/${projectId}`).expect(409);
    assert.equal(response.body.message, projectDeletionConflictMessage);
  }

  async function clearProjectAuditEvents(projectId: string): Promise<void> {
    await dataSource.query('DELETE FROM "audit_events" WHERE "project_id" = $1', [projectId]);
  }
});

const projectDeletionConflictMessage =
  'This project has persisted activity and cannot be deleted. Archive it instead.';

function assertProjectResponse(value: unknown, expectedStatus: string): void {
  if (value === null || typeof value !== 'object') {
    throw new Error('project response was not an object');
  }

  const project = value as { id?: unknown; status?: unknown; dueAt?: unknown };
  if (typeof project.id !== 'string' || project.status !== expectedStatus) {
    throw new Error(`expected a project with status ${expectedStatus}`);
  }
  if (!('dueAt' in project)) {
    throw new Error('project response did not include dueAt');
  }
}

function assertNoSubmittedValues(value: unknown, submittedValue: string): void {
  if (JSON.stringify(value).includes(submittedValue)) {
    throw new Error('validation response echoed a submitted value');
  }
}

function discoveryFollowUpUpdateBody(
  expectedVersion: number,
  label: string,
): Record<string, unknown> {
  return {
    category: 'OPERATIONS',
    question: `Question for ${label}`,
    owner: 'Delivery lead',
    dueDate: '2026-09-24',
    nextStep: `Next step for ${label}`,
    expectedVersion,
  };
}
