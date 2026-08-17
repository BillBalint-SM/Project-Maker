import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';

import { migrationsForFreshDatabase } from './migration-harness';

describe('Microsoft 365 Customer follow-up ping migration (PostgreSQL)', () => {
  it('reverts an empty expansion and refuses to discard retained ping correspondence', async () => {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) throw new Error('DATABASE_URL is required for the migration proof.');
    const databaseName = `comm_01_5_${Date.now()}_${randomUUID().replaceAll('-', '')}`;
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
      const absent = await database.query<Array<{ column_name: string }>>(
        `SELECT column_name FROM information_schema.columns
         WHERE table_name = 'customer_follow_up_delivery_attempts'
           AND column_name = 'outbound_communication_id'`,
      );
      assert.deepEqual(absent, []);
      await database.runMigrations();

      const projectId = randomUUID();
      const attemptId = randomUUID();
      const outboundId = randomUUID();
      const correspondenceId = randomUUID();
      await database.query(
        `INSERT INTO projects (id, name, customer_contact_name, customer_contact_email)
         VALUES ($1, 'Ping migration', 'Customer', 'customer@example.test')`,
        [projectId],
      );
      await database.query(
        `INSERT INTO customer_follow_up_delivery_attempts
           (id, project_id, draft_version, state, recipient_email, subject_length,
            text_length, attempted_at)
         VALUES ($1, $2, 1, 'SENDING', 'customer@example.test', 7, 4, CURRENT_TIMESTAMP)`,
        [attemptId, projectId],
      );
      await database.query(
        `INSERT INTO customer_outbound_communications
           (id, project_id, source_type, source_id, sender_name, sender_address,
            recipient_name, recipient_address, subject, html_content, text_content,
            source_content_version, preview_digest, reply_to_address, reply_token_hash)
         VALUES ($1, $2, 'CUSTOMER_FOLLOW_UP_PING', $3, 'PO', 'po@pte.hu',
            'Customer', 'customer@example.test', 'Subject', '', 'Text', 1,
            repeat('a', 64), 'project-maker+token@pte.hu', repeat('b', 64))`,
        [outboundId, projectId, attemptId],
      );
      await database.query(
        `INSERT INTO customer_correspondences
           (id, project_id, outbound_communication_id)
         VALUES ($1, $2, $3)`,
        [correspondenceId, projectId, outboundId],
      );
      await database.query(
        `UPDATE customer_follow_up_delivery_attempts
         SET outbound_communication_id = $2, correspondence_id = $3
         WHERE id = $1`,
        [attemptId, outboundId, correspondenceId],
      );

      await assert.rejects(
        database.undoLastMigration(),
        /Migration 0018 cannot remove Customer follow-up correspondence history/,
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
