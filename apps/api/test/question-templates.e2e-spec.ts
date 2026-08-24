import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('Question Template Library (e2e)', () => {
  let app: INestApplication;

  before(async () => {
    process.env['NODE_ENV'] = 'test';
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
  });

  after(async () => app.close());

  it('starts with a published complete General v1 Question Template', async () => {
    const templates = await request(app.getHttpServer())
      .get('/settings/question-templates')
      .expect(200);
    const defaultTemplate = (templates.body as Array<{
      name: string;
      latestPublishedVersion: number | null;
      latestPublishedQuestions: Array<{ stableKey: string }> | null;
    }>).find((template) => template.name === 'Complete General Discovery');

    assert.ok(defaultTemplate);
    assert.equal(defaultTemplate.latestPublishedVersion, 1);
    assert.deepEqual(
      defaultTemplate.latestPublishedQuestions?.map((question) => question.stableKey),
      Array.from({ length: 30 }, (_, index) => `general-${String(index + 1).padStart(3, '0')}`),
    );
  });

  it('publishes a reusable template and retains its provenance on the Project schema', async () => {
    const bank = await request(app.getHttpServer()).get('/settings/base-questions').expect(200);
    const activeQuestions = (bank.body.questions as Array<{ stableKey: string; active: boolean }>)
      .filter((question) => question.active)
      .slice(0, 2);
    assert.equal(activeQuestions.length, 2);
    const name = `Focused discovery ${randomUUID()}`;
    const questions = activeQuestions.map((question, index) => ({
      stableKey: question.stableKey,
      required: index === 0,
      blocking: index === 0,
    }));

    const created = await request(app.getHttpServer())
      .post('/settings/question-templates')
      .send({ name, questions })
      .expect(201);
    assert.equal(created.body.state, 'DRAFT');
    assert.equal(created.body.latestPublishedVersion, null);

    const published = await request(app.getHttpServer())
      .post(`/settings/question-templates/${created.body.id as string}/publish`)
      .expect(201);
    assert.equal(published.body.state, 'PUBLISHED');
    assert.equal(published.body.latestPublishedVersion, 1);

    const projectName = `Template Project ${randomUUID()}`;
    const project = await request(app.getHttpServer()).post('/projects').send({
      name: projectName,
      customerContactName: 'Customer Contact',
      customerContactEmail: `template-${Date.now()}@example.test`,
      internalOwnerName: 'Internal Owner',
      nextActionOwnerRole: 'INTERNAL_OWNER',
      questionTemplateId: created.body.id,
    }).expect(201);
    assert.equal(project.body.questionTemplateId, created.body.id);

    const focused = await request(app.getHttpServer())
      .put(`/settings/question-templates/${created.body.id as string}/draft`)
      .send({ name, questions, focusedProjectId: project.body.id })
      .expect(200);
    assert.deepEqual(focused.body.focusedProject, {
      id: project.body.id,
      name: projectName,
    });
    const schema = await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/question-schema`)
      .send({ questionTemplateId: created.body.id })
      .expect(201);

    assert.deepEqual(schema.body.questionTemplate, {
      id: created.body.id,
      name,
      version: 1,
    });
    assert.deepEqual(
      schema.body.questions.map((question: { stableKey: string }) => question.stableKey),
      questions.map((question) => question.stableKey),
    );

    const templates = await request(app.getHttpServer())
      .get('/settings/question-templates')
      .expect(200);
    const summary = (templates.body as Array<{
      id: string;
      assignedProjects: Array<{ projectId: string; projectName: string }>;
    }>).find((template) => template.id === created.body.id);
    assert.ok(summary);
    assert.deepEqual(summary.assignedProjects, [{
      projectId: project.body.id,
      projectName,
      schemaVersion: 1,
    }]);

    const changed = await request(app.getHttpServer())
      .put(`/settings/question-templates/${created.body.id as string}/draft`)
      .send({ name, questions: [questions[0]] })
      .expect(200);
    assert.equal(changed.body.state, 'CHANGES_PENDING');

    const retainedSchema = await request(app.getHttpServer())
      .get(`/projects/${project.body.id as string}/question-schema`)
      .expect(200);
    assert.equal(retainedSchema.body.questions.length, 2);
    assert.equal(retainedSchema.body.questionTemplate.version, 1);

    await request(app.getHttpServer())
      .delete(`/settings/question-templates/${created.body.id as string}`)
      .expect(204);
    const afterDelete = await request(app.getHttpServer())
      .get('/settings/question-templates')
      .expect(200);
    assert.equal(
      (afterDelete.body as Array<{ id: string }>).some((item) => item.id === created.body.id),
      false,
    );
    const historyAfterDelete = await request(app.getHttpServer())
      .get(`/projects/${project.body.id as string}/question-schema`)
      .expect(200);
    assert.equal(historyAfterDelete.body.questionTemplate.version, 1);
    await request(app.getHttpServer())
      .post('/settings/question-templates')
      .send({ name, questions })
      .expect(201);
  });

  it('rejects unpublished templates and ambiguous Project schema inputs', async () => {
    const bank = await request(app.getHttpServer()).get('/settings/base-questions').expect(200);
    const stableKey = (bank.body.questions as Array<{ stableKey: string; active: boolean }>)
      .find((question) => question.active)?.stableKey;
    assert.ok(stableKey);
    const template = await request(app.getHttpServer())
      .post('/settings/question-templates')
      .send({ name: `Draft only ${randomUUID()}`, questions: [{ stableKey }] })
      .expect(201);
    const project = await request(app.getHttpServer()).post('/projects').send({
      name: `Rejected Template Project ${randomUUID()}`,
      customerContactName: 'Customer Contact',
      customerContactEmail: `template-rejected-${Date.now()}@example.test`,
      internalOwnerName: 'Internal Owner',
      nextActionOwnerRole: 'INTERNAL_OWNER',
    }).expect(201);

    await request(app.getHttpServer()).post('/projects').send({
      name: `Unpublished Selection ${randomUUID()}`,
      customerContactName: 'Customer Contact',
      customerContactEmail: `unpublished-${Date.now()}@example.test`,
      internalOwnerName: 'Internal Owner',
      questionTemplateId: template.body.id,
    }).expect(400);

    await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/question-schema`)
      .send({ questionTemplateId: template.body.id })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/question-schema`)
      .send({ questionTemplateId: template.body.id, questions: [{ stableKey }] })
      .expect(400);
  });
});
