import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { GitClient, GitOperationError, type PrepareGitPushInput, type PreparedGitPush } from '../src/delivery/git-client';

class DeterministicGitClient {
  readonly remoteByTarget = new Map<string, string>();
  pushCount = 0;
  uncertainNextPush = false;

  async remoteSha(target: { remoteUrl: string; branch: string }): Promise<string | null> {
    return this.remoteByTarget.get(`${target.remoteUrl}#${target.branch}`) ?? null;
  }

  async preparePush(input: PrepareGitPushInput): Promise<PreparedGitPush> {
    const expectedCommitSha = sha256(`${input.remoteUrl}\n${input.branch}\n${input.artifactPath}\n${input.artifactContent}\n${input.commitMessage}\n${input.committedAt.toISOString()}`);
    return {
      expectedCommitSha,
      push: async () => {
        this.pushCount += 1;
        this.remoteByTarget.set(`${input.remoteUrl}#${input.branch}`, expectedCommitSha);
        if (this.uncertainNextPush) {
          this.uncertainNextPush = false;
          throw new GitOperationError('PUSH_RESULT_UNKNOWN');
        }
      },
      dispose: async () => undefined,
    };
  }
}

describe('Delivery package and exports (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  const git = new DeterministicGitClient();

  before(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['GIT_CREDENTIAL_ENCRYPTION_KEY'] = 'delivery-test-encryption-key-at-least-32-bytes';
    process.env['GIT_HANDOFF_PREVIEW_SECRET'] = 'delivery-test-preview-secret-at-least-32-bytes';
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GitClient).useValue(git)
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
    dataSource = app.get(DataSource);
  });

  after(async () => app.close());

  it('binds one editable package to an immutable Specification and exports the saved content after archive', async () => {
    const project = await request(app.getHttpServer()).post('/projects').send({
      name: `Átadási projekt ${randomUUID()}`,
      customerContactName: 'Ügyfél Anna',
      customerContactEmail: `delivery-${Date.now()}@example.test`,
      internalOwnerName: 'PO Péter',
      nextActionOwnerRole: 'INTERNAL_OWNER',
    }).expect(201);
    const projectId = project.body.id as string;
    const revision = await request(app.getHttpServer())
      .post(`/projects/${projectId}/markdown-revisions`).send({ reason: 'MANUAL' }).expect(201);
    const exactExcerpt = (revision.body.content as string).slice(0, 48);

    await request(app.getHttpServer()).put(`/projects/${projectId}/delivery-package`).send({
      specificationRevisionId: revision.body.id,
      items: [{
        title: 'Magyar átadás <biztonságosan>',
        userStory: 'PO-ként szeretném egyben átadni a pontos csomagot.',
        acceptanceCriteria: ['=1+1 nem képlet', 'Kész; "igen"'],
        sourceExcerpts: ['nem létező forrásrészlet'],
      }],
    }).expect(400);

    const saved = await request(app.getHttpServer()).put(`/projects/${projectId}/delivery-package`).send({
      specificationRevisionId: revision.body.id,
      items: [{
        title: 'Magyar átadás <biztonságosan>',
        userStory: 'PO-ként szeretném egyben átadni a pontos csomagot.',
        acceptanceCriteria: ['=1+1 nem képlet', 'Kész; "igen"'],
        sourceExcerpts: [exactExcerpt],
      }],
    }).expect(200);
    assert.equal(saved.body.specification.version, revision.body.version);
    assert.equal(saved.body.version, 1);

    const artifact = await request(app.getHttpServer())
      .get(`/projects/${projectId}/delivery-package/artifact`).expect(200);
    assert.match(artifact.body.content, /PO-ként/);
    assert.match(artifact.body.content, /Kanonikus specifikáció/);
    assert.match(artifact.body.content, new RegExp(escapeRegExp(exactExcerpt)));
    assert.equal(artifact.body.provenance.state, 'DRAFT');

    const csv = await request(app.getHttpServer())
      .get(`/projects/${projectId}/delivery-package/export.csv`).expect(200);
    assert.equal(csv.text.charCodeAt(0), 0xfeff);
    assert.match(csv.text, /'\=1\+1 nem képlet/);
    assert.match(csv.text, /"Kész; ""igen"""/);

    const print = await request(app.getHttpServer())
      .get(`/projects/${projectId}/delivery-package/print`).expect(200);
    assert.match(print.text, /<html lang="hu">/);
    assert.match(print.text, /Magyar átadás &lt;biztonságosan&gt;/);

    await request(app.getHttpServer()).post(`/projects/${projectId}/archive`).expect(201);
    await request(app.getHttpServer()).get(`/projects/${projectId}/delivery-package`).expect(200);
    await request(app.getHttpServer()).get(`/projects/${projectId}/delivery-package/export.md`).expect(200);
    await request(app.getHttpServer()).put(`/projects/${projectId}/delivery-package`).send({
      specificationRevisionId: revision.body.id,
      items: saved.body.items,
    }).expect(409);
  });

  it('stores one shared masked Git setup and binds an exact handoff preview to the saved package', async () => {
    const project = await request(app.getHttpServer()).post('/projects').send({
      name: `Git átadás ${randomUUID()}`,
      customerContactName: 'Ügyfél Anna',
      customerContactEmail: `git-${Date.now()}@example.test`,
      internalOwnerName: 'PO Péter',
      nextActionOwnerRole: 'INTERNAL_OWNER',
    }).expect(201);
    const projectId = project.body.id as string;
    const revision = await request(app.getHttpServer())
      .post(`/projects/${projectId}/markdown-revisions`).send({ reason: 'MANUAL' }).expect(201);
    await request(app.getHttpServer()).put(`/projects/${projectId}/delivery-package`).send({
      specificationRevisionId: revision.body.id,
      items: [{
        title: 'Implementálható tétel',
        userStory: 'Fejlesztőként a pontos átadási tartalmat szeretném megkapni.',
        acceptanceCriteria: ['A fájl a megadott branchre kerül.'],
      }],
    }).expect(200);

    const secret = `secret-token-${randomUUID()}`;
    const setupName = `Közös Forgejo setup ${randomUUID()}`;
    await request(app.getHttpServer()).post('/git-setups').send({
      name: setupName,
      remoteUrl: 'https://git.example.test/team/project.git',
      branch: 'main',
      authenticationMode: 'HTTPS_TOKEN',
      username: 'git-po',
      credential: { accessToken: secret },
      repositoryWebUrl: 'https://git.example.test/team/project',
    }).expect(201);
    const setups = await request(app.getHttpServer()).get('/git-setups').expect(200);
    const setup = setups.body.find((item: { name: string }) => item.name === setupName);
    assert.ok(setup);
    assert.equal(setup.credentialConfigured, true);
    assert.equal(JSON.stringify(setup).includes(secret), false);
    const stored = await dataSource.query('SELECT "credential_ciphertext" FROM "git_setups" WHERE "id" = $1', [setup.id]) as Array<{ credential_ciphertext: string }>;
    assert.equal(stored[0]?.credential_ciphertext.includes(secret), false);

    const updated = await request(app.getHttpServer()).put(`/git-setups/${setup.id as string}`).send({
      name: `Közös Git setup ${randomUUID()}`,
      remoteUrl: setup.remoteUrl,
      branch: setup.branch,
      authenticationMode: setup.authenticationMode,
      username: setup.username,
      repositoryWebUrl: setup.repositoryWebUrl,
    }).expect(200);
    assert.equal(updated.body.version, 2);
    assert.equal(updated.body.credentialConfigured, true);
    await request(app.getHttpServer()).post('/git-setups').send({
      name: 'Tiltott local setup', remoteUrl: 'file:///tmp/repo.git', branch: 'main',
      authenticationMode: 'HTTPS_TOKEN', credential: { accessToken: 'token' },
    }).expect(400);
    await request(app.getHttpServer()).post('/git-setups').send({
      name: 'Tiltott beágyazott token', remoteUrl: 'https://user:secret@git.example.test/repo.git', branch: 'main',
      authenticationMode: 'HTTPS_TOKEN', credential: { accessToken: 'token' },
    }).expect(400);

    const preview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/delivery-handoffs/preview`)
      .send({ gitSetupId: setup.id }).expect(201);
    assert.equal(preview.body.setup.version, 2);
    assert.match(preview.body.artifactPath, new RegExp(`^project-maker-handoffs/${projectId}/delivery-package-v1\\.md$`));
    assert.equal(preview.body.artifact.digest, sha256(preview.body.artifact.content));
    assert.equal(preview.body.artifact.content.includes(secret), false);

    const confirmed = await request(app.getHttpServer())
      .post(`/projects/${projectId}/delivery-handoffs/confirm`)
      .send({ previewToken: preview.body.previewToken }).expect(201);
    assert.equal(confirmed.body.state, 'SENT');
    assert.equal(confirmed.body.commitSha, confirmed.body.expectedCommitSha);
    assert.equal(git.pushCount, 1);
    const duplicate = await request(app.getHttpServer())
      .post(`/projects/${projectId}/delivery-handoffs/confirm`)
      .send({ previewToken: preview.body.previewToken }).expect(201);
    assert.equal(duplicate.body.id, confirmed.body.id);
    assert.equal(git.pushCount, 1);

    await request(app.getHttpServer()).put(`/projects/${projectId}/delivery-package`).send({
      specificationRevisionId: revision.body.id,
      items: [{
        title: 'Implementálható tétel',
        userStory: 'Fejlesztőként a pontos átadási tartalmat szeretném megkapni.',
        acceptanceCriteria: ['A fájl a megadott branchre kerül.', 'A SHA visszaellenőrzött.'],
      }],
    }).expect(200);
    const uncertainPreview = await request(app.getHttpServer())
      .post(`/projects/${projectId}/delivery-handoffs/preview`)
      .send({ gitSetupId: setup.id }).expect(201);
    git.uncertainNextPush = true;
    const reconciled = await request(app.getHttpServer())
      .post(`/projects/${projectId}/delivery-handoffs/confirm`)
      .send({ previewToken: uncertainPreview.body.previewToken }).expect(201);
    assert.equal(reconciled.body.state, 'SENT');
    assert.equal(reconciled.body.commitSha, reconciled.body.expectedCommitSha);
    assert.equal(git.pushCount, 2);

    const retained = await dataSource.query(`
      SELECT "target_snapshot"::text AS target, "package_snapshot"::text AS package, "artifact_content" AS artifact
      FROM "delivery_handoffs" WHERE "project_id" = $1
    `, [projectId]) as Array<{ target: string; package: string; artifact: string }>;
    assert.equal(JSON.stringify(retained).includes(secret), false);
    const audits = await dataSource.query(`
      SELECT "payload"::text AS payload FROM "audit_events"
      WHERE "project_id" = $1 OR "event_type" LIKE 'GIT_SETUP_%'
    `, [projectId]) as Array<{ payload: string }>;
    assert.equal(JSON.stringify(audits).includes(secret), false);
  });
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
