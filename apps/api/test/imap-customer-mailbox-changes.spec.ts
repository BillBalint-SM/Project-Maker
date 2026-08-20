import { ConfigService } from '@nestjs/config';
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { MailGatewayConfiguration } from '../src/config/mail-gateway.config';
import { CustomerMailBoundaryError } from '../src/mail-delivery/customer-mail-boundary';
import {
  ImapCustomerMailboxChanges,
  type ImapMailboxClient,
  type ImapMailboxClientFactory,
  type ImapMailboxRecord,
  type ImapMailboxSearch,
} from '../src/mail-delivery/imap-customer-mailbox-changes';

describe('IMAP correspondence mailbox change adapter', () => {
  it('establishes an empty first baseline without reading historical messages', async () => {
    const client = new ControlledImapMailboxClient();
    client.uidValidity = '71';
    client.uidNext = 101;
    client.searchResults = [1, 2, 100];
    const mailbox = createMailbox(client);

    const page = await mailbox.readChanges(null, null);

    assert.deepEqual(page.changes, []);
    assert.equal(page.nextPageCheckpoint, null);
    assert.ok(page.completedCheckpoint);
    assert.deepEqual(client.searches, []);
    assert.deepEqual(client.fetches, []);
    assert.equal(client.closed, 1);
  });

  it('paginates a stable UID snapshot and resumes it across process-equivalent instances', async () => {
    const client = new ControlledImapMailboxClient();
    client.uidValidity = '71';
    client.uidNext = 101;
    const baseline = await createMailbox(client).readChanges(null, null);
    assert.ok(baseline.completedCheckpoint);

    client.resetObservations();
    client.uidNext = 129;
    client.searchResults = Array.from({ length: 28 }, (_, index) => 101 + index);
    client.records = client.searchResults.map(inboundRecord);
    const first = await createMailbox(client).readChanges(baseline.completedCheckpoint, null);

    assert.equal(first.changes.length, 25);
    assert.equal(first.changes[0]?.messageReference, '71:101');
    assert.equal(first.changes[24]?.messageReference, '71:125');
    assert.ok(first.nextPageCheckpoint);
    assert.equal(first.completedCheckpoint, null);
    assert.deepEqual(client.searches, [{ fromUid: 101, toUid: 128, since: null }]);
    assert.deepEqual(client.fetches, [Array.from({ length: 25 }, (_, index) => 101 + index)]);

    client.resetObservations();
    client.searchResults = [126, 127, 128];
    const second = await createMailbox(client).readChanges(first.nextPageCheckpoint, null);

    assert.deepEqual(second.changes.map(({ messageReference }) => messageReference), [
      '71:126',
      '71:127',
      '71:128',
    ]);
    assert.equal(second.nextPageCheckpoint, null);
    assert.ok(second.completedCheckpoint);
    assert.deepEqual(client.searches, [{ fromUid: 126, toUid: 128, since: null }]);

    client.resetObservations();
    client.uidNext = 130;
    client.searchResults = [129];
    client.records = [inboundRecord(129)];
    const nextRefresh = await createMailbox(client).readChanges(second.completedCheckpoint, null);
    assert.deepEqual(nextRefresh.changes.map(({ messageReference }) => messageReference), ['71:129']);
    assert.deepEqual(client.searches, [{ fromUid: 129, toUid: 129, since: null }]);
  });

  it('binds recovery pagination to the exact cutoff and rejects a changed UIDVALIDITY', async () => {
    const client = new ControlledImapMailboxClient();
    client.uidValidity = '71';
    client.uidNext = 11;
    client.searchResults = [8, 9, 10];
    client.records = client.searchResults.map(inboundRecord);
    const recoverySince = '2026-08-20T08:00:00.000Z';
    const recovered = await createMailbox(client).readChanges(null, recoverySince);

    assert.deepEqual(client.searches, [{ fromUid: 1, toUid: 10, since: recoverySince }]);
    assert.equal(recovered.changes.length, 3);
    assert.ok(recovered.completedCheckpoint);

    client.uidValidity = '72';
    await assert.rejects(
      createMailbox(client).readChanges(recovered.completedCheckpoint, null),
      (error: unknown) => error instanceof CustomerMailBoundaryError
        && error.code === 'INVALID_CURSOR',
    );
  });

  it('uses the maximum-UID terminal sentinel without searching beyond the IMAP UID range', async () => {
    const client = new ControlledImapMailboxClient();
    client.uidValidity = '71';
    client.uidNext = 4_294_967_296;
    const mailbox = createMailbox(client);

    const baseline = await mailbox.readChanges(null, null);
    assert.ok(baseline.completedCheckpoint);
    assert.deepEqual(client.searches, []);

    client.resetObservations();
    const restarted = await createMailbox(client).readChanges(baseline.completedCheckpoint, null);

    assert.deepEqual(restarted.changes, []);
    assert.ok(restarted.completedCheckpoint);
    assert.deepEqual(client.searches, []);
  });

  it('normalizes automation, addresses, body, and bounded attachment metadata', async () => {
    const client = new ControlledImapMailboxClient();
    client.uidValidity = '71';
    client.uidNext = 2;
    client.searchResults = [1];
    client.records = [{
      ...inboundRecord(1),
      senderAddress: 'customer@example.test',
      recipientAddresses: [
        'project-maker+token@example.test',
        'PROJECT-MAKER+TOKEN@EXAMPLE.TEST',
        'observer@example.test',
      ],
      contentType: 'multipart/report; report-type=delivery-status',
      headers: { 'x-failed-recipients': 'customer@example.test' },
      textContent: 'Delivery failed.',
      attachments: Array.from({ length: 22 }, (_, index) => ({
        name: `failure-${index}.txt`,
        contentType: 'text/plain',
        size: index,
      })),
    }];
    const mailbox = createMailbox(client);

    const page = await mailbox.readChanges(null, '2026-08-20T08:00:00.000Z');

    assert.deepEqual(page.changes, [{
      changeType: 'UPSERTED',
      automationKind: 'DELIVERY_REPORT',
      messageReference: '71:1',
      internetMessageId: '<message-1@example.test>',
      inReplyTo: '<outbound@example.test>',
      senderAddress: 'customer@example.test',
      recipientAddresses: [
        'project-maker+token@example.test',
        'observer@example.test',
      ],
      subject: 'Re: Felmérési összefoglaló',
      textContent: 'Delivery failed.',
      receivedAt: '2026-08-20T08:01:00.000Z',
      attachmentCount: 22,
      attachments: Array.from({ length: 20 }, (_, index) => ({
        name: `failure-${index}.txt`,
        contentType: 'text/plain',
        size: index,
      })),
    }]);
  });
});

