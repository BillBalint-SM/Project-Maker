import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import { testInternalUser } from '../src/auth/auth.constants';
import { InternalUser } from '../src/auth/internal-user.entity';

describe('Internal account test-auth bypass (e2e)', () => {
  let app: INestApplication;

  before(async () => {
    process.env['NODE_ENV'] = 'test';
    delete process.env['AUTH_TEST_ENFORCEMENT'];

    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication({ logger: false });
    await app.init();
    await app.get(DataSource).getRepository(InternalUser).save({
      ...testInternalUser,
      passwordHash: 'test-auth-bypass-not-used',
      active: true,
      deactivatedAt: null,
      mcpTokenDigest: null,
      mcpTokenCreatedAt: null,
    });
  });

  after(async () => app.close());

  it('supplies the persisted test user to identity-dependent account routes', async () => {
    const session = await request(app.getHttpServer()).get('/auth/session').expect(200);
    assert.deepEqual(session.body, testInternalUser);

    await request(app.getHttpServer())
      .get('/auth/mcp-connection')
      .expect(200)
      .expect({ configured: false, createdAt: null });
  });
});
