import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { AuditEvent } from '../src/audit/audit-event.entity';

describe('Internal account session boundary (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  before(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['AUTH_TEST_ENFORCEMENT'] = 'true';
    process.env['CORS_ORIGIN'] = 'http://127.0.0.1:4200';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    dataSource = app.get(DataSource);
    assert.ok(
      dataSource.subscribers.some(
        (subscriber) => subscriber.constructor.name === 'AuditActorSubscriber',
      ),
    );
  });

  after(async () => {
    await app.close();
  });

  it('protects the app with a self-created cookie session that logout revokes', async () => {
    const agent = request.agent(app.getHttpServer());
    const email = `internal-${randomUUID()}@example.test`;
    const password = 'helyes-lo-akkumulator-kapocs-42';

    await request(app.getHttpServer()).get('/health').expect(200);
    await agent.get('/projects').expect(401);

    const signUp = await agent
      .post('/auth/signup')
      .set('Origin', 'http://127.0.0.1:4200')
      .send({ email, password })
      .expect(201);

    assert.equal(signUp.body.email, email);
    assert.equal(typeof signUp.body.id, 'string');
    assert.match(signUp.headers['set-cookie']?.[0] ?? '', /HttpOnly/i);
    assert.match(signUp.headers['set-cookie']?.[0] ?? '', /SameSite=Strict/i);

    await agent.get('/projects').expect(200);
    await agent
      .post('/auth/logout')
      .set('Origin', 'http://127.0.0.1:4200')
      .expect(204);
    await agent.get('/projects').expect(401);
  });

  it('supports login, password change, self-deactivation, and credential-based restore', async () => {
    const origin = 'http://127.0.0.1:4200';
    const email = `lifecycle-${randomUUID()}@example.test`;
    const firstPassword = 'elso-biztonsagos-jelszo-42';
    const nextPassword = 'masodik-biztonsagos-jelszo-84';
    const agent = request.agent(app.getHttpServer());

    await agent.post('/auth/signup').set('Origin', origin).send({ email, password: firstPassword }).expect(201);
    await agent
      .post('/auth/password')
      .set('Origin', origin)
      .send({ currentPassword: firstPassword, newPassword: nextPassword })
      .expect(200);
    await agent.post('/auth/logout').set('Origin', origin).expect(204);

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', origin)
      .send({ email, password: firstPassword })
      .expect(401);
    await agent
      .post('/auth/login')
      .set('Origin', origin)
      .send({ email, password: nextPassword })
      .expect(200);
    await agent.post('/auth/deactivate').set('Origin', origin).expect(204);
    await agent.get('/projects').expect(401);

    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', origin)
      .send({ email, password: nextPassword })
      .expect(401);
    await agent
      .post('/auth/restore')
      .set('Origin', origin)
      .send({ email, password: nextPassword })
      .expect(200);
    await agent.get('/projects').expect(200);
  });

  it('rejects unsafe requests from any origin other than the configured app', async () => {
    const credentials = {
      email: `origin-${randomUUID()}@example.test`,
      password: 'eredet-ellenorzott-jelszo-42',
    };

    await request(app.getHttpServer()).post('/auth/signup').send(credentials).expect(403);
    await request(app.getHttpServer())
      .post('/auth/signup')
      .set('Origin', 'http://127.0.0.1:4300')
      .send(credentials)
      .expect(403);
    await request(app.getHttpServer())
      .post('/auth/signup')
      .set('Origin', 'http://127.0.0.1:4200')
      .send(credentials)
      .expect(201);
  });

  it('bounds repeated authentication attempts without exposing account existence', async () => {
    const credentials = {
      email: `rate-limit-${randomUUID()}@example.test`,
      password: 'hibas-de-ervenyes-jelszo-42',
    };
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .set('Origin', 'http://127.0.0.1:4200')
        .send(credentials)
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/auth/login')
      .set('Origin', 'http://127.0.0.1:4200')
      .send(credentials)
      .expect(429);
  });

  it('attributes project audit events to the authenticated internal user', async () => {
    const origin = 'http://127.0.0.1:4200';
    const agent = request.agent(app.getHttpServer());
    const signUp = await agent
      .post('/auth/signup')
      .set('Origin', origin)
      .send({
        email: `audit-${randomUUID()}@example.test`,
        password: 'audit-aktor-jelszo-42',
      })
      .expect(201);
    const project = await agent
      .post('/projects')
      .set('Origin', origin)
      .send({
        name: `Audit actor ${randomUUID()}`,
        customerContactName: 'Audit Customer',
        customerContactEmail: 'audit-customer@example.test',
        internalOwnerName: 'Audit PO',
        nextActionOwnerRole: 'INTERNAL_OWNER',
      })
      .expect(201);

    await agent.post(`/projects/${project.body.id as string}/archive`).set('Origin', origin).expect(201);
    const auditEvent = await dataSource.getRepository(AuditEvent).findOneByOrFail({
      projectId: project.body.id as string,
      eventType: 'PROJECT_ARCHIVED',
    });
    assert.equal(auditEvent.actorId, signUp.body.id);
  });
});
