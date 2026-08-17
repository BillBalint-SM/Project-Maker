import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';

import { migrationsForHistoricalDatabase } from './migration-harness';

const CUSTOMER_FOLLOW_UP_PING_MIGRATION =
  'CustomerFollowUpPingDraft0015CustomerFollowUpPingDraft1787126400000';

describe('Customer follow-up ping migration (PostgreSQL)', () => {
  it('migrates empty drafts and refuses rollback after retained ping activity', async () => {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required for the Customer follow-up migration proof.');
    }
    const databaseName = `comm_01_1b_${Date.now()}_${randomUUID().replaceAll('-', '')}`;
    const migrationUrl = withDatabaseName(databaseUrl, databaseName);
    const admin = new DataSource({ type: 'postgres', url: databaseUrl });
    let migrationDataSource: DataSource | undefined;

    try {
      await admin.initialize();
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      migrationDataSource = new DataSource({
        type: 'postgres',
        url: migrationUrl,
        migrations: [...migrationsForHistoricalDatabase(CUSTOMER_FOLLOW_UP_PING_MIGRATION)],
      });
      await migrationDataSource.initialize();
      await migrationDataSource.runMigrations();

      const projectId = randomUUID();
      await migrationDataSource.query(
        `INSERT INTO "projects" ("id", "name", "customer_contact_name", "customer_contact_email")
         VALUES ($1, 'Migration proof', 'Ügyfél Anna', 'migration@example.test')`,
        [projectId],
      );
      await migrationDataSource.query(
        `INSERT INTO "customer_follow_ups" ("id", "project_id", "interval_minutes")
         VALUES ($1, $2, 10080)`,
        [randomUUID(), projectId],
      );
      const defaults = await migrationDataSource.query<
        Array<{ messageDraft: string | null; referencedFollowUpId: string | null; draftVersion: number }>
      >(
        `SELECT "message_draft" AS "messageDraft",
                "referenced_follow_up_id" AS "referencedFollowUpId",
                "draft_version" AS "draftVersion"
         FROM "customer_follow_ups" WHERE "project_id" = $1`,
        [projectId],
      );
      assert.deepEqual(defaults, [{ messageDraft: null, referencedFollowUpId: null, draftVersion: 1 }]);

      await migrationDataSource.undoLastMigration();
      const reverted = await migrationDataSource.query<Array<{ columnName: string }>>(
        `SELECT column_name AS "columnName"
         FROM information_schema.columns
         WHERE table_name = 'customer_follow_ups' AND column_name = 'message_draft'`,
      );
      assert.deepEqual(reverted, []);

      await migrationDataSource.runMigrations();
      await migrationDataSource.query(
        `UPDATE "customer_follow_ups"
         SET "message_draft" = 'Megőrzendő ügyfélüzenet', "draft_version" = 2
         WHERE "project_id" = $1`,
        [projectId],
      );
      await assert.rejects(
        migrationDataSource.undoLastMigration(),
        /Migration 0015 cannot remove retained Customer follow-up ping activity \(drafts=1, attempts=0\)/,
      );
      const preserved = await migrationDataSource.query<Array<{ messageDraft: string }>>(
        `SELECT "message_draft" AS "messageDraft"
         FROM "customer_follow_ups" WHERE "project_id" = $1`,
        [projectId],
      );
      assert.deepEqual(preserved, [{ messageDraft: 'Megőrzendő ügyfélüzenet' }]);
    } finally {
      if (migrationDataSource?.isInitialized) {
        await migrationDataSource.destroy();
      }
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
