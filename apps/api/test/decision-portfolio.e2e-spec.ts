import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('Decision and portfolio (e2e)', () => {
  let app: INestApplication;

  before(async () => {
    process.env['NODE_ENV'] = 'test';
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  after(async () => app.close());

  it('connects roadmap grouping, editable-latest status, human decision, and bounded Portfolio filters', async () => {
    const project = await request(app.getHttpServer()).post('/projects').send({
      name: `Portfolio project ${randomUUID()}`,
      customerContactName: 'Customer',
      customerContactEmail: 'portfolio@example.test',
      internalOwnerName: 'Portfolio PO',
      nextActionOwnerRole: 'INTERNAL_OWNER',
      nextAction: 'Döntés véglegesítése',
      dueAt: '2026-09-10T12:00:00.000Z',
    }).expect(201);

    const goal = await request(app.getHttpServer()).post('/roadmap/goals').send({
      name: `Ügyfélélmény ${randomUUID()}`,
      description: 'Gyorsabb belső döntések.',
    }).expect(201);
    const initiative = await request(app.getHttpServer()).post(`/roadmap/goals/${goal.body.id as string}/initiatives`).send({
      name: 'Projektindítás egyszerűsítése',
      description: 'A discovery és döntés átfutási idejének csökkentése.',
    }).expect(201);
    await request(app.getHttpServer())
      .put(`/projects/${project.body.id as string}/initiative`)
      .send({ initiativeId: initiative.body.id })
      .expect(200);

    const firstStatus = await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/status-updates`)
      .send({
        health: 'AT_RISK',
        summary: 'A külső függőség még nyitott.',
        changes: 'A scope pontosítva.',
        risks: 'API szerződés késik.',
        nextStep: 'Szerződés egyeztetése.',
      })
      .expect(201);
    const editedStatus = await request(app.getHttpServer())
      .put(`/projects/${project.body.id as string}/status-updates/${firstStatus.body.id as string}`)
      .send({
        health: 'BLOCKED',
        summary: 'Az API szerződés nélkül a munka áll.',
        changes: 'A belső scope lezárva.',
        risks: 'Külső rendszer válasza hiányzik.',
        nextStep: 'Beszállítói döntés kérése.',
      })
      .expect(200);
    assert.equal(editedStatus.body.version, 1);
    const successor = await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/status-updates`)
      .send({ health: 'BLOCKED', summary: 'A beszállítói döntésre várunk.', nextStep: 'Eskaláció.' })
      .expect(201);
    assert.equal(successor.body.version, 2);
    await request(app.getHttpServer())
      .put(`/projects/${project.body.id as string}/status-updates/${firstStatus.body.id as string}`)
      .send({ health: 'ON_TRACK', summary: 'Elavult módosítás.', nextStep: 'Nincs.' })
      .expect(409);

    const decision = await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/decisions`)
      .send({
        outcome: 'GO',
        decisionDate: '2026-08-21',
        decisionMaker: 'Terméktanács',
        rationale: 'A várható ügyfélérték igazolja a folytatást.',
        referenceDecisionReview: true,
      })
      .expect(201);
    assert.equal(decision.body.version, 1);

    const portfolio = await request(app.getHttpServer())
      .get('/projects/portfolio-page')
      .query({ goalId: goal.body.id, health: 'BLOCKED', decision: 'GO', sort: 'NAME', page: 1, pageSize: 10 })
      .expect(200);
    assert.equal(portfolio.body.totalCount, 1);
    assert.equal(portfolio.body.items[0].project.id, project.body.id);
    assert.equal(portfolio.body.items[0].goal.id, goal.body.id);
    assert.equal(portfolio.body.items[0].initiative.id, initiative.body.id);
    assert.equal(portfolio.body.items[0].latestStatus.version, 2);
    assert.equal(portfolio.body.items[0].latestDecision.outcome, 'GO');

    await request(app.getHttpServer()).delete(`/roadmap/goals/${goal.body.id as string}`).expect(204);
    const roadmap = await request(app.getHttpServer()).get('/roadmap').expect(200);
    assert.ok(roadmap.body.unassignedProjects.some((item: { id: string }) => item.id === project.body.id));

    await request(app.getHttpServer()).post(`/projects/${project.body.id as string}/archive`).expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/status-updates`)
      .send({ health: 'ON_TRACK', summary: 'Nem írható.', nextStep: 'Nincs.' })
      .expect(409);
    await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/decisions`)
      .send({
        outcome: 'NO_GO',
        decisionDate: '2026-08-21',
        decisionMaker: 'Terméktanács',
        rationale: 'Nem írható.',
      })
      .expect(409);
  });
});
