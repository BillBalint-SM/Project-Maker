import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { DataSource } from 'typeorm';
import type { AnswerValue, BaseQuestionType } from '@project-maker/contracts';
import { loadGeneralPlaybookV1 } from '@project-maker/contracts/general-playbook-runtime';

import { AppModule } from '../src/app.module';

type InitialIntakeSnapshot = {
  readonly id: string;
  readonly order: number;
  readonly topic: string;
  readonly controlPoint: string;
  readonly text: string;
};

type DecisionReviewSnapshot = {
  readonly id: string;
  readonly type: BaseQuestionType;
  readonly stableKey: string;
  readonly options: readonly string[] | null;
};

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

  it('returns one Project-start draft for repeated use of the same creation command', async () => {
    const creationRequestId = randomUUID();
    const projectName = `Idempotent project start ${creationRequestId}`;
    const input = {
      creationRequestId,
      name: projectName,
      customerContactName: 'Test Contact',
      customerContactEmail: 'test@example.test',
      internalOwnerName: 'Test PO/PM',
      nextActionOwnerRole: 'INTERNAL_OWNER',
    };

    const [first, second] = await Promise.all([
      request(app.getHttpServer()).post('/projects').send(input),
      request(app.getHttpServer()).post('/projects').send(input),
    ]);

    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    assert.equal(first.body.id, second.body.id);

    const listResponse = await request(app.getHttpServer()).get('/projects').expect(200);
    assert.equal(
      listResponse.body.filter((project: { name: string }) => project.name === projectName).length,
      1,
    );
  });

  it('updates valid Project basics only before the first question schema is accepted', async () => {
    const projectId = await createProject('editable-basics');
    const acceptedBasics = {
      name: `Updated Project basics ${projectId}`,
      customerContactName: 'Updated Customer',
      customerContactEmail: 'updated-customer@example.test',
      internalOwnerName: 'Updated PO/PM',
    };

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/workspace`)
      .send({ status: 'WAITING_CUSTOMER' })
      .expect(200);

    const updated = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/basics`)
      .send(acceptedBasics)
      .expect(200);
    assert.equal(updated.body.name, acceptedBasics.name);
    assert.equal(updated.body.customerContactName, acceptedBasics.customerContactName);
    assert.equal(updated.body.customerContactEmail, acceptedBasics.customerContactEmail);
    assert.equal(updated.body.internalOwnerName, acceptedBasics.internalOwnerName);

    const bankResponse = await request(app.getHttpServer()).get('/settings/base-questions').expect(200);
    const stableKey = bankResponse.body.questions[0]?.stableKey as string | undefined;
    assert.ok(stableKey);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/question-schema`)
      .send({ questions: [{ stableKey, required: true, blocking: true }] })
      .expect(201);

    const rejectedName = `Rejected Project basics ${projectId}`;
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/basics`)
      .send({ ...acceptedBasics, name: rejectedName })
      .expect(409);

    const listResponse = await request(app.getHttpServer()).get('/projects').expect(200);
    const retainedProject = listResponse.body.find(
      (project: { id: string }) => project.id === projectId,
    );
    assert.equal(retainedProject.name, acceptedBasics.name);
  });

  it('keeps a basics-only Project-start draft eligible for guarded deletion', async () => {
    const projectId = await createProject('edited-bare-draft');
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/basics`)
      .send({
        name: `Edited bare draft ${projectId}`,
        customerContactName: 'Edited Contact',
        customerContactEmail: 'edited-contact@example.test',
        internalOwnerName: 'Edited PO/PM',
      })
      .expect(200);

    await request(app.getHttpServer()).delete(`/projects/${projectId}`).expect(204);
    await request(app.getHttpServer()).get(`/projects/${projectId}/cockpit`).expect(404);
  });

  it('manages a named Markdown template draft through preview and publication', async () => {
    const initialLibrary = await request(app.getHttpServer())
      .get('/settings/markdown-templates')
      .expect(200);

    assert.equal(initialLibrary.body.length, 1);
    assert.equal(initialLibrary.body[0].name, 'Alapértelmezett projektterv');
    assert.equal(initialLibrary.body[0].latestPublishedVersion, 1);
    assert.equal(initialLibrary.body[0].isDefault, true);

    const created = await request(app.getHttpServer())
      .post('/settings/markdown-templates')
      .send({
        name: 'Rövid átadási terv',
        draftContent: '# {{project.name}}\n\n{{project.context}}\n\n{{project.readiness?}}',
      })
      .expect(201);

    assert.equal(created.body.name, 'Rövid átadási terv');
    assert.equal(created.body.latestPublishedVersion, null);
    assert.equal(created.body.isDefault, false);

    const preview = await request(app.getHttpServer())
      .post(`/settings/markdown-templates/${created.body.id as string}/preview`)
      .expect(201);
    assert.match(preview.body.content, /^# Minta projekt/m);
    assert.match(preview.body.content, /Projektkontextus/);
    assert.equal(preview.body.content.includes('{{'), false);

    const published = await request(app.getHttpServer())
      .post(`/settings/markdown-templates/${created.body.id as string}/publish`)
      .expect(201);
    assert.equal(published.body.latestPublishedVersion, 1);

    const library = await request(app.getHttpServer())
      .get('/settings/markdown-templates')
      .expect(200);
    assert.deepEqual(
      library.body.map((template: { name: string }) => template.name),
      ['Alapértelmezett projektterv', 'Rövid átadási terv'],
    );
  });

  it('generates immutable Markdown provenance and remembers the project template selection', async () => {
    const projectId = await createProject('markdown-template-provenance');
    const templateName = `Provenance sablon ${projectId}`;
    const template = await request(app.getHttpServer())
      .post('/settings/markdown-templates')
      .send({
        name: templateName,
        draftContent: '# Átadás — {{project.name}}\n\n{{revision.metadata}}\n\n{{project.context}}',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/settings/markdown-templates/${template.body.id as string}/publish`)
      .expect(201);

    const firstRevision = await request(app.getHttpServer())
      .post(`/projects/${projectId}/markdown-revisions`)
      .send({ reason: 'MANUAL', templateId: template.body.id })
      .expect(201);

    assert.deepEqual(firstRevision.body.template, {
      id: template.body.id,
      name: templateName,
      version: 1,
    });
    assert.match(firstRevision.body.content, /^# Átadás — R1 project /m);
    assert.match(firstRevision.body.content, /markdown\\-template\\-provenance/);
    assert.match(firstRevision.body.content, /## Specifikációverzió/);
    assert.equal(firstRevision.body.content.includes('```json'), false);

    const rememberedConfiguration = await request(app.getHttpServer())
      .get(`/projects/${projectId}/markdown-revisions/configuration`)
      .expect(200);
    assert.equal(rememberedConfiguration.body.selectedTemplateId, template.body.id);

    const nextRevision = await request(app.getHttpServer())
      .post(`/projects/${projectId}/markdown-revisions`)
      .send({ reason: 'MANUAL' })
      .expect(201);
    assert.deepEqual(nextRevision.body.template, firstRevision.body.template);

    const auditRows = await dataSource.query<Array<{ payload: Record<string, string> }>>(
      'SELECT "payload" FROM "audit_events" WHERE "project_id" = $1 AND "event_type" = $2',
      [projectId, 'MARKDOWN_REVISION_CREATED'],
    );
    assert.equal(auditRows.length, 2);
    assert.deepEqual(Object.keys(auditRows[0]?.payload ?? {}).sort(), [
      'changeSummaryLength',
      'contentLength',
      'previousRevisionId',
      'reason',
      'revisionId',
      'revisionVersion',
      'sourceSnapshotLength',
    ]);
    assert.doesNotMatch(JSON.stringify(auditRows), new RegExp(templateName));

    const activity = await request(app.getHttpServer())
      .get(`/projects/${projectId}/activity`)
      .expect(200);
    assert.equal(
      activity.body.events.some(
        (event: { readonly summary?: string }) => event.summary === 'Új specifikációverzió készült.',
      ),
      true,
    );

    const otherProjectId = await createProject('markdown-default-template');
    const defaultConfiguration = await request(app.getHttpServer())
      .get(`/projects/${otherProjectId}/markdown-revisions/configuration`)
      .expect(200);
    assert.equal(
      defaultConfiguration.body.selectedTemplateId,
      defaultConfiguration.body.templates.find(
        (candidate: { isDefault: boolean }) => candidate.isDefault,
      )?.id,
    );
  });

  it('serializes concurrent Markdown generation and keeps legacy revisions readable', async () => {
    const projectId = await createProject('markdown-concurrent-generation');
    const [first, second] = await Promise.all([
      request(app.getHttpServer())
        .post(`/projects/${projectId}/markdown-revisions`)
        .send({ reason: 'MANUAL' })
        .expect(201),
      request(app.getHttpServer())
        .post(`/projects/${projectId}/markdown-revisions`)
        .send({ reason: 'MANUAL' })
        .expect(201),
    ]);
    const ordered = [first.body, second.body].sort(
      (left: { version: number }, right: { version: number }) => left.version - right.version,
    );
    assert.deepEqual(ordered.map((revision: { version: number }) => revision.version), [1, 2]);
    assert.equal(ordered[1].previousRevisionId, ordered[0].id);
    assert.deepEqual(ordered.map((revision: { template: { version: number } }) => revision.template.version), [1, 1]);

    await dataSource.query('ALTER TABLE "markdown_revisions" DISABLE TRIGGER "trg_markdown_revisions_immutable"');
    try {
      await dataSource.query(
        'UPDATE "markdown_revisions" SET "template_id" = NULL, "template_name" = NULL, "template_version" = NULL WHERE "id" = $1',
        [ordered[0].id],
      );
    } finally {
      await dataSource.query('ALTER TABLE "markdown_revisions" ENABLE TRIGGER "trg_markdown_revisions_immutable"');
    }
    const legacy = await request(app.getHttpServer())
      .get(`/projects/${projectId}/markdown-revisions/${ordered[0].id as string}`)
      .expect(200);
    assert.equal(legacy.body.template, null);
    assert.equal(legacy.body.content, ordered[0].content);
  });

  it('keeps generated template provenance immutable across later publications', async () => {
    const projectId = await createProject('markdown-template-version-history');
    const template = await request(app.getHttpServer())
      .post('/settings/markdown-templates')
      .send({
        name: `Verziózott sablon ${projectId}`,
        draftContent: '# Első publikáció — {{project.name}}',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/settings/markdown-templates/${template.body.id as string}/publish`)
      .expect(201);
    const first = await request(app.getHttpServer())
      .post(`/projects/${projectId}/markdown-revisions`)
      .send({ reason: 'MANUAL', templateId: template.body.id })
      .expect(201);

    await request(app.getHttpServer())
      .put(`/settings/markdown-templates/${template.body.id as string}/draft`)
      .send({
        name: template.body.name,
        draftContent: '# Második publikáció — {{project.name}}',
      })
      .expect(200);
    await request(app.getHttpServer())
      .post(`/settings/markdown-templates/${template.body.id as string}/publish`)
      .expect(201)
      .expect(({ body }) => assert.equal(body.latestPublishedVersion, 2));

    const historical = await request(app.getHttpServer())
      .get(`/projects/${projectId}/markdown-revisions/${first.body.id as string}`)
      .expect(200);
    assert.equal(historical.body.template.version, 1);
    assert.match(historical.body.content, /^# Első publikáció/m);

    const current = await request(app.getHttpServer())
      .post(`/projects/${projectId}/markdown-revisions`)
      .send({ reason: 'MANUAL' })
      .expect(201);
    assert.equal(current.body.template.version, 2);
    assert.match(current.body.content, /^# Második publikáció/m);
  });

  it('blocks unsafe templates, missing required data, and archived generation', async () => {
    await request(app.getHttpServer())
      .post('/settings/markdown-templates')
      .send({ name: 'Nem biztonságos sablon', draftContent: '{{process.env}}' })
      .expect(400)
      .expect(({ body }) =>
        assert.equal(body.message, 'Nem támogatott specifikációs sablon-helyőrző: process.env.'),
      );
    await request(app.getHttpServer())
      .post('/settings/markdown-templates')
      .send({
        name: 'Beágyazott opcionális sablon',
        draftContent: 'Felkészültség: {{project.readiness?}}',
      })
      .expect(400)
      .expect(({ body }) =>
        assert.equal(
          body.message,
          'Az opcionális specifikációs sablon helyőrzőjének önálló Markdown-blokkban kell állnia.',
        ),
      );

    const projectId = await createProject('markdown-required-placeholder');
    const template = await request(app.getHttpServer())
      .post('/settings/markdown-templates')
      .send({
        name: `Kötelező kérdésséma ${projectId}`,
        draftContent: '# {{project.name}}\n\n{{project.schema}}',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/settings/markdown-templates/${template.body.id as string}/publish`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/markdown-revisions`)
      .send({ reason: 'MANUAL', templateId: template.body.id })
      .expect(409)
      .expect(({ body }) => assert.match(body.message, /Elfogadott projekt-kérdésséma/));

    for (const [placeholder, expectedLabel] of [
      ['project.readiness', 'Felkészültség'],
      ['project.decisionReview', 'Döntési értékelés'],
    ] as const) {
      const requiredTemplate = await request(app.getHttpServer())
        .post('/settings/markdown-templates')
        .send({
          name: `Kötelező ${expectedLabel} ${projectId}`,
          draftContent: `# {{project.name}}\n\n{{${placeholder}}}`,
        })
        .expect(201);
      await request(app.getHttpServer())
        .post(`/settings/markdown-templates/${requiredTemplate.body.id as string}/publish`)
        .expect(201);
      await request(app.getHttpServer())
        .post(`/projects/${projectId}/markdown-revisions`)
        .send({ reason: 'MANUAL', templateId: requiredTemplate.body.id })
        .expect(409)
        .expect(({ body }) => assert.match(body.message, new RegExp(expectedLabel)));
    }

    const optionalTemplate = await request(app.getHttpServer())
      .post('/settings/markdown-templates')
      .send({
        name: `Opcionális blokkok ${projectId}`,
        draftContent: '# {{project.name}}\n\n## Felkészültség\n\n{{project.readiness?}}\n\n## Döntési értékelés\n\n{{project.decisionReview?}}',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/settings/markdown-templates/${optionalTemplate.body.id as string}/publish`)
      .expect(201);
    const optionalRevision = await request(app.getHttpServer())
      .post(`/projects/${projectId}/markdown-revisions`)
      .send({ reason: 'MANUAL', templateId: optionalTemplate.body.id })
      .expect(201);
    assert.equal(optionalRevision.body.content.includes('## Felkészültség'), false);
    assert.equal(optionalRevision.body.content.includes('## Döntési értékelés'), false);

    await request(app.getHttpServer()).post(`/projects/${projectId}/archive`).expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/markdown-revisions`)
      .send({ reason: 'MANUAL' })
      .expect(409)
      .expect(({ body }) => assert.match(body.message, /Archivált projekt/));
  });

  it('renders every Decision Review input in domain language', async () => {
    const projectId = await createProject('markdown-decision-review-inputs');
    const roundId = await createCanonicalDecisionReviewRound(projectId);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/complete`)
      .expect(201);
    await request(app.getHttpServer())
      .put(`/projects/${projectId}/decision-review`)
      .send({
        businessValue: 5,
        strategicAlignment: 4,
        urgency: 3,
        confidence: 4,
        complexity: 2,
        risk: 1,
      })
      .expect(200);
    const template = await request(app.getHttpServer())
      .post('/settings/markdown-templates')
      .send({
        name: `Döntési bemenetek ${projectId}`,
        draftContent: '# {{project.name}}\n\n{{project.decisionReview}}',
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/settings/markdown-templates/${template.body.id as string}/publish`)
      .expect(201);

    const revision = await request(app.getHttpServer())
      .post(`/projects/${projectId}/markdown-revisions`)
      .send({ reason: 'MANUAL', templateId: template.body.id })
      .expect(201);
    assert.match(revision.body.content, /Üzleti érték: 5/);
    assert.match(revision.body.content, /Stratégiai illeszkedés: 4/);
    assert.match(revision.body.content, /Sürgősség: 3/);
    assert.match(revision.body.content, /Bizonyosság: 4/);
    assert.match(revision.body.content, /Komplexitás: 2/);
    assert.match(revision.body.content, /Kockázat: 1/);
    assert.equal(revision.body.content.includes('ESTIMATE_'), false);
  });

  it('keeps multiline Initial Intake answers inside their Markdown list field', async () => {
    const projectId = await createProject('markdown-multiline-answer');
    const roundId = await createCanonicalDecisionReviewRound(projectId);
    const activeRound = await request(app.getHttpServer())
      .get(`/projects/${projectId}/rounds/active`)
      .expect(200);
    const multilineQuestion = (activeRound.body.questions as DecisionReviewSnapshot[]).find(
      (question) => question.type === 'TEXT' || question.type === 'LONG_TEXT',
    );
    if (!multilineQuestion) {
      throw new Error('The canonical intake did not contain a multiline-capable question.');
    }
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/rounds/${roundId}/answers/${multilineQuestion.id}`)
      .send({ value: 'Első bekezdés\n\nMásodik bekezdés' })
      .expect(200);

    const revision = await request(app.getHttpServer())
      .post(`/projects/${projectId}/markdown-revisions`)
      .send({ reason: 'MANUAL' })
      .expect(201);
    assert.match(
      revision.body.content,
      /- Válasz:\n  > Első bekezdés\n  >\n  > Második bekezdés/,
    );
    assert.equal(revision.body.content.includes('\n\nMásodik bekezdés'), false);
  });

  it('reports the next preparation action for a project without an accepted question schema', async () => {
    const projectId = await createProject('preparation-status-schema-required');

    const response = await request(app.getHttpServer())
      .get(`/projects/${projectId}/preparation-status`)
      .expect(200);

    assert.deepEqual(response.body, {
      projectId,
      state: 'SCHEMA_REQUIRED',
      label: 'Kérdésséma szükséges',
      primaryAction: {
        label: 'Felmérés megnyitása',
        target: 'INTERVIEW',
      },
    });
  });

  it('returns recent project activity in human-readable form without raw audit details', async () => {
    const projectId = await createProject('project-activity');
    await request(app.getHttpServer()).post(`/projects/${projectId}/archive`).expect(201);

    const response = await request(app.getHttpServer())
      .get(`/projects/${projectId}/activity`)
      .expect(200);

    assert.equal(response.body.projectId, projectId);
    assert.deepEqual(response.body.events, [
      {
        occurredAt: response.body.events[0]?.occurredAt,
        summary: 'A projekt archiválva lett.',
      },
    ]);
    assert.match(response.body.events[0]?.occurredAt ?? '', /^\d{4}-\d{2}-\d{2}T/);
    assert.equal('eventType' in response.body.events[0], false);
    assert.equal('payload' in response.body.events[0], false);
  });

  it('selects the latest five allow-listed business events before applying the activity limit', async () => {
    const projectId = await createProject('allow-listed-project-activity');
    const allowedEvents = [
      ['PROJECT_ARCHIVED', 'A projekt archiválva lett.'],
      ['PROJECT_RESTORED', 'A projekt visszaállítva lett.'],
      ['DISCOVERY_FOLLOW_UP_CREATED', 'Új tisztázandó tétel jött létre.'],
      ['DISCOVERY_FOLLOW_UP_UPDATED', 'Egy tisztázandó tétel frissítve lett.'],
      ['DISCOVERY_FOLLOW_UP_RESOLVED', 'Egy tisztázandó tétel lezárva lett.'],
      ['PROJECT_DECISION_INPUTS_UPDATED', 'A döntési értékelés frissítve lett.'],
    ] as const;

    for (const [index, [eventType]] of allowedEvents.entries()) {
      await dataSource.query(
        `INSERT INTO audit_events (id, project_id, event_type, payload, created_at)
         VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [
          randomUUID(),
          projectId,
          eventType,
          JSON.stringify({ internalSecret: `must-not-leak-${index}` }),
          new Date(Date.UTC(2026, 7, 19, 8, index)).toISOString(),
        ],
      );
    }

    for (let index = 0; index < 7; index += 1) {
      await dataSource.query(
        `INSERT INTO audit_events (id, project_id, event_type, payload, created_at)
         VALUES ($1, $2, $3, $4::jsonb, $5)`,
        [
          randomUUID(),
          projectId,
          `INTERNAL_TECHNICAL_DIAGNOSTIC_${index}`,
          JSON.stringify({ customerContent: `must-not-leak-${index}` }),
          new Date(Date.UTC(2026, 7, 19, 9, index)).toISOString(),
        ],
      );
    }

    const response = await request(app.getHttpServer())
      .get(`/projects/${projectId}/activity`)
      .expect(200);

    assert.deepEqual(
      response.body.events.map((event: { summary: string }) => event.summary),
      allowedEvents.slice(1).reverse().map(([, summary]) => summary),
    );
    assert.equal(JSON.stringify(response.body).includes('INTERNAL_TECHNICAL'), false);
    assert.equal(JSON.stringify(response.body).includes('must-not-leak'), false);
  });

  it('keeps an open Initial Intake in the interview preparation state', async () => {
    const projectId = await createProject('preparation-status-intake-in-progress');
    await createCanonicalDecisionReviewRound(projectId);

    const response = await request(app.getHttpServer())
      .get(`/projects/${projectId}/preparation-status`)
      .expect(200);

    assert.deepEqual(response.body, {
      projectId,
      state: 'INTAKE_IN_PROGRESS',
      label: 'Felmérés folyamatban',
      primaryAction: {
        label: 'Felmérés megnyitása',
        target: 'INTERVIEW',
      },
    });
  });

  it('routes a completed intake with missing Decision Review inputs to the review', async () => {
    const projectId = await createProject('preparation-status-decision-review-required');
    const roundId = await createCanonicalDecisionReviewRound(projectId);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/complete`)
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/projects/${projectId}/preparation-status`)
      .expect(200);

    assert.deepEqual(response.body, {
      projectId,
      state: 'DECISION_REVIEW_REQUIRED',
      label: 'Döntési értékelés szükséges',
      primaryAction: {
        label: 'Döntési értékelés megnyitása',
        target: 'DECISION_REVIEW',
      },
    });
  });

  it('restarts preparation at schema selection after restoring retained intake history', async () => {
    const projectId = await createProject('preparation-status-after-restoration');
    const roundId = await createCanonicalDecisionReviewRound(projectId);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/complete`)
      .expect(201);
    await request(app.getHttpServer()).post(`/projects/${projectId}/archive`).expect(201);
    await request(app.getHttpServer()).post(`/projects/${projectId}/restore`).expect(201);

    const response = await request(app.getHttpServer())
      .get(`/projects/${projectId}/preparation-status`)
      .expect(200);

    assert.deepEqual(response.body, {
      projectId,
      state: 'SCHEMA_REQUIRED',
      label: 'Kérdésséma szükséges',
      primaryAction: {
        label: 'Felmérés megnyitása',
        target: 'INTERVIEW',
      },
    });
  });

  it('routes an unsupported completed schema to readiness clarification', async () => {
    const projectId = await createProject('preparation-status-unsupported-schema');
    const bank = await request(app.getHttpServer()).get('/settings/base-questions').expect(200);
    const firstStableKey = (bank.body.questions as Array<{ stableKey?: string }>)[0]?.stableKey;
    if (!firstStableKey) {
      throw new Error('Seeded question bank did not provide a source stable key.');
    }
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/question-schema`)
      .send({
        questions: [{ stableKey: firstStableKey, required: false, blocking: false }],
      })
      .expect(201);
    const round = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${round.body.id as string}/complete`)
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/projects/${projectId}/preparation-status`)
      .expect(200);

    assert.deepEqual(response.body, {
      projectId,
      state: 'CLARIFICATION_REQUIRED',
      label: 'Tisztázás szükséges',
      primaryAction: {
        label: 'Becslési felkészültség megnyitása',
        target: 'READINESS',
      },
    });
  });

  it('derives the estimation preparation state from the current Decision Review recommendation', async () => {
    const projectId = await createProject('preparation-status-estimate-preparable');
    const roundId = await createCanonicalDecisionReviewRound(projectId);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/complete`)
      .expect(201);
    await request(app.getHttpServer())
      .put(`/projects/${projectId}/decision-review`)
      .send({
        businessValue: 3,
        strategicAlignment: 3,
        urgency: 3,
        confidence: 3,
        complexity: 3,
        risk: 3,
      })
      .expect(200)
      .expect(({ body }) => assert.equal(body.recommendation, 'ESTIMATE_PREPARATION_POSSIBLE'));

    const response = await request(app.getHttpServer())
      .get(`/projects/${projectId}/preparation-status`)
      .expect(200);

    assert.deepEqual(response.body, {
      projectId,
      state: 'ESTIMATE_PREPARABLE',
      label: 'Becslés előkészíthető',
      primaryAction: {
        label: 'Döntési értékelés megnyitása',
        target: 'DECISION_REVIEW',
      },
    });
  });

  it('routes a clarification recommendation to readiness', async () => {
    const projectId = await createProject('preparation-status-clarification-required');
    const roundId = await createCanonicalDecisionReviewRound(projectId);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/complete`)
      .expect(201);
    await request(app.getHttpServer())
      .put(`/projects/${projectId}/decision-review`)
      .send({
        businessValue: 1,
        strategicAlignment: 1,
        urgency: 1,
        confidence: 1,
        complexity: 5,
        risk: 5,
      })
      .expect(200)
      .expect(({ body }) => assert.equal(body.recommendation, 'CLARIFICATION_REQUIRED'));

    const response = await request(app.getHttpServer())
      .get(`/projects/${projectId}/preparation-status`)
      .expect(200);

    assert.deepEqual(response.body, {
      projectId,
      state: 'CLARIFICATION_REQUIRED',
      label: 'Tisztázás szükséges',
      primaryAction: {
        label: 'Becslési felkészültség megnyitása',
        target: 'READINESS',
      },
    });
  });

  it('surfaces an estimate-ready recommendation as the final preparation state', async () => {
    const projectId = await createProject('preparation-status-estimate-ready');
    const roundId = await createCanonicalDecisionReviewRound(projectId);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${roundId}/complete`)
      .expect(201);
    await request(app.getHttpServer())
      .put(`/projects/${projectId}/decision-review`)
      .send({
        businessValue: 5,
        strategicAlignment: 4,
        urgency: 3,
        confidence: 2,
        complexity: 4,
        risk: 5,
      })
      .expect(200)
      .expect(({ body }) => assert.equal(body.recommendation, 'ESTIMATE_READY'));

    const response = await request(app.getHttpServer())
      .get(`/projects/${projectId}/preparation-status`)
      .expect(200);

    assert.deepEqual(response.body, {
      projectId,
      state: 'ESTIMATE_READY',
      label: 'Becslésre kész',
      primaryAction: {
        label: 'Döntési értékelés megnyitása',
        target: 'DECISION_REVIEW',
      },
    });
  });

  it('returns a blank Decision Review with every current availability blocker', async () => {
    const projectId = await createProject('decision-review-unavailable');

    const response = await request(app.getHttpServer())
      .get(`/projects/${projectId}/decision-review`)
      .expect(200);

    assert.deepEqual(response.body, {
      projectId,
      inputs: {
        businessValue: null,
        strategicAlignment: null,
        urgency: null,
        confidence: null,
        complexity: null,
        risk: null,
      },
      dimensions: decisionReviewDimensions(),
      ratingScale: { minimum: 1, maximum: 5 },
      editable: true,
      available: false,
      unavailableReasons: ['INCOMPLETE_INPUT', 'NO_INITIAL_INTAKE'],
    });
  });

  it('reports an unsupported current Initial Intake schema through Decision Review', async () => {
    const projectId = await createProject('decision-review-unsupported-schema');
    const bank = await request(app.getHttpServer()).get('/settings/base-questions').expect(200);
    const firstStableKey = (bank.body.questions as Array<{ stableKey?: string }>)[0]?.stableKey;
    if (!firstStableKey) {
      throw new Error('Seeded question bank did not provide a source stable key.');
    }
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/question-schema`)
      .send({
        questions: [{ stableKey: firstStableKey, required: false, blocking: false }],
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get(`/projects/${projectId}/decision-review`)
      .expect(200);

    assert.equal(response.body.available, false);
    assert.deepEqual(response.body.unavailableReasons, [
      'INCOMPLETE_INPUT',
      'UNSUPPORTED_SCHEMA',
    ]);
  });

  it('persists Decision Review inputs atomically with a redacted audit event', async () => {
    const projectId = await createProject('decision-review-inputs');
    const inputs = {
      businessValue: 5,
      strategicAlignment: 4,
      urgency: 3,
      confidence: 2,
      complexity: 4,
      risk: 5,
    };

    const updated = await request(app.getHttpServer())
      .put(`/projects/${projectId}/decision-review`)
      .send(inputs)
      .expect(200);

    assert.deepEqual(updated.body, {
      projectId,
      inputs,
      dimensions: decisionReviewDimensions(),
      ratingScale: { minimum: 1, maximum: 5 },
      editable: true,
      available: false,
      unavailableReasons: ['NO_INITIAL_INTAKE'],
    });

    await request(app.getHttpServer())
      .get(`/projects/${projectId}/decision-review`)
      .expect(200)
      .expect(updated.body);

    const auditEvents = await dataSource.query<
      Array<{ event_type: string; payload: Record<string, unknown> }>
    >(
      'SELECT "event_type", "payload" FROM "audit_events" WHERE "project_id" = $1 ORDER BY "created_at" ASC, "id" ASC',
      [projectId],
    );
    assert.deepEqual(auditEvents, [
      {
        event_type: 'PROJECT_DECISION_INPUTS_UPDATED',
        payload: {
          changedDimensions:
            'businessValue,strategicAlignment,urgency,confidence,complexity,risk',
        },
      },
    ]);
  });

  it('returns the server-derived Decision Score and estimate-ready recommendation for a complete review', async () => {
    const projectId = await createProject('decision-review-complete');
    const inputs = {
      businessValue: 5,
      strategicAlignment: 4,
      urgency: 3,
      confidence: 2,
      complexity: 4,
      risk: 5,
    };
    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/workspace`)
      .send({ internalOwnerName: 'Decision Review owner', nextActionOwnerRole: 'INTERNAL_OWNER', status: 'DRAFT' })
      .expect(200);
    await createCanonicalDecisionReviewRound(projectId);

    const response = await request(app.getHttpServer())
      .put(`/projects/${projectId}/decision-review`)
      .send(inputs)
      .expect(200);

    assert.deepEqual(response.body, {
      projectId,
      inputs,
      available: true,
      editable: true,
      decisionScore: 68,
      decisionScoreLabel: 'Magas',
      recommendation: 'ESTIMATE_READY',
      readinessPercentage: 100,
      hasCriticalGap: false,
      estimateBlockingGapCount: 0,
      clarificationReasons: [],
      clarificationMessages: [],
      dimensions: [
        { id: 'businessValue', weight: 0.25, inverted: false },
        { id: 'strategicAlignment', weight: 0.15, inverted: false },
        { id: 'urgency', weight: 0.15, inverted: false },
        { id: 'confidence', weight: 0.15, inverted: false },
        { id: 'complexity', weight: 0.1, inverted: true },
        { id: 'risk', weight: 0.1, inverted: true },
      ],
      ratingScale: { minimum: 1, maximum: 5 },
    });
  });

  it('requires clarification before a positive recommendation when a critical canonical gap remains', async () => {
    const projectId = await createProject('decision-review-critical-gap');
    const inputs = {
      businessValue: 5,
      strategicAlignment: 4,
      urgency: 3,
      confidence: 2,
      complexity: 4,
      risk: 5,
    };

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/workspace`)
      .send({ internalOwnerName: 'Decision Review owner', nextActionOwnerRole: 'INTERNAL_OWNER', status: 'DRAFT' })
      .expect(200);
    await createCanonicalDecisionReviewRound(projectId, new Set(['general-001']));

    const response = await request(app.getHttpServer())
      .put(`/projects/${projectId}/decision-review`)
      .send(inputs)
      .expect(200);

    assert.equal(response.body.available, true);
    assert.equal(response.body.decisionScore, 67);
    assert.equal(response.body.decisionScoreLabel, 'Magas');
    assert.equal(response.body.readinessPercentage, 89);
    assert.equal(response.body.hasCriticalGap, true);
    assert.equal(response.body.estimateBlockingGapCount, 1);
    assert.deepEqual(response.body.clarificationReasons, ['CRITICAL_GAP']);
    assert.equal(response.body.recommendation, 'CLARIFICATION_REQUIRED');
  });

  it('retains partial Decision Review inputs but makes no audit or timestamp change for an identical update', async () => {
    const projectId = await createProject('decision-review-no-op');
    const inputs = {
      businessValue: 3,
      strategicAlignment: null,
      urgency: null,
      confidence: null,
      complexity: null,
      risk: null,
    };

    await request(app.getHttpServer())
      .put(`/projects/${projectId}/decision-review`)
      .send(inputs)
      .expect(200)
      .expect(({ body }) => {
        assert.equal(body.available, false);
        assert.deepEqual(body.unavailableReasons, ['INCOMPLETE_INPUT', 'NO_INITIAL_INTAKE']);
      });
    const before = await dataSource.query<Array<{ updated_at: string }>>(
      'SELECT "updated_at"::text FROM "projects" WHERE "id" = $1',
      [projectId],
    );

    await request(app.getHttpServer())
      .put(`/projects/${projectId}/decision-review`)
      .send(inputs)
      .expect(200);

    const after = await dataSource.query<Array<{ updated_at: string }>>(
      'SELECT "updated_at"::text FROM "projects" WHERE "id" = $1',
      [projectId],
    );
    assert.deepEqual(after, before);
    const audits = await dataSource.query<Array<{ event_type: string }>>(
      'SELECT "event_type" FROM "audit_events" WHERE "project_id" = $1',
      [projectId],
    );
    assert.deepEqual(audits, [{ event_type: 'PROJECT_DECISION_INPUTS_UPDATED' }]);
  });

  it('retains Decision Review inputs when a later Initial Intake becomes current and recalculates from that source', async () => {
    const projectId = await createProject('decision-review-current-source');
    const inputs = {
      businessValue: 5,
      strategicAlignment: 4,
      urgency: 3,
      confidence: 2,
      complexity: 4,
      risk: 5,
    };

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/workspace`)
      .send({ internalOwnerName: 'Decision Review owner', nextActionOwnerRole: 'INTERNAL_OWNER', status: 'DRAFT' })
      .expect(200);
    const firstRoundId = await createCanonicalDecisionReviewRound(projectId);
    await request(app.getHttpServer())
      .put(`/projects/${projectId}/decision-review`)
      .send(inputs)
      .expect(200)
      .expect(({ body }) => assert.equal(body.readinessPercentage, 100));
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${firstRoundId}/complete`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);

    const review = await request(app.getHttpServer())
      .get(`/projects/${projectId}/decision-review`)
      .expect(200);
    assert.deepEqual(review.body.inputs, inputs);
    assert.equal(review.body.available, true);
    assert.equal(review.body.readinessPercentage, 43);
    assert.equal(review.body.decisionScore, 62);
    assert.equal(review.body.recommendation, 'CLARIFICATION_REQUIRED');
    assert.deepEqual(review.body.clarificationReasons, [
      'CRITICAL_GAP',
      'TOO_MANY_ESTIMATE_BLOCKING_GAPS',
    ]);
  });

  it('rejects Decision Review writes for an archived project and blocks deletion after any persisted input', async () => {
    const projectId = await createProject('decision-review-lifecycle');
    const inputs = {
      businessValue: 3,
      strategicAlignment: null,
      urgency: null,
      confidence: null,
      complexity: null,
      risk: null,
    };

    await request(app.getHttpServer())
      .put(`/projects/${projectId}/decision-review`)
      .send(inputs)
      .expect(200);
    await request(app.getHttpServer()).delete(`/projects/${projectId}`).expect(409);
    await request(app.getHttpServer()).post(`/projects/${projectId}/archive`).expect(201);
    await request(app.getHttpServer())
      .put(`/projects/${projectId}/decision-review`)
      .send({ ...inputs, businessValue: 4 })
      .expect(409);
    await request(app.getHttpServer()).post(`/projects/${projectId}/restore`).expect(201);
    await request(app.getHttpServer())
      .get(`/projects/${projectId}/decision-review`)
      .expect(200)
      .expect(({ body }) => assert.equal(body.inputs.businessValue, 3));
  });

  it('rejects incomplete and out-of-range Decision Review write bodies without persisting a partial change', async () => {
    const projectId = await createProject('decision-review-validation');
    const validInputs = {
      businessValue: 5,
      strategicAlignment: 4,
      urgency: 3,
      confidence: 2,
      complexity: 4,
      risk: 5,
    };

    await request(app.getHttpServer())
      .put(`/projects/${projectId}/decision-review`)
      .send({ businessValue: 4 })
      .expect(400);
    await request(app.getHttpServer())
      .put(`/projects/${projectId}/decision-review`)
      .send({ ...validInputs, risk: 6 })
      .expect(400);

    const review = await request(app.getHttpServer())
      .get(`/projects/${projectId}/decision-review`)
      .expect(200);
    assert.deepEqual(review.body.inputs, {
      businessValue: null,
      strategicAlignment: null,
      urgency: null,
      confidence: null,
      complexity: null,
      risk: null,
    });
    const audits = await dataSource.query<Array<{ event_type: string }>>(
      'SELECT "event_type" FROM "audit_events" WHERE "project_id" = $1',
      [projectId],
    );
    assert.deepEqual(audits, []);
  });

  it('creates a project with the expected workspace and contact values', async () => {
    const response = await request(app.getHttpServer())
      .post('/projects')
      .send({
        name: `R1 project create-values ${Date.now()}`,
        customerContactName: 'Ada Lovelace',
        customerContactEmail: 'ada@example.test',
        internalOwnerName: 'Grace Hopper',
        nextActionOwnerRole: 'INTERNAL_OWNER',
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
        internalOwnerName: 'Katherine Johnson',
        nextActionOwnerRole: 'INTERNAL_OWNER',
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

  it('updates only supplied coordination fields and rejects an empty workspace update', async () => {
    const projectId = await createProject('partial-coordination');

    const workspaceResponse = await request(app.getHttpServer())
      .patch(`/projects/${projectId}/workspace`)
      .send({
        nextActionOwnerRole: 'INTERNAL_OWNER',
        nextAction: null,
        dueAt: null,
      })
      .expect(200);

    assertProjectResponse(workspaceResponse.body, 'DRAFT');
    assert.equal(workspaceResponse.body.nextActionOwnerRole, 'INTERNAL_OWNER');
    assert.equal(workspaceResponse.body.nextAction, null);
    assert.equal(workspaceResponse.body.dueAt, null);

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/workspace`)
      .send({})
      .expect(400)
      .expect(({ body }) => {
        assert.equal(body.message, 'Workspace update must include at least one field.');
      });
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

    await request(app.getHttpServer())
      .patch(`/projects/${projectId}/workspace`)
      .send({ internalOwnerName: null, nextActionOwnerRole: 'INTERNAL_OWNER' })
      .expect(400);
    await request(app.getHttpServer())
      .get(`/projects/${projectId}/cockpit`)
      .expect(200)
      .expect(({ body }) => {
        assert.equal(body.nextActionOwner.complete, true);
        assert.equal(body.nextActionOwner.role, 'INTERNAL_OWNER');
      });
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
      messageDraft: null,
      referencedFollowUpId: null,
      draftVersion: 1,
      latestManualAttempt: null,
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

  it('lists current Initial Intake candidates and creates a linked discovery follow-up with compact provenance', async () => {
    const projectId = await createProject('discovery-follow-up-source-options');
    const source = await createInitialIntakeSource(projectId);

    const options = await request(app.getHttpServer())
      .get('/projects/' + projectId + '/discovery-follow-ups/source-options')
      .expect(200);

    assert.deepEqual(options.body, [
      {
        snapshotId: source.snapshot.id,
        order: source.snapshot.order,
        topic: source.snapshot.topic,
        controlPoint: source.snapshot.controlPoint,
        text: source.snapshot.text,
      },
    ]);

    const created = await request(app.getHttpServer())
      .post('/projects/' + projectId + '/discovery-follow-ups')
      .send({
        category: 'BUSINESS',
        question: 'Which discovery decision still needs proof?',
        owner: 'Product owner',
        dueDate: '2026-10-01',
        nextStep: 'Review the intake evidence.',
        sourceSnapshotId: source.snapshot.id,
      })
      .expect(201);

    assert.deepEqual(created.body.source, {
      snapshotId: source.snapshot.id,
      order: source.snapshot.order,
      topic: source.snapshot.topic,
      controlPoint: source.snapshot.controlPoint,
    });
    assert.equal(created.body.version, 1);

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
          followUpId: created.body.id,
          category: 'BUSINESS',
          dueDate: '2026-10-01',
          status: 'Nyitott',
          sourceOrder: String(source.snapshot.order),
          sourceTopic: source.snapshot.topic,
          sourceControlPoint: source.snapshot.controlPoint,
        },
      },
    ]);
    assert.doesNotMatch(JSON.stringify(auditRows), new RegExp(source.snapshot.id));
    assert.doesNotMatch(JSON.stringify(auditRows), new RegExp(source.snapshot.text));
  });

  it('returns no source candidates even when the project is archived', async () => {
    const projectId = await createProject('discovery-follow-up-source-options-empty');

    await request(app.getHttpServer())
      .get('/projects/' + projectId + '/discovery-follow-ups/source-options')
      .expect(200)
      .expect([]);

    await request(app.getHttpServer()).post(`/projects/${projectId}/archive`).expect(201);

    await request(app.getHttpServer())
      .get('/projects/' + projectId + '/discovery-follow-ups/source-options')
      .expect(200)
      .expect([]);
  });

  it('adds, replaces, and removes a discovery follow-up source with one version and redacted audit per write', async () => {
    const projectId = await createProject('discovery-follow-up-source-link-mutations');
    const firstSource = await createInitialIntakeSource(projectId);
    const followUp = await createDiscoveryFollowUp(projectId, 'source-link-mutations');

    const added = await request(app.getHttpServer())
      .put(
        '/projects/' +
          projectId +
          '/discovery-follow-ups/' +
          followUp.id +
          '/source-link',
      )
      .send({
        sourceSnapshotId: firstSource.snapshot.id,
        expectedVersion: followUp.version,
      })
      .expect(200);

    assert.equal(added.body.version, followUp.version + 1);
    assert.deepEqual(added.body.source, {
      snapshotId: firstSource.snapshot.id,
      order: firstSource.snapshot.order,
      topic: firstSource.snapshot.topic,
      controlPoint: firstSource.snapshot.controlPoint,
    });

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${firstSource.roundId}/complete`)
      .expect(201);
    const currentRound = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const currentSource = currentRound.body.questions[0] as InitialIntakeSnapshot;

    const replaced = await request(app.getHttpServer())
      .put(
        '/projects/' +
          projectId +
          '/discovery-follow-ups/' +
          followUp.id +
          '/source-link',
      )
      .send({
        sourceSnapshotId: currentSource.id,
        expectedVersion: added.body.version,
      })
      .expect(200);

    assert.equal(replaced.body.version, added.body.version + 1);
    assert.deepEqual(replaced.body.source, {
      snapshotId: currentSource.id,
      order: currentSource.order,
      topic: currentSource.topic,
      controlPoint: currentSource.controlPoint,
    });

    const removed = await request(app.getHttpServer())
      .put(
        '/projects/' +
          projectId +
          '/discovery-follow-ups/' +
          followUp.id +
          '/source-link',
      )
      .send({
        sourceSnapshotId: null,
        expectedVersion: replaced.body.version,
      })
      .expect(200);

    assert.equal(removed.body.version, replaced.body.version + 1);
    assert.equal(removed.body.source, null);

    const auditRows = await dataSource.query<
      Array<{ event_type: string; payload: Record<string, unknown> }>
    >(
      'SELECT "event_type", "payload" FROM "audit_events" WHERE "project_id" = $1 AND "event_type" = $2 ORDER BY "created_at" ASC, "id" ASC',
      [projectId, 'DISCOVERY_FOLLOW_UP_SOURCE_LINK_CHANGED'],
    );
    assert.deepEqual(auditRows, [
      {
        event_type: 'DISCOVERY_FOLLOW_UP_SOURCE_LINK_CHANGED',
        payload: {
          followUpId: followUp.id,
          sourceAction: 'ADDED',
          sourceOrder: String(firstSource.snapshot.order),
          sourceTopic: firstSource.snapshot.topic,
          sourceControlPoint: firstSource.snapshot.controlPoint,
        },
      },
      {
        event_type: 'DISCOVERY_FOLLOW_UP_SOURCE_LINK_CHANGED',
        payload: {
          followUpId: followUp.id,
          sourceAction: 'REPLACED',
          previousSourceOrder: String(firstSource.snapshot.order),
          previousSourceTopic: firstSource.snapshot.topic,
          previousSourceControlPoint: firstSource.snapshot.controlPoint,
          sourceOrder: String(currentSource.order),
          sourceTopic: currentSource.topic,
          sourceControlPoint: currentSource.controlPoint,
        },
      },
      {
        event_type: 'DISCOVERY_FOLLOW_UP_SOURCE_LINK_CHANGED',
        payload: {
          followUpId: followUp.id,
          sourceAction: 'REMOVED',
          previousSourceOrder: String(currentSource.order),
          previousSourceTopic: currentSource.topic,
          previousSourceControlPoint: currentSource.controlPoint,
        },
      },
    ]);
    for (const forbidden of [
      firstSource.snapshot.id,
      currentSource.id,
      firstSource.snapshot.text,
      currentSource.text,
      'Question for source-link-mutations',
    ]) {
      assertNoSubmittedValues(auditRows, forbidden);
    }
  });

  it('returns same-target and already-empty source-link requests as no-ops without version or audit changes', async () => {
    const projectId = await createProject('discovery-follow-up-source-link-no-op');
    const source = await createInitialIntakeSource(projectId);
    const linkedFollowUp = await createDiscoveryFollowUp(projectId, 'source-link-no-op');
    const added = await request(app.getHttpServer())
      .put(`/projects/${projectId}/discovery-follow-ups/${linkedFollowUp.id}/source-link`)
      .send({
        sourceSnapshotId: source.snapshot.id,
        expectedVersion: linkedFollowUp.version,
      })
      .expect(200);

    const sameTarget = await request(app.getHttpServer())
      .put(`/projects/${projectId}/discovery-follow-ups/${linkedFollowUp.id}/source-link`)
      .send({
        sourceSnapshotId: source.snapshot.id,
        expectedVersion: added.body.version,
      })
      .expect(200);
    assert.equal(sameTarget.body.version, added.body.version);
    assert.deepEqual(sameTarget.body.source, added.body.source);
    assert.equal(await countDiscoveryFollowUpSourceLinkAudit(projectId), 1);

    const emptyFollowUp = await createDiscoveryFollowUp(projectId, 'source-link-empty-no-op');
    const alreadyEmpty = await request(app.getHttpServer())
      .put(`/projects/${projectId}/discovery-follow-ups/${emptyFollowUp.id}/source-link`)
      .send({ sourceSnapshotId: null, expectedVersion: emptyFollowUp.version })
      .expect(200);
    assert.equal(alreadyEmpty.body.version, emptyFollowUp.version);
    assert.equal(alreadyEmpty.body.source, null);
    assert.equal(await countDiscoveryFollowUpSourceLinkAudit(projectId), 1);
  });

  it('keeps a historical same-target source as a no-op but rejects a different non-current snapshot', async () => {
    const projectId = await createProject('discovery-follow-up-historical-source-no-op');
    const firstRound = await createInitialIntakeSources(projectId, 2);
    const linked = await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups`)
      .send({
        category: 'BUSINESS',
        question: 'Which historical source must remain stable?',
        owner: 'Product owner',
        dueDate: '2026-10-01',
        nextStep: 'Keep the established provenance.',
        sourceSnapshotId: firstRound.snapshots[0]?.id,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${firstRound.roundId}/complete`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);

    const sameTarget = await request(app.getHttpServer())
      .put(`/projects/${projectId}/discovery-follow-ups/${linked.body.id}/source-link`)
      .send({
        sourceSnapshotId: firstRound.snapshots[0]?.id,
        expectedVersion: linked.body.version,
      })
      .expect(200);
    assert.equal(sameTarget.body.version, linked.body.version);
    assert.deepEqual(sameTarget.body.source, linked.body.source);

    await request(app.getHttpServer())
      .put(`/projects/${projectId}/discovery-follow-ups/${linked.body.id}/source-link`)
      .send({
        sourceSnapshotId: firstRound.snapshots[1]?.id,
        expectedVersion: linked.body.version,
      })
      .expect(409);
    assert.equal(await countDiscoveryFollowUpSourceLinkAudit(projectId), 0);
  });

  it('rejects invalid source-link commands without changing relationship data or exposing submitted values', async () => {
    const projectId = await createProject('discovery-follow-up-source-link-invalid');
    const historicalSource = await createInitialIntakeSource(projectId);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${historicalSource.roundId}/complete`)
      .expect(201);
    const currentRound = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const currentSource = currentRound.body.questions[0] as InitialIntakeSnapshot;
    const followUp = await createDiscoveryFollowUp(projectId, 'source-link-invalid');
    const otherProjectId = await createProject('discovery-follow-up-source-link-foreign');
    const foreignSource = await createInitialIntakeSource(otherProjectId);
    const foreignFollowUp = await createDiscoveryFollowUp(
      otherProjectId,
      'source-link-foreign-follow-up',
    );
    const route = `/projects/${projectId}/discovery-follow-ups/${followUp.id}/source-link`;
    const errorBodies: unknown[] = [];

    errorBodies.push(
      (
        await request(app.getHttpServer())
          .put(route)
          .send({
            sourceSnapshotId: currentSource.id,
            expectedVersion: followUp.version + 1,
          })
          .expect(409)
      ).body,
    );

    await request(app.getHttpServer()).post(`/projects/${projectId}/archive`).expect(201);
    errorBodies.push(
      (
        await request(app.getHttpServer())
          .put(route)
          .send({
            sourceSnapshotId: currentSource.id,
            expectedVersion: followUp.version,
          })
          .expect(409)
      ).body,
    );
    await request(app.getHttpServer()).post(`/projects/${projectId}/restore`).expect(201);

    const malformedSourceMarker = 'private-source-free-text-marker';
    errorBodies.push(
      (
        await request(app.getHttpServer())
          .put(route)
          .send({
            sourceSnapshotId: malformedSourceMarker,
            expectedVersion: followUp.version,
          })
          .expect(400)
      ).body,
    );
    errorBodies.push(
      (
        await request(app.getHttpServer())
          .put(route)
          .send({ expectedVersion: followUp.version })
          .expect(400)
      ).body,
    );
    errorBodies.push(
      (
        await request(app.getHttpServer())
          .put(route)
          .send({ sourceSnapshotId: currentSource.id, expectedVersion: 0 })
          .expect(400)
      ).body,
    );
    errorBodies.push(
      (
        await request(app.getHttpServer())
          .put(route)
          .send({ sourceSnapshotId: currentSource.id })
          .expect(400)
      ).body,
    );

    const malformedFollowUpMarker = 'private-follow-up-free-text-marker';
    errorBodies.push(
      (
        await request(app.getHttpServer())
          .put(
            `/projects/${projectId}/discovery-follow-ups/${malformedFollowUpMarker}/source-link`,
          )
          .send({
            sourceSnapshotId: currentSource.id,
            expectedVersion: followUp.version,
          })
          .expect(400)
      ).body,
    );
    errorBodies.push(
      (
        await request(app.getHttpServer())
          .put(
            `/projects/${otherProjectId}/discovery-follow-ups/${followUp.id}/source-link`,
          )
          .send({
            sourceSnapshotId: foreignSource.snapshot.id,
            expectedVersion: followUp.version,
          })
          .expect(404)
      ).body,
    );
    errorBodies.push(
      (
        await request(app.getHttpServer())
          .put(
            `/projects/${projectId}/discovery-follow-ups/${foreignFollowUp.id}/source-link`,
          )
          .send({
            sourceSnapshotId: currentSource.id,
            expectedVersion: foreignFollowUp.version,
          })
          .expect(404)
      ).body,
    );
    for (const sourceSnapshotId of [
      foreignSource.snapshot.id,
      historicalSource.snapshot.id,
    ]) {
      errorBodies.push(
        (
          await request(app.getHttpServer())
            .put(route)
            .send({ sourceSnapshotId, expectedVersion: followUp.version })
            .expect(409)
        ).body,
      );
    }

    const rows = await dataSource.query<
      Array<{ source_snapshot_id: string | null; version: number }>
    >(
      'SELECT "source_snapshot_id", "version" FROM "discovery_follow_ups" WHERE "id" = $1',
      [followUp.id],
    );
    assert.deepEqual(rows, [{ source_snapshot_id: null, version: followUp.version }]);
    assert.equal(await countDiscoveryFollowUpSourceLinkAudit(projectId), 0);

    const serializedErrors = JSON.stringify(errorBodies);
    for (const submitted of [
      malformedSourceMarker,
      malformedFollowUpMarker,
      currentSource.id,
      foreignSource.snapshot.id,
      historicalSource.snapshot.id,
      followUp.id,
      foreignFollowUp.id,
    ]) {
      assertNoSubmittedValues(errorBodies, submitted);
    }
    assert.doesNotMatch(
      serializedErrors,
      /discovery_follow_ups|round_question_snapshots|\b(select|insert|update|delete|sql)\b|queryfailederror|stack trace/i,
    );
  });

  it('retains linked provenance after resolution and rejects direct source-link changes', async () => {
    const projectId = await createProject('discovery-follow-up-resolved-source-link');
    const source = await createInitialIntakeSource(projectId);
    const created = await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups`)
      .send({
        category: 'BUSINESS',
        question: 'Which resolved source remains authoritative?',
        owner: 'Product owner',
        dueDate: '2026-10-01',
        nextStep: 'Resolve with the linked evidence.',
        sourceSnapshotId: source.snapshot.id,
      })
      .expect(201);
    const resolved = await request(app.getHttpServer())
      .post(`/projects/${projectId}/discovery-follow-ups/${created.body.id}/resolve`)
      .send({
        status: 'Megválaszolva',
        decisionOrAnswer: 'The linked source supplied the answer.',
      })
      .expect(200);

    assert.deepEqual(resolved.body.source, created.body.source);
    const list = await request(app.getHttpServer())
      .get(`/projects/${projectId}/discovery-follow-ups`)
      .expect(200);
    const reloaded = list.body.find(
      (value: { id: string }) => value.id === created.body.id,
    ) as { source: unknown } | undefined;
    assert.deepEqual(reloaded?.source, created.body.source);

    const rejected = await request(app.getHttpServer())
      .put(`/projects/${projectId}/discovery-follow-ups/${created.body.id}/source-link`)
      .send({ sourceSnapshotId: null, expectedVersion: resolved.body.version })
      .expect(409);
    assert.equal(rejected.body.message, 'Discovery follow-up is not open.');
    assert.equal(await countDiscoveryFollowUpSourceLinkAudit(projectId), 0);
  });

  it('rejects a repeated original source-link version as stale before same-target no-op handling', async () => {
    const projectId = await createProject('discovery-follow-up-source-link-stale');
    const source = await createInitialIntakeSource(projectId);
    const followUp = await createDiscoveryFollowUp(projectId, 'source-link-stale');
    const command = {
      sourceSnapshotId: source.snapshot.id,
      expectedVersion: followUp.version,
    };

    const added = await request(app.getHttpServer())
      .put(`/projects/${projectId}/discovery-follow-ups/${followUp.id}/source-link`)
      .send(command)
      .expect(200);
    const stale = await request(app.getHttpServer())
      .put(`/projects/${projectId}/discovery-follow-ups/${followUp.id}/source-link`)
      .send(command)
      .expect(409);

    assert.equal(stale.body.message, 'Discovery follow-up has changed.');
    assert.equal(await countDiscoveryFollowUpSourceLinkAudit(projectId), 1);
    const list = await request(app.getHttpServer())
      .get(`/projects/${projectId}/discovery-follow-ups`)
      .expect(200);
    const reloaded = list.body.find(
      (value: { id: string }) => value.id === followUp.id,
    ) as { version: number; source: unknown } | undefined;
    assert.equal(reloaded?.version, added.body.version);
    assert.deepEqual(reloaded?.source, added.body.source);
  });

  it('creates an unlinked discovery follow-up without an Initial Intake source', async () => {
    const projectId = await createProject('discovery-follow-up-unlinked-without-source');

    const created = await request(app.getHttpServer())
      .post('/projects/' + projectId + '/discovery-follow-ups')
      .send({
        category: 'BUSINESS',
        question: 'Which decision still needs proof?',
        owner: 'Product owner',
        dueDate: '2026-10-01',
        nextStep: 'Review the available evidence.',
      })
      .expect(201);

    assert.equal(created.body.source, null);
  });

  it('rejects an explicit null sourceSnapshotId without echoing submitted free text', async () => {
    const projectId = await createProject('discovery-follow-up-null-source');
    const marker = 'null-source-free-text-marker';

    const response = await request(app.getHttpServer())
      .post('/projects/' + projectId + '/discovery-follow-ups')
      .send({
        category: 'BUSINESS',
        question: marker,
        owner: 'Product owner',
        dueDate: '2026-10-01',
        nextStep: 'Review the available evidence.',
        sourceSnapshotId: null,
      })
      .expect(400);

    assertNoSubmittedValues(response.body, marker);
  });

  it('rejects foreign and non-current source snapshots without follow-up creation or creation audit events', async () => {
    const projectId = await createProject('discovery-follow-up-invalid-source');
    const firstSource = await createInitialIntakeSource(projectId);
    const linked = await request(app.getHttpServer())
      .post('/projects/' + projectId + '/discovery-follow-ups')
      .send({
        category: 'BUSINESS',
        question: 'Which current decision still needs proof?',
        owner: 'Product owner',
        dueDate: '2026-10-01',
        nextStep: 'Review the intake evidence.',
        sourceSnapshotId: firstSource.snapshot.id,
      })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds/${firstSource.roundId}/complete`)
      .expect(201);
    const currentRound = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    const currentSource = currentRound.body.questions[0] as { id: string };
    const foreignProjectId = await createProject('discovery-follow-up-foreign-source');
    const foreignSource = await createInitialIntakeSource(foreignProjectId);

    const reloaded = await request(app.getHttpServer())
      .get('/projects/' + projectId + '/discovery-follow-ups')
      .expect(200);
    assert.deepEqual(reloaded.body[0]?.source, {
      snapshotId: firstSource.snapshot.id,
      order: firstSource.snapshot.order,
      topic: firstSource.snapshot.topic,
      controlPoint: firstSource.snapshot.controlPoint,
    });

    for (const sourceSnapshotId of [firstSource.snapshot.id, foreignSource.snapshot.id]) {
      await request(app.getHttpServer())
        .post('/projects/' + projectId + '/discovery-follow-ups')
        .send({
          category: 'BUSINESS',
          question: 'Which invalid source must not persist?',
          owner: 'Product owner',
          dueDate: '2026-10-01',
          nextStep: 'Review the intake evidence.',
          sourceSnapshotId,
        })
        .expect(409);
    }

    assert.notEqual(currentSource.id, firstSource.snapshot.id);
    const followUpRows = await dataSource.query<Array<{ count: string }>>(
      'SELECT COUNT(*)::text AS "count" FROM "discovery_follow_ups" WHERE "project_id" = $1',
      [projectId],
    );
    assert.equal(followUpRows[0]?.count, '1');
    const auditRows = await dataSource.query<Array<{ count: string }>>(
      'SELECT COUNT(*)::text AS "count" FROM "audit_events" WHERE "project_id" = $1 AND "event_type" = $2',
      [projectId, 'DISCOVERY_FOLLOW_UP_CREATED'],
    );
    assert.equal(auditRows[0]?.count, '1');
    assert.equal(linked.body.id, reloaded.body[0]?.id);
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
    assert.equal(later.body.source, null);
    assert.equal(later.body.version, 1);
    assert.equal(earlier.body.version, 1);
    assert.equal(earlier.body.source, null);

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
    ) as {
      decisionOrAnswer: string | null;
      version: number;
      source: null;
    } | undefined;
    if (!reloadedLater) {
      throw new Error('created discovery follow-up was not returned after reload');
    }
    assert.equal(reloadedLater.decisionOrAnswer, null);
    assert.equal(reloadedLater.source, null);
    assert.equal(reloadedLater.version, 1);

    const rejectedPatch = await request(app.getHttpServer())
      .patch('/projects/' + projectId + '/discovery-follow-ups/' + later.body.id)
      .send({
        category: later.body.category,
        question: later.body.question,
        owner: later.body.owner,
        dueDate: later.body.dueDate,
        nextStep: later.body.nextStep,
        expectedVersion: later.body.version,
        sourceSnapshotId: '00000000-0000-4000-8000-000000000099',
      })
      .expect(400);

    assertNoSubmittedValues(
      rejectedPatch.body,
      '00000000-0000-4000-8000-000000000099',
    );

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

  it('returns one safe, deterministic queue of open discovery follow-ups from active projects', async () => {
    const firstProjectId = await createProject('open-follow-up-queue-first');
    const secondProjectId = await createProject('open-follow-up-queue-second');
    const archivedProjectId = await createProject('open-follow-up-queue-archived');
    await dataSource.query('UPDATE "projects" SET "name" = $2 WHERE "id" = $1', [
      firstProjectId,
      'Alfa bevezetés',
    ]);
    await dataSource.query('UPDATE "projects" SET "name" = $2 WHERE "id" = $1', [
      secondProjectId,
      'Béta átállás',
    ]);

    const later = await request(app.getHttpServer())
      .post(`/projects/${firstProjectId}/discovery-follow-ups`)
      .send({
        category: 'INTEGRATION',
        question: 'Melyik rendszer adja át az ügyfélazonosítót?',
        owner: 'Integrációs felelős',
        dueDate: '2026-09-12',
        nextStep: 'Egyeztetés az integrációs csapattal.',
      })
      .expect(201);
    const earlier = await request(app.getHttpServer())
      .post(`/projects/${secondProjectId}/discovery-follow-ups`)
      .send({
        category: 'BUSINESS',
        question: 'Ki hagyja jóvá az üzleti szabályt?',
        owner: 'Termékgazda',
        dueDate: '2026-09-10',
        nextStep: 'Jóváhagyó kijelölése.',
      })
      .expect(201);
    const resolved = await createDiscoveryFollowUp(
      firstProjectId,
      'open-follow-up-queue-resolved',
    );
    await request(app.getHttpServer())
      .post(`/projects/${firstProjectId}/discovery-follow-ups/${resolved.id}/resolve`)
      .send({
        status: 'Megválaszolva',
        decisionOrAnswer: 'A kérdés lezárva.',
      })
      .expect(200);
    const archived = await createDiscoveryFollowUp(
      archivedProjectId,
      'open-follow-up-queue-archived',
    );
    await request(app.getHttpServer())
      .post(`/projects/${archivedProjectId}/archive`)
      .expect(201);

    const queue = await request(app.getHttpServer())
      .get('/discovery-follow-ups/open')
      .expect(200);

    const ownOpenItems = queue.body.filter(
      (item: { projectId: string }) =>
        item.projectId === firstProjectId || item.projectId === secondProjectId,
    );
    assert.deepEqual(ownOpenItems, [
      {
        id: earlier.body.id,
        projectId: secondProjectId,
        projectName: 'Béta átállás',
        category: 'BUSINESS',
        question: 'Ki hagyja jóvá az üzleti szabályt?',
        owner: 'Termékgazda',
        dueDate: '2026-09-10',
        nextStep: 'Jóváhagyó kijelölése.',
      },
      {
        id: later.body.id,
        projectId: firstProjectId,
        projectName: 'Alfa bevezetés',
        category: 'INTEGRATION',
        question: 'Melyik rendszer adja át az ügyfélazonosítót?',
        owner: 'Integrációs felelős',
        dueDate: '2026-09-12',
        nextStep: 'Egyeztetés az integrációs csapattal.',
      },
    ]);
    assert.equal(
      queue.body.some((item: { id: string }) => item.id === resolved.id),
      false,
    );
    assert.equal(
      queue.body.some((item: { id: string }) => item.id === archived.id),
      false,
    );
    const expectedFields = [
      'category',
      'dueDate',
      'id',
      'nextStep',
      'owner',
      'projectId',
      'projectName',
      'question',
    ];
    for (const item of queue.body as Array<Record<string, unknown>>) {
      assert.deepEqual(Object.keys(item).sort(), expectedFields);
    }
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
        internalOwnerName: 'Test PO/PM',
        nextActionOwnerRole: 'INTERNAL_OWNER',
      })
      .expect(201);

    return response.body.id as string;
  }

  async function createInitialIntakeSource(
    projectId: string,
  ): Promise<{
    readonly roundId: string;
    readonly snapshot: InitialIntakeSnapshot;
  }> {
    const source = await createInitialIntakeSources(projectId, 1);
    const snapshot = source.snapshots[0];
    if (!snapshot) {
      throw new Error('Initial Intake round did not provide a source snapshot.');
    }
    return { roundId: source.roundId, snapshot };
  }

  async function createCanonicalDecisionReviewRound(
    projectId: string,
    skippedStableKeys = new Set<string>(),
  ): Promise<string> {
    const policy = await loadGeneralPlaybookV1();
    await request(app.getHttpServer())
      .post(`/projects/${projectId}/question-schema`)
      .send({
        questions: policy.items.map((item) => ({
          stableKey: `${policy.id}-${String(item.id).padStart(3, '0')}`,
          required: item.requiredForEstimate,
          blocking: item.blockingIfMissing,
        })),
      })
      .expect(201);
    const round = await request(app.getHttpServer())
      .post(`/projects/${projectId}/rounds`)
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);

    for (const question of round.body.questions as DecisionReviewSnapshot[]) {
      if (skippedStableKeys.has(question.stableKey)) {
        continue;
      }
      await request(app.getHttpServer())
        .patch(`/projects/${projectId}/rounds/${round.body.id}/answers/${question.id}`)
        .send({ value: decisionReviewAnswer(question) })
        .expect(200);
    }
    return round.body.id as string;
  }

  function decisionReviewAnswer(question: DecisionReviewSnapshot): AnswerValue {
    if (question.type === 'TEXT' || question.type === 'LONG_TEXT') {
      return `Decision Review evidence for ${question.stableKey}`;
    }
    if (question.type === 'BOOLEAN') {
      return true;
    }
    if (question.type === 'NUMBER') {
      return 1;
    }
    if (question.type === 'DATE') {
      return '2026-08-10';
    }
    const option = question.options?.[0];
    if (!option) {
      throw new Error(`Decision Review question ${question.stableKey} has no selectable option.`);
    }
    return question.type === 'SINGLE_SELECT' ? option : [option];
  }

  function decisionReviewDimensions(): readonly Record<string, unknown>[] {
    return [
      { id: 'businessValue', weight: 0.25, inverted: false },
      { id: 'strategicAlignment', weight: 0.15, inverted: false },
      { id: 'urgency', weight: 0.15, inverted: false },
      { id: 'confidence', weight: 0.15, inverted: false },
      { id: 'complexity', weight: 0.1, inverted: true },
      { id: 'risk', weight: 0.1, inverted: true },
    ];
  }

  async function createInitialIntakeSources(
    projectId: string,
    count: number,
  ): Promise<{
    readonly roundId: string;
    readonly snapshots: readonly InitialIntakeSnapshot[];
  }> {
    const bank = await request(app.getHttpServer()).get('/settings/base-questions').expect(200);
    const stableKeys = (bank.body.questions as Array<{ stableKey?: string }>)
      .slice(0, count)
      .map((question) => question.stableKey);
    if (stableKeys.length !== count || stableKeys.some((stableKey) => !stableKey)) {
      throw new Error('Seeded question bank did not provide enough source stable keys.');
    }
    await request(app.getHttpServer())
      .post('/projects/' + projectId + '/question-schema')
      .send({
        questions: stableKeys.map((stableKey) => ({
          stableKey,
          required: false,
          blocking: false,
        })),
      })
      .expect(201);
    const round = await request(app.getHttpServer())
      .post('/projects/' + projectId + '/rounds')
      .send({ type: 'INITIAL_INTAKE' })
      .expect(201);
    return { roundId: round.body.id, snapshots: round.body.questions };
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

  async function countDiscoveryFollowUpSourceLinkAudit(
    projectId: string,
  ): Promise<number> {
    const rows = await dataSource.query<Array<{ count: string }>>(
      'SELECT COUNT(*)::text AS "count" FROM "audit_events" WHERE "project_id" = $1 AND "event_type" = $2',
      [projectId, 'DISCOVERY_FOLLOW_UP_SOURCE_LINK_CHANGED'],
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
