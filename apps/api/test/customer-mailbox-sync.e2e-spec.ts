import type {
  CustomerMailboxChangePage,
  CustomerMailboxCheckpoint,
} from '@project-maker/contracts';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { AppModule } from '../src/app.module';
import {
  CustomerMailboxSyncService,
  customerMailboxClockToken,
  customerMailboxRetryRuntimeToken,
} from '../src/customer-mailbox-sync/customer-mailbox-sync.service';
import {
  CustomerMailBoundaryError,
  customerMailboxChangesToken,
  type CustomerMailboxChanges,
} from '../src/mail-delivery/customer-mail-boundary';

describe('Customer mailbox synchronization', () => {
  const mailboxRun = Date.now().toString(36);
  const apps: INestApplication[] = [];
  let dataSource: DataSource;
  const requestedCheckpoints: Array<CustomerMailboxCheckpoint | null> = [];
  let pages: CustomerMailboxChangePage[] = [];
  let releaseRead: (() => void) | null = null;
  let readStarted: (() => void) | null = null;
  let currentTime = new Date('2026-08-18T12:00:00.000Z');
  let mailboxFailure: CustomerMailBoundaryError | null = null;
  let mailboxFailures: CustomerMailBoundaryError[] = [];
  const retryDelays: number[] = [];
  let releaseRetryWait: (() => void) | null = null;
  let retryWaitStarted: (() => void) | null = null;
  let mailboxConfigured = true;
  let allowExpiredLeaseTakeover = false;
  let mailboxSequence = 0;

  before(async () => {
    process.env['CUSTOMER_MAILBOX_ADDRESS'] = 'project-maker@pte.hu';
    const mailbox: CustomerMailboxChanges = {
      isConfigured: () => mailboxConfigured,
      readChanges: async (checkpoint): Promise<CustomerMailboxChangePage> => {
        requestedCheckpoints.push(checkpoint);
        if (requestedCheckpoints.length > 1 && releaseRead && !allowExpiredLeaseTakeover) {
          throw new Error('A concurrent refresh reached the mailbox adapter.');
        }
        const sequencedFailure = mailboxFailures.shift();
        if (sequencedFailure) throw sequencedFailure;
        if (mailboxFailure) throw mailboxFailure;
        const page = pages.shift();
        assert.ok(page, 'The fake mailbox needs one page per expected read.');
        readStarted?.();
        if (releaseRead && requestedCheckpoints.length === 1) {
          await new Promise<void>((resolve) => {
            const release = releaseRead;
            releaseRead = () => {
              release?.();
              resolve();
            };
          });
        }
        return page;
      },
    };
    for (let index = 0; index < 2; index += 1) {
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(customerMailboxChangesToken)
        .useValue(mailbox)
        .overrideProvider(customerMailboxClockToken)
        .useValue({ now: () => new Date(currentTime) })
        .overrideProvider(customerMailboxRetryRuntimeToken)
        .useValue({
          random: () => 0.5,
          wait: async (delayMs: number) => {
            retryDelays.push(delayMs);
            retryWaitStarted?.();
            if (releaseRetryWait) {
              await new Promise<void>((resolve) => {
                releaseRetryWait = resolve;
              });
            }
          },
        })
        .compile();
      const app = module.createNestApplication({ logger: false });
      await app.init();
      apps.push(app);
    }
    dataSource = apps[0].get(DataSource);
  });

  beforeEach(async () => {
    mailboxSequence += 1;
    process.env['CUSTOMER_MAILBOX_ADDRESS'] = `mailbox-sync-${mailboxRun}-${mailboxSequence}@pte.hu`;
    requestedCheckpoints.length = 0;
    pages = [];
    releaseRead = null;
    readStarted = null;
    currentTime = new Date('2026-08-18T12:00:00.000Z');
    mailboxFailure = null;
    mailboxFailures = [];
    retryDelays.length = 0;
    releaseRetryWait = null;
    retryWaitStarted = null;
    mailboxConfigured = true;
    allowExpiredLeaseTakeover = false;
  });

  after(async () => Promise.all(apps.map((app) => app.close())));

  it('establishes the first delta baseline without importing historical mailbox content', async () => {
    pages.push({
      changes: [],
      nextPageCheckpoint: null,
      completedCheckpoint: { value: 'delta-baseline-1' },
    });
    const refreshed = await request(apps[0].getHttpServer())
      .post('/customer-mailbox-sync/refresh')
      .send({})
      .expect(201);

    assert.equal(refreshed.body.state, 'CURRENT');
    assert.equal(refreshed.body.mailboxAddress, process.env['CUSTOMER_MAILBOX_ADDRESS']);
    assert.equal(refreshed.body.baselineEstablished, true);
    assert.equal(typeof refreshed.body.lastSuccessfulSyncAt, 'string');
    assert.equal(refreshed.body.refreshInProgress, false);
    assert.deepEqual(requestedCheckpoints, [null]);

    const status = await request(apps[0].getHttpServer())
      .get('/customer-mailbox-sync')
      .expect(200);
    assert.deepEqual(status.body, refreshed.body);
    assert.equal('checkpoint' in status.body, false);
  });

  it('joins concurrent manual refreshes across API instances into one mailbox read', async () => {
    pages.push({
      changes: [],
      nextPageCheckpoint: null,
      completedCheckpoint: { value: 'delta-single-flight' },
    });
    const started = new Promise<void>((resolve) => {
      readStarted = resolve;
    });
    releaseRead = () => undefined;

    const firstRefresh = request(apps[0].getHttpServer())
      .post('/customer-mailbox-sync/refresh')
      .send({})
      .expect(201);
    const firstResult = firstRefresh.then((response) => response);
    await started;

    const joinedResult = request(apps[1].getHttpServer())
      .post('/customer-mailbox-sync/refresh')
      .send({})
      .expect(201)
      .then((response) => response);
    await new Promise((resolve) => setTimeout(resolve, 30));
    assert.equal(requestedCheckpoints.length, 1);
    releaseRead?.();
    const [joined, completed] = await Promise.all([joinedResult, firstResult]);

    assert.equal(joined.body.state, 'CURRENT');
    assert.equal(joined.body.refreshInProgress, false);
    assert.equal(completed.body.state, 'CURRENT');
    assert.equal(requestedCheckpoints.length, 1);
  });

  it('reports a delayed mailbox separately from a current mailbox', async () => {
    pages.push({
      changes: [],
      nextPageCheckpoint: null,
      completedCheckpoint: { value: 'delta-for-freshness' },
    });
    await request(apps[0].getHttpServer())
      .post('/customer-mailbox-sync/refresh')
      .send({})
      .expect(201);

    currentTime = new Date('2026-08-18T12:02:00.001Z');
    const delayed = await request(apps[0].getHttpServer())
      .get('/customer-mailbox-sync')
      .expect(200);

    assert.equal(delayed.body.state, 'DELAYED');
    assert.equal(delayed.body.lastSuccessfulSyncAt, '2026-08-18T12:00:00.000Z');
  });

  it('runs scheduled polling through the same durable refresh path', async () => {
    pages.push({
      changes: [],
      nextPageCheckpoint: null,
      completedCheckpoint: { value: 'delta-scheduled' },
    });

    await apps[0].get(CustomerMailboxSyncService).runScheduledRefresh();

    const status = await request(apps[0].getHttpServer())
      .get('/customer-mailbox-sync')
      .expect(200);
    assert.equal(status.body.state, 'CURRENT');
    assert.equal(status.body.baselineEstablished, true);
    assert.deepEqual(requestedCheckpoints, [null]);
  });

  it('persists the completed delta checkpoint across pagination and a process-equivalent restart', async () => {
    pages.push(
      {
        changes: [],
        nextPageCheckpoint: { value: 'next-page-1' },
        completedCheckpoint: null,
      },
      {
        changes: [],
        nextPageCheckpoint: null,
        completedCheckpoint: { value: 'delta-complete-1' },
      },
      {
        changes: [],
        nextPageCheckpoint: null,
        completedCheckpoint: { value: 'delta-complete-2' },
      },
    );

    await request(apps[0].getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);
    await request(apps[1].getHttpServer()).post('/customer-mailbox-sync/refresh').send({}).expect(201);

    assert.deepEqual(requestedCheckpoints, [
      null,
      { value: 'next-page-1' },
      { value: 'delta-complete-1' },
    ]);
  });

  it('retains only post-baseline mailbox changes independently from Outlook state', async () => {
    const historicalChange = mailboxChange('historical-message');
    const newChange = mailboxChange('new-message');
    pages.push(
      {
        changes: [historicalChange],
        nextPageCheckpoint: null,
        completedCheckpoint: { value: 'delta-baseline' },
      },
      {
        changes: [newChange],
        nextPageCheckpoint: null,
        completedCheckpoint: { value: 'delta-new-message' },
      },
      {
        changes: [newChange],
        nextPageCheckpoint: null,
        completedCheckpoint: { value: 'delta-replayed-message' },
      },
      {
        changes: [{ ...newChange, changeType: 'DELETED' }],
        nextPageCheckpoint: null,
        completedCheckpoint: { value: 'delta-deleted-message' },
      },
    );

    for (let refresh = 0; refresh < 4; refresh += 1) {
      await request(apps[0].getHttpServer())
        .post('/customer-mailbox-sync/refresh')
        .send({})
        .expect(201);
    }

    const retained = await dataSource.query<
      Array<{ message_reference: string; subject: string; text_content: string }>
    >(
      `SELECT message_reference, subject, text_content
       FROM customer_mailbox_change_inbox
       WHERE mailbox_address = $1
       ORDER BY message_reference`,
      [process.env['CUSTOMER_MAILBOX_ADDRESS']],
    );
    assert.deepEqual(retained, [
      {
        message_reference: 'new-message',
        subject: 'Új ügyfélválasz',
        text_content: 'A projekt mehet tovább.',
      },
    ]);
  });

  it('distinguishes bounded configuration, authorization, and availability failures', async () => {
    mailboxConfigured = false;
    const invalidConfiguration = await request(apps[0].getHttpServer())
      .post('/customer-mailbox-sync/refresh')
      .send({})
      .expect(201);
    assert.equal(invalidConfiguration.body.state, 'CONFIGURATION_ERROR');
    mailboxConfigured = true;

    const cases = [
      ['CONFIGURATION_ERROR', 'CONFIGURATION_ERROR'],
      ['AUTHENTICATION_ERROR', 'AUTHORIZATION_ERROR'],
      ['TEMPORARY_FAILURE', 'UNAVAILABLE'],
    ] as const;

    for (const [errorCode, expectedState] of cases) {
      await dataSource.query(
        'DELETE FROM "customer_mailbox_sync" WHERE "mailbox_address" = $1',
        [process.env['CUSTOMER_MAILBOX_ADDRESS']],
      );
      mailboxFailure = new CustomerMailBoundaryError(errorCode);
      const response = await request(apps[0].getHttpServer())
        .post('/customer-mailbox-sync/refresh')
        .send({})
        .expect(201);
      assert.equal(response.body.state, expectedState);
      assert.equal(response.body.lastSuccessfulSyncAt, null);
      assert.equal('failureCode' in response.body, false);
    }
  });

  it('retries transient mailbox failures with bounded backoff while concurrent manual refresh joins', async () => {
    pages.push({
      changes: [],
      nextPageCheckpoint: null,
      completedCheckpoint: { value: 'delta-after-retry' },
    });
    mailboxFailures = [
      new CustomerMailBoundaryError('TEMPORARY_FAILURE'),
      new CustomerMailBoundaryError('THROTTLED'),
    ];
    const retryStarted = new Promise<void>((resolve) => {
      retryWaitStarted = resolve;
    });
    releaseRetryWait = () => undefined;

    const first = request(apps[0].getHttpServer())
      .post('/customer-mailbox-sync/refresh')
      .send({})
      .expect(201)
      .then((response) => response);
    await retryStarted;
    const joined = request(apps[0].getHttpServer())
      .post('/customer-mailbox-sync/refresh')
      .send({})
      .expect(201)
      .then((response) => response);
    await new Promise((resolve) => setTimeout(resolve, 30));
    const release = releaseRetryWait;
    releaseRetryWait = null;
    release?.();

    const [completed, joinedResult] = await Promise.all([first, joined]);
    assert.equal(completed.body.state, 'CURRENT');
    assert.equal(joinedResult.body.state, 'CURRENT');
    assert.deepEqual(retryDelays, [250, 500]);
    assert.equal(requestedCheckpoints.length, 3);
  });

  it('does not retry permanent mailbox configuration or authorization failures', async () => {
    mailboxFailure = new CustomerMailBoundaryError('AUTHENTICATION_ERROR');

    const response = await request(apps[0].getHttpServer())
      .post('/customer-mailbox-sync/refresh')
      .send({})
      .expect(201);

    assert.equal(response.body.state, 'AUTHORIZATION_ERROR');
    assert.equal(requestedCheckpoints.length, 1);
    assert.deepEqual(retryDelays, []);
  });

  it('discards an expired delta checkpoint before rebuilding the current mailbox view', async () => {
    pages.push(
      {
        changes: [],
        nextPageCheckpoint: null,
        completedCheckpoint: { value: 'delta-before-expiry' },
      },
      {
        changes: [mailboxChange('preserved-before-expiry')],
        nextPageCheckpoint: null,
        completedCheckpoint: { value: 'delta-with-preserved-message' },
      },
    );
    await request(apps[0].getHttpServer())
      .post('/customer-mailbox-sync/refresh')
      .send({})
      .expect(201);
    await request(apps[0].getHttpServer())
      .post('/customer-mailbox-sync/refresh')
      .send({})
      .expect(201);

    mailboxFailure = new CustomerMailBoundaryError('INVALID_CURSOR');
    const unavailable = await request(apps[0].getHttpServer())
      .post('/customer-mailbox-sync/refresh')
      .send({})
      .expect(201);
    assert.equal(unavailable.body.state, 'UNAVAILABLE');

    mailboxFailure = null;
    mailboxFailures = [];
    retryDelays.length = 0;
    releaseRetryWait = null;
    retryWaitStarted = null;
    pages.push({
      changes: [mailboxChange('historical-during-recovery')],
      nextPageCheckpoint: null,
      completedCheckpoint: { value: 'delta-after-recovery' },
    }, {
      changes: [mailboxChange('new-after-recovery')],
      nextPageCheckpoint: null,
      completedCheckpoint: { value: 'delta-after-new-message' },
    });
    const recovered = await request(apps[0].getHttpServer())
      .post('/customer-mailbox-sync/refresh')
      .send({})
      .expect(201);

    assert.equal(recovered.body.state, 'CURRENT');
    assert.equal(recovered.body.baselineEstablished, true);
    await request(apps[0].getHttpServer())
      .post('/customer-mailbox-sync/refresh')
      .send({})
      .expect(201);
    const retained = await dataSource.query<Array<{ message_reference: string }>>(
      `SELECT "message_reference" FROM "customer_mailbox_change_inbox"
       WHERE "mailbox_address" = $1 ORDER BY "message_reference"`,
      [process.env['CUSTOMER_MAILBOX_ADDRESS']],
    );
    assert.deepEqual(retained, [
      { message_reference: 'new-after-recovery' },
      { message_reference: 'preserved-before-expiry' },
    ]);
    assert.deepEqual(requestedCheckpoints, [
      null,
      { value: 'delta-before-expiry' },
      { value: 'delta-with-preserved-message' },
      null,
      { value: 'delta-after-recovery' },
    ]);
  });

  it('falls back before scheduling a poll interval beyond the Node timer limit', async () => {
    const originalSetInterval = global.setInterval;
    const previousPollInterval = process.env['CUSTOMER_MAILBOX_SYNC_POLL_INTERVAL_MS'];
    const scheduledDelays: number[] = [];
    process.env['CUSTOMER_MAILBOX_SYNC_POLL_INTERVAL_MS'] = '2147483648';
    global.setInterval = ((handler: TimerHandler, delay?: number, ...args: unknown[]) => {
      scheduledDelays.push(Number(delay));
      return originalSetInterval(handler, 60_000, ...args);
    }) as typeof setInterval;

    let app: INestApplication | undefined;
    try {
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(customerMailboxChangesToken)
        .useValue({ isConfigured: () => true, readChanges: async () => ({}) })
        .overrideProvider(customerMailboxClockToken)
        .useValue({ now: () => new Date(currentTime) })
        .compile();
      app = module.createNestApplication({ logger: false });
      await app.init();
      assert.equal(scheduledDelays.includes(60_000), true);
      assert.equal(scheduledDelays.some((delay) => delay > 2_147_483_647), false);
    } finally {
      await app?.close();
      global.setInterval = originalSetInterval;
      if (previousPollInterval === undefined) {
        delete process.env['CUSTOMER_MAILBOX_SYNC_POLL_INTERVAL_MS'];
      } else {
        process.env['CUSTOMER_MAILBOX_SYNC_POLL_INTERVAL_MS'] = previousPollInterval;
      }
    }
  });

  it('prevents an expired worker from overwriting a completed takeover', async () => {
    pages.push(
      { changes: [], nextPageCheckpoint: null, completedCheckpoint: { value: 'delta-stale' } },
      { changes: [], nextPageCheckpoint: null, completedCheckpoint: { value: 'delta-takeover' } },
      { changes: [], nextPageCheckpoint: null, completedCheckpoint: { value: 'delta-after-takeover' } },
    );
    allowExpiredLeaseTakeover = true;
    const started = new Promise<void>((resolve) => {
      readStarted = resolve;
    });
    releaseRead = () => undefined;
    const staleWorker = request(apps[0].getHttpServer())
      .post('/customer-mailbox-sync/refresh')
      .send({})
      .expect(201)
      .then((response) => response);
    await started;

    currentTime = new Date('2026-08-18T12:02:00.001Z');
    const takeover = await request(apps[1].getHttpServer())
      .post('/customer-mailbox-sync/refresh')
      .send({})
      .expect(201);
    assert.equal(takeover.body.state, 'CURRENT');

    releaseRead?.();
    await staleWorker;
    await request(apps[1].getHttpServer())
      .post('/customer-mailbox-sync/refresh')
      .send({})
      .expect(201);

    assert.deepEqual(requestedCheckpoints, [null, null, { value: 'delta-takeover' }]);
  });
});

function mailboxChange(messageReference: string) {
  return {
    changeType: 'UPSERTED' as const,
    automationKind: 'HUMAN' as const,
    messageReference,
    internetMessageId: `<${messageReference}@pte.hu>`,
    inReplyTo: '<outbound-message@project-maker.local>',
    senderAddress: 'customer@pte.hu',
    recipientAddresses: ['project-maker@pte.hu'],
    subject: 'Új ügyfélválasz',
    textContent: 'A projekt mehet tovább.',
    receivedAt: '2026-08-18T11:59:00.000Z',
    attachmentCount: 0,
    attachments: [],
  };
}
