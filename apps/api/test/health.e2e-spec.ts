import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { after, before, describe, it } from 'node:test';
import request from 'supertest';

import { AppModule } from '../src/app.module';

describe('HealthController (e2e)', () => {
  let app: INestApplication;

  before(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  after(async () => {
    await app.close();
  });

  it('returns API health', async () => {
    await request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect({ status: 'ok' });
  });
});
