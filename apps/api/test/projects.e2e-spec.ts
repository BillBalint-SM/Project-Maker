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
});

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