class ControlledImapMailboxClient implements ImapMailboxClient {
  uidValidity = '1';
  uidNext = 1;
  searchResults: number[] = [];
  records: ImapMailboxRecord[] = [];
  searches: ImapMailboxSearch[] = [];
  fetches: number[][] = [];
  closed = 0;

  async open(_folder: string) {
    return { uidValidity: this.uidValidity, uidNext: this.uidNext };
  }

  async search(search: ImapMailboxSearch): Promise<readonly number[]> {
    this.searches.push(search);
    return this.searchResults;
  }

  async fetch(uids: readonly number[]): Promise<readonly ImapMailboxRecord[]> {
    this.fetches.push([...uids]);
    const selected = new Set(uids);
    return this.records.filter(({ uid }) => selected.has(uid));
  }

  async close(): Promise<void> {
    this.closed += 1;
  }

  resetObservations(): void {
    this.searches = [];
    this.fetches = [];
    this.closed = 0;
  }
}

function createMailbox(client: ImapMailboxClient): ImapCustomerMailboxChanges {
  const factory: ImapMailboxClientFactory = {
    create(_configuration: MailGatewayConfiguration) {
      return client;
    },
  };
  return new ImapCustomerMailboxChanges(configuration(), factory);
}

function configuration(): ConfigService {
  return new ConfigService({
    CORRESPONDENCE_MAILBOX_NAME: 'Project Maker',
    CORRESPONDENCE_MAILBOX_ADDRESS: 'project-maker@example.test',
    MAIL_GATEWAY_SMTP_HOST: 'smtp.example.test',
    MAIL_GATEWAY_SMTP_SECURITY: 'STARTTLS_REQUIRED',
    MAIL_GATEWAY_SMTP_USERNAME: 'smtp-user',
    MAIL_GATEWAY_SMTP_PASSWORD: 'smtp-secret',
    MAIL_GATEWAY_IMAP_HOST: 'imap.example.test',
    MAIL_GATEWAY_IMAP_SECURITY: 'IMPLICIT_TLS',
    MAIL_GATEWAY_IMAP_USERNAME: 'imap-user',
    MAIL_GATEWAY_IMAP_PASSWORD: 'imap-secret',
    MAIL_GATEWAY_CHECKPOINT_SECRET: 'checkpoint-secret-with-at-least-32-bytes',
  });
}

function inboundRecord(uid: number): ImapMailboxRecord {
  return {
    uid,
    internetMessageId: `<message-${uid}@example.test>`,
    inReplyTo: '<outbound@example.test>',
    senderAddress: 'customer@example.test',
    recipientAddresses: ['project-maker+token@example.test'],
    subject: 'Re: Felmérési összefoglaló',
    textContent: `Válasz ${uid}`,
    receivedAt: '2026-08-20T08:01:00.000Z',
    contentType: 'text/plain; charset=utf-8',
    headers: {},
    attachments: [],
  };
}
