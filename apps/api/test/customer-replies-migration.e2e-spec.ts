import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';

import { migrationsForFreshDatabase, migrationsForHistoricalDatabase } from './migration-harness';

describe('Correlated Customer replies migration (PostgreSQL)', () => {
  it('preserves the established baseline while expiring the pre-retention checkpoint', async () => {
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
});

function withDatabaseName(databaseUrl: string, databaseName: string): string {
  const parsed = new URL(databaseUrl);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}
