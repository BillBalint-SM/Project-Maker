import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, before, describe, it } from 'node:test';
import request, { type Response, type Test as SupertestRequest } from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { AuditEvent } from '../src/audit/audit-event.entity';
import {
  GitClient,
  type PrepareGitPushInput,
  type PreparedGitPush,
} from '../src/delivery/git-client';

const origin = 'http://127.0.0.1:4200';

class DeterministicGitClient {
  async remoteSha(): Promise<string | null> {
    return null;
  }

  async preparePush(input: PrepareGitPushInput): Promise<PreparedGitPush> {
    const expectedCommitSha = createHash('sha256')
      .update(`${input.remoteUrl}\n${input.branch}\n${input.artifactContent}`)
      .digest('hex');
    return {
      expectedCommitSha,
      push: async () => undefined,
      dispose: async () => undefined,
    };
  }
}

describe('Claude Code Project Maker MCP connection (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  before(async () => {
    process.env['NODE_ENV'] = 'test';
    process.env['AUTH_TEST_ENFORCEMENT'] = 'true';
    process.env['CORS_ORIGIN'] = origin;
    process.env['GIT_CREDENTIAL_ENCRYPTION_KEY'] = 'mcp-test-encryption-key-at-least-32-bytes';
    process.env['GIT_HANDOFF_PREVIEW_SECRET'] = 'mcp-test-preview-secret-at-least-32-bytes';

    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GitClient)
      .useValue(new DeterministicGitClient())
      .compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
    dataSource = app.get(DataSource);
  });

  after(async () => app.close());

  it('lets the signed-in owner create, replace, revoke, and deactivate one personal connection token', async () => {
    const agent = request.agent(app.getHttpServer());
    const email = `mcp-token-${randomUUID()}@example.test`;
    await signUp(agent, email);

    const emptyStatus = await agent.get('/auth/mcp-connection').expect(200);
    assert.deepEqual(emptyStatus.body, { configured: false, createdAt: null });

    const first = await agent
      .post('/auth/mcp-connection')
      .set('Origin', origin)
      .expect(201);
    assert.match(first.body.token, /^pm_mcp_[A-Za-z0-9_-]+$/);
    const stored = await dataSource.query(
      'SELECT "mcp_token_digest" AS digest FROM "internal_users" WHERE "email" = $1',
      [email],
    ) as Array<{ digest: string }>;
    assert.equal(stored[0]?.digest, sha256(first.body.token));
    assert.equal(JSON.stringify(stored).includes(first.body.token), false);

    const second = await agent
      .post('/auth/mcp-connection')
      .set('Origin', origin)
      .expect(201);
    assert.notEqual(second.body.token, first.body.token);
    await initializeMcp(app, first.body.token).expect(401);
    await initializeMcp(app, second.body.token, '2025-06-18').expect(200);
    const modernDiscovery = await modernMcpRequest(
      app,
      second.body.token,
      'server/discover',
      {},
    );
    assert.equal(modernDiscovery.status, 200, modernDiscovery.text);
    assert.ok(jsonRpcBody(modernDiscovery).result.supportedVersions.includes('2026-07-28'));

    await agent.delete('/auth/mcp-connection').set('Origin', origin).expect(204);
    await initializeMcp(app, second.body.token).expect(401);

    const third = await agent
      .post('/auth/mcp-connection')
      .set('Origin', origin)
      .expect(201);
    await agent.post('/auth/deactivate').set('Origin', origin).expect(204);
    await initializeMcp(app, third.body.token).expect(401);
  });

  it('offers the bounded business tool contract and keeps Git preview-confirm actor attribution', async () => {
    const agent = request.agent(app.getHttpServer());
    const user = await signUp(agent, `mcp-tools-${randomUUID()}@example.test`);
    const connection = await agent
      .post('/auth/mcp-connection')
      .set('Origin', origin)
      .expect(201);
    const token = connection.body.token as string;

    const initialized = await initializeMcp(app, token).expect(200);
    assert.equal(jsonRpcBody(initialized).result.serverInfo.name, 'project-maker');

    const toolsResponse = await modernMcpRequest(app, token, 'tools/list', {});
    assert.equal(toolsResponse.status, 200, toolsResponse.text);
    const tools = jsonRpcBody(toolsResponse).result.tools as Array<{
      name: string;
      _meta?: Record<string, unknown>;
    }>;
    const legacyToolsResponse = await mcpRequest(app, token, 'tools/list', {}).expect(200);
    const legacyTools = jsonRpcBody(legacyToolsResponse).result.tools as typeof tools;
    const toolNames = tools
      .map((tool) => tool.name)
      .sort();
    assert.deepEqual(toolNames, [
      'confirm_git_handoff',
      'generate_specification',
      'get_project_context',
      'get_question_bank',
      'list_git_setups',
      'list_markdown_templates',
      'list_projects',
      'preview_git_handoff',
      'publish_markdown_template',
      'read_specification',
      'save_delivery_package',
      'save_markdown_template',
      'save_question_bank_question',
    ]);
    for (const catalogue of [tools, legacyTools]) {
      assert.equal(
        catalogue.find((tool) => tool.name === 'confirm_git_handoff')?._meta?.['anthropic/requiresUserInteraction'],
        true,
      );
    }

    const project = await agent
      .post('/projects')
      .set('Origin', origin)
      .send({
        name: `MCP projekt ${randomUUID()}`,
        customerContactName: 'Ügyfél Anna',
        customerContactEmail: `mcp-customer-${randomUUID()}@example.test`,
        internalOwnerName: 'PO Péter',
        nextActionOwnerRole: 'INTERNAL_OWNER',
      })
      .expect(201);
    const revision = await agent
      .post(`/projects/${project.body.id as string}/markdown-revisions`)
      .set('Origin', origin)
      .send({ reason: 'MANUAL' })
      .expect(201);

    const projects = await callTool(app, token, 'list_projects', {});
    assert.ok((projects as Array<{ id: string }>).some((item) => item.id === project.body.id));
    const specification = await callTool(app, token, 'read_specification', {
      projectId: project.body.id,
      revisionId: revision.body.id,
    }) as { content: string };
    assert.match(specification.content, /MCP projekt/);

    await callTool(app, token, 'save_delivery_package', {
      projectId: project.body.id,
      specificationRevisionId: revision.body.id,
      items: [{
        title: 'MCP-n átadott tétel',
        userStory: 'Fejlesztőként a közvetlen Project Maker-kapcsolatot szeretném használni.',
        acceptanceCriteria: ['A mentés a meglévő Delivery package szabályait használja.'],
        sourceExcerpts: [],
      }],
    });
    const setup = await agent
      .post('/git-setups')
      .set('Origin', origin)
      .send({
        name: `MCP Git ${randomUUID()}`,
        remoteUrl: 'https://git.example.test/team/mcp-project.git',
        branch: 'main',
        authenticationMode: 'HTTPS_TOKEN',
        username: 'git-user',
        credential: { accessToken: 'mcp-git-test-token' },
      })
      .expect(201);

    const preview = await callTool(app, token, 'preview_git_handoff', {
      projectId: project.body.id,
      gitSetupId: setup.body.id,
    }) as { previewToken: string; artifact: { content: string } };
    assert.match(preview.artifact.content, /MCP-n átadott tétel/);
    const confirmed = await callTool(app, token, 'confirm_git_handoff', {
      projectId: project.body.id,
      previewToken: preview.previewToken,
    }) as { state: string };
    assert.equal(confirmed.state, 'SENT');

    const audit = await dataSource.getRepository(AuditEvent).findOneByOrFail({
      projectId: project.body.id as string,
      eventType: 'DELIVERY_HANDOFF_CONFIRMED',
    });
    assert.equal(audit.actorId, user.id);
  });
});

