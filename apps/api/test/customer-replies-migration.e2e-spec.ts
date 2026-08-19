import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';

import { migrationsForFreshDatabase, migrationsForHistoricalDatabase } from './migration-harness';

describe('Correlated Customer replies migration (PostgreSQL)', () => {
  it('preserves the baseline but expires the old checkpoint so retained replies are re-read', async () => {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) throw new Error('DATABASE_URL is required for the Customer reply migration proof.');
    const databaseName = `customer_replies_upgrade_${Date.now()}_${randomUUID().replaceAll('-', '')}`;
    const admin = new DataSource({ type: 'postgres', url: databaseUrl });
    let database: DataSource | undefined;
    try {
      await admin.initialize();
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      database = new DataSource({
        type: 'postgres',
        url: withDatabaseName(databaseUrl, databaseName),
        migrations: [
          ...migrationsForHistoricalDatabase(
            'CustomerMailboxSync0019CustomerMailboxSync1787472000000',
          ),
        ],
      });
      await database.initialize();
      await database.runMigrations();
      await database.query(
        `INSERT INTO customer_mailbox_sync
           (mailbox_address, delta_checkpoint, baseline_established, state, last_successful_sync_at)
         VALUES ('project-maker@pte.hu', 'delta-before-reply-retention', true, 'CURRENT', CURRENT_TIMESTAMP)`,
      );
      await database.destroy();

      database = new DataSource({
        type: 'postgres',
        url: withDatabaseName(databaseUrl, databaseName),
        migrations: [...migrationsForFreshDatabase()],
      });
      await database.initialize();
      await database.runMigrations();

      const sync = await database.query<
        Array<{ delta_checkpoint: string | null; baseline_established: boolean; state: string }>
      >(
        `SELECT delta_checkpoint, baseline_established, state
         FROM customer_mailbox_sync
         WHERE mailbox_address = 'project-maker@pte.hu'`,
      );
      assert.deepEqual(sync, [{
        delta_checkpoint: null,
        baseline_established: true,
        state: 'INITIALIZING',
      }]);
    } finally {
      if (database?.isInitialized) await database.destroy();
      if (admin.isInitialized) {
        await admin.query(
          'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
          [databaseName],
        );
        await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
        await admin.destroy();
      }
    }
  });

  it('reverts empty schema expansion and refuses to discard retained inbound messages', async () => {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) throw new Error('DATABASE_URL is required for the Customer reply migration proof.');
    const databaseName = `customer_replies_${Date.now()}_${randomUUID().replaceAll('-', '')}`;
    const admin = new DataSource({ type: 'postgres', url: databaseUrl });
    let database: DataSource | undefined;
    try {
      await admin.initialize();
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      database = new DataSource({
        type: 'postgres',
        url: withDatabaseName(databaseUrl, databaseName),
        migrations: [...migrationsForFreshDatabase()],
      });
      await database.initialize();
      await database.runMigrations();
      await database.undoLastMigration();
      await database.undoLastMigration();
      await database.undoLastMigration();
      await database.undoLastMigration();
      const absent = await database.query(
        `SELECT table_name FROM information_schema.tables WHERE table_name = 'customer_inbound_messages'`,
      );
      assert.deepEqual(absent, []);

      await database.runMigrations();
      const inboundMessageId = randomUUID();
      await database.query(
        `INSERT INTO customer_mailbox_sync (mailbox_address, state)
         VALUES ('project-maker@pte.hu', 'INITIALIZING')`,
      );
      await database.query(
        `INSERT INTO customer_inbound_messages (
           id, mailbox_address, provider_message_reference, correlation_state, correlation_evidence,
           sender_classification, recipient_addresses, text_content, visible_text, received_at,
           attachment_count, attachments
         ) VALUES ($1, 'project-maker@pte.hu', 'retained-provider-message', 'UNMATCHED',
           'NO_VALID_REPLY_TOKEN', 'UNRECOGNIZED', '[]'::jsonb, 'Retained', 'Retained',
           CURRENT_TIMESTAMP, 0, '[]'::jsonb)`,
        [inboundMessageId],
      );
      await database.query(
        `INSERT INTO customer_inbound_message_processing (message_id, classification)
         VALUES ($1, 'Egyéb')`,
        [inboundMessageId],
      );
      await database.undoLastMigration();
      await database.undoLastMigration();
      await assert.rejects(
        database.undoLastMigration(),
        /Migration 0021 cannot remove retained Customer correspondence processing history/,
      );
      await database.query(
        'DELETE FROM customer_inbound_message_processing WHERE message_id = $1',
        [inboundMessageId],
      );
      await database.undoLastMigration();
      await assert.rejects(
        database.undoLastMigration(),
        /Migration 0020 cannot remove retained Customer inbound messages/,
      );
    } finally {
      if (database?.isInitialized) await database.destroy();
      if (admin.isInitialized) {
        await admin.query(
          'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
          [databaseName],
        );
        await admin.query(`DROP DATABASE IF EXISTS "${databaseName}"`);
        await admin.destroy();
      }
    }
  });
});

function withDatabaseName(databaseUrl: string, databaseName: string): string {
  const parsed = new URL(databaseUrl);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}
