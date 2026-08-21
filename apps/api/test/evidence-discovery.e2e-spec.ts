import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('Evidence-based discovery (e2e)', () => {
  let app: INestApplication;

  before(async () => {
    process.env['NODE_ENV'] = 'test';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  after(async () => {
    await app.close();
  });

  it('connects playbook selection, contacts, independent rounds, inline evidence, insights, and attachments', async () => {
    const project = await request(app.getHttpServer())
      .post('/projects')
      .send({
        name: `Integration discovery ${randomUUID()}`,
        customerContactName: 'Customer Contact',
        customerContactEmail: 'customer@example.test',
        internalOwnerName: 'Internal PO',
        nextActionOwnerRole: 'INTERNAL_OWNER',
        playbookId: 'system-integration',
        playbookVersion: 1,
      })
      .expect(201);
    assert.equal(project.body.playbook.id, 'system-integration');
    assert.equal(project.body.playbook.version, 1);

    const contact = await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/contacts`)
      .send({
        name: 'Integration Expert',
        email: 'expert@example.test',
        phone: '+36 30 123 4567',
        note: 'Knows the source system.',
      })
      .expect(201);
    const updatedContact = await request(app.getHttpServer())
      .patch(`/projects/${project.body.id as string}/contacts/${contact.body.id as string}`)
      .send({
        name: 'Integration Expert',
        email: 'expert@example.test',
        phone: '+36 30 123 4567',
        note: 'Owns the source system contract.',
      })
      .expect(200);
    assert.equal(updatedContact.body.note, 'Owns the source system contract.');

    const bank = await request(app.getHttpServer()).get('/settings/base-questions').expect(200);
    const integrationQuestions = bank.body.questions.filter((question: { stableKey: string }) =>
      question.stableKey.startsWith('system-integration-'),
    );
    assert.ok(integrationQuestions.length >= 3);
    await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/question-schema`)
      .send({
        questions: integrationQuestions.map((question: { stableKey: string }) => ({
          stableKey: question.stableKey,
          required: true,
          blocking: false,
        })),
      })
      .expect(201);

    const stakeholderRound = await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/rounds`)
      .send({
        type: 'STAKEHOLDER',
        selectedStableKeys: [integrationQuestions[0].stableKey],
      })
      .expect(201);
    const clarificationRound = await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/rounds`)
      .send({
        type: 'CLARIFICATION',
        adHocQuestions: [
          {
            text: 'Melyik rendszer a master adatforrás?',
            topic: 'Adatgazda',
          },
        ],
      })
      .expect(201);
    assert.equal(stakeholderRound.body.questions.length, 1);
    assert.equal(clarificationRound.body.questions.length, 1);
    await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/rounds`)
      .send({ type: 'STAKEHOLDER', selectedStableKeys: [integrationQuestions[1].stableKey] })
      .expect(409);

    const snapshotId = stakeholderRound.body.questions[0].id as string;
    await request(app.getHttpServer())
      .patch(
        `/projects/${project.body.id as string}/rounds/${stakeholderRound.body.id as string}/answers/${snapshotId}`,
      )
      .send({ value: 'A szerződéses REST API az elsődleges integrációs pont.' })
      .expect(200);

    const insight = await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/insights`)
      .send({
        statement: 'Az első szállítás egyetlen REST integrációra szűkíthető.',
        sources: [
          {
            kind: 'ROUND_ANSWER',
            roundId: stakeholderRound.body.id,
            snapshotId,
          },
          {
            kind: 'HTTPS_LINK',
            title: 'Integrációs szerződés',
            url: 'https://example.test/integration-contract',
          },
        ],
      })
      .expect(201);
    assert.equal(insight.body.version, 1);
    assert.equal(insight.body.evidence.length, 2);

    const reusedEvidenceId = insight.body.evidence[0].id as string;
    const reused = await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/insights`)
      .send({
        statement: 'A függőséghez külön szerződéses teszt szükséges.',
        evidenceIds: [reusedEvidenceId],
      })
      .expect(201);
    await request(app.getHttpServer())
      .put(`/projects/${project.body.id as string}/insights/${reused.body.id as string}`)
      .send({
        expectedVersion: 999,
        statement: 'Elavult módosítás.',
        evidenceIds: [reusedEvidenceId],
      })
      .expect(409);

    const followUp = await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/discovery-follow-ups`)
      .send({
        category: 'INTEGRATION',
        question: 'Melyik endpoint támogatja az újrapróbálást?',
        owner: 'Integration Expert',
        dueDate: '2026-09-15',
        nextStep: 'Ellenőrizd a szerződést.',
      })
      .expect(201);
    const attachment = await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/attachments`)
      .field('ownerKind', 'DISCOVERY_FOLLOW_UP')
      .field('ownerId', followUp.body.id as string)
      .attach('file', Buffer.from('retry endpoint: POST /jobs/{id}/retry', 'utf8'), {
        filename: 'újrapróbálás.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    await request(app.getHttpServer())
      .get(
        `/projects/${project.body.id as string}/attachments/${attachment.body.id as string}/download`,
      )
      .expect('Content-Type', /text\/plain/)
      .expect('Content-Disposition', /attachment/)
      .expect(200);

    await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/archive`)
      .expect(201);
    await request(app.getHttpServer())
      .post(`/projects/${project.body.id as string}/contacts`)
      .send({ name: 'Archived contact' })
      .expect(409);
    await request(app.getHttpServer())
      .delete(`/projects/${project.body.id as string}/attachments/${attachment.body.id as string}`)
      .expect(409);
    await request(app.getHttpServer())
      .get(
        `/projects/${project.body.id as string}/attachments/${attachment.body.id as string}/download`,
      )
      .expect(200);
  });
});
