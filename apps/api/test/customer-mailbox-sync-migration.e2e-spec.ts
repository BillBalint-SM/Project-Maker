import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';

import { migrationsForHistoricalDatabase } from './migration-harness';

describe('Customer mailbox synchronization migration (PostgreSQL)', () => {
  it('reverts an unused sync state and refuses to discard an established delta baseline', async () => {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) throw new Error('DATABASE_URL is required for the mailbox sync migration proof.');
    const databaseName = `mailbox_sync_${Date.now()}_${randomUUID().replaceAll('-', '')}`;
    const admin = new DataSource({ type: 'postgres', url: databaseUrl });
    let database: DataSource | undefined;

    try {
      await admin.initialize();
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      database = new DataSource({
        type: 'postgres',
        url: withDatabaseName(databaseUrl, databaseName),
        migrations: [...migrationsForHistoricalDatabase('CustomerMailboxSync0019CustomerMailboxSync1787472000000')],
      });
      await database.initialize();
      await database.runMigrations();
      await database.undoLastMigration();
      const absent = await database.query<Array<{ table_name: string }>>(
        `SELECT table_name FROM information_schema.tables WHERE table_name = 'customer_mailbox_sync'`,
      );
      assert.deepEqual(absent, []);

      await database.runMigrations();
      await database.query(
        `INSERT INTO customer_mailbox_sync
           (mailbox_address, delta_checkpoint, baseline_established, state, last_successful_sync_at)
         VALUES ('project-maker@pte.hu', 'delta-retained', true, 'CURRENT', CURRENT_TIMESTAMP)`,
      );

      await assert.rejects(
        database.undoLastMigration(),
        /Migration 0019 cannot remove an established Customer mailbox delta baseline/,
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