async function signUp(
  agent: ReturnType<typeof request.agent>,
  email: string,
): Promise<{ readonly id: string; readonly email: string }> {
  const response = await agent
    .post('/auth/signup')
    .set('Origin', origin)
    .send({ email, password: 'mcp-kapcsolati-jelszo-legalabb-12' })
    .expect(201);
  return response.body as { id: string; email: string };
}

function initializeMcp(
  app: INestApplication,
  token: string,
  protocolVersion = '2025-06-18',
): SupertestRequest {
  return mcpRequest(app, token, 'initialize', {
    protocolVersion,
    capabilities: {},
    clientInfo: { name: 'project-maker-test', version: '1.0.0' },
  }, protocolVersion);
}

function mcpRequest(
  app: INestApplication,
  token: string,
  method: string,
  params: unknown,
  protocolVersion = '2025-06-18',
): SupertestRequest {
  return request(app.getHttpServer())
    .post('/mcp')
    .set('Authorization', `Bearer ${token}`)
    .set('Accept', 'application/json, text/event-stream')
    .set('MCP-Protocol-Version', protocolVersion)
    .send({ jsonrpc: '2.0', id: randomUUID(), method, params });
}

function modernMcpRequest(
  app: INestApplication,
  token: string,
  method: string,
  params: Record<string, unknown>,
): SupertestRequest {
  return mcpRequest(app, token, method, {
    ...params,
    _meta: {
      'io.modelcontextprotocol/protocolVersion': '2026-07-28',
      'io.modelcontextprotocol/clientInfo': { name: 'project-maker-test', version: '1.0.0' },
      'io.modelcontextprotocol/clientCapabilities': {},
    },
  }, '2026-07-28').set('MCP-Method', method);
}

async function callTool(
  app: INestApplication,
  token: string,
  name: string,
  args: Record<string, unknown>,
): Promise<unknown> {
  const response = await mcpRequest(app, token, 'tools/call', {
    name,
    arguments: args,
  }).expect(200);
  const body = jsonRpcBody(response);
  assert.equal(body.error, undefined, JSON.stringify(body.error));
  const content = body.result.content as Array<{ type: string; text?: string }>;
  assert.equal(content[0]?.type, 'text');
  return JSON.parse(content[0]?.text ?? 'null') as unknown;
}

function jsonRpcBody(response: Response): any {
  if (response.body && Object.keys(response.body as object).length > 0) {
    return response.body;
  }
  const data = response.text
    .split(/\r?\n/)
    .filter((line) => line.startsWith('data: '))
    .at(-1)
    ?.slice(6);
  return data ? JSON.parse(data) : {};
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
