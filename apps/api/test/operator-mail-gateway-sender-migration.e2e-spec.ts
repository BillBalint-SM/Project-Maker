import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';

import { migrationsForHistoricalDatabase } from './migration-harness';

describe('Operator mail gateway sender migration (PostgreSQL)', () => {
  it('accepts a valid non-provider sender and continues rejecting malformed addresses', async () => {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) throw new Error('DATABASE_URL is required for the mail gateway migration proof.');

    const databaseName = `operator_mail_gateway_${randomUUID().replaceAll('-', '')}`;
    const admin = new DataSource({ type: 'postgres', url: databaseUrl });
    let database: DataSource | undefined;

    const projectId = randomUUID();
    const followUpId = randomUUID();
    const attemptId = randomUUID();
    const outboundId = randomUUID();

    try {
      await admin.initialize();
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      database = new DataSource({
        type: 'postgres',
        url: withDatabaseName(databaseUrl, databaseName),
        migrations: [
          ...migrationsForHistoricalDatabase(
            'OperatorMailGatewaySender0024OperatorMailGatewaySender1787904000000',
          ),
        ],
      });
      await database.initialize();
      await database.runMigrations();

      await database.query(
        `INSERT INTO projects (id, name, customer_contact_name, customer_contact_email)
         VALUES ($1, 'Operator mail gateway', 'Customer contact', 'customer@example.test')`,
        [projectId],
      );
      await database.query(
        `INSERT INTO customer_follow_ups (
           id, project_id, message_draft, draft_version, last_delivery_status
         ) VALUES ($1, $2, 'Synthetic ping draft', 1, 'NEVER')`,
        [followUpId, projectId],
      );
      await database.query(
        `UPDATE customer_follow_ups
         SET preview_sender_name = 'Operator mailbox',
             preview_sender_address = 'correspondence@example.test'
         WHERE id = $1`,
        [followUpId],
      );

      await database.query(
        `INSERT INTO customer_follow_up_delivery_attempts (
           id, project_id, draft_version, state, recipient_email,
           subject_length, text_length, attempted_at
         ) VALUES ($1, $2, 1, 'FAILED', 'customer@example.test', 7, 4, CURRENT_TIMESTAMP)`,
        [attemptId, projectId],
      );
      await database.query(
        `INSERT INTO customer_outbound_communications (
           id, project_id, source_type, source_id, sender_name, sender_address,
           recipient_name, recipient_address, subject, html_content, text_content,
           source_content_version, preview_digest, reply_to_address, reply_token_hash
         ) VALUES ($1, $2, 'CUSTOMER_FOLLOW_UP_PING', $3,
           'Operator mailbox', 'correspondence@example.test',
           'Customer contact', 'customer@example.test', 'Subject', '', 'Text', 1,
           repeat('a', 64), 'correspondence+token@example.test', repeat('b', 64))`,
        [outboundId, projectId, attemptId],
      );

      const retained = await database.query<Array<{ senderAddress: string }>>(
        `SELECT sender_address AS "senderAddress"
         FROM customer_outbound_communications
         WHERE id = $1`,
        [outboundId],
      );
      assert.deepEqual(retained, [{ senderAddress: 'correspondence@example.test' }]);

      await assert.rejects(
        database.query(
          `UPDATE customer_follow_ups
           SET preview_sender_address = 'not-an-email'
           WHERE id = $1`,
          [followUpId],
        ),
        (error: unknown) => isConstraintViolation(error, 'chk_follow_up_preview_sender'),
      );

      await assert.rejects(
        database.undoLastMigration(),
        /Migration 0024 cannot restore the retired provider-specific sender constraint/,
      );
    } finally {
      if (database?.isInitialized) await database.destroy();
      if (admin.isInitialized) {
        await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
        await admin.destroy();
      }
    }
  });
});

function isConstraintViolation(error: unknown, constraint: string): boolean {
  return Boolean(
    error
    && typeof error === 'object'
    && 'driverError' in error
    && error.driverError
    && typeof error.driverError === 'object'
    && 'code' in error.driverError
    && error.driverError.code === '23514'
    && 'constraint' in error.driverError
    && error.driverError.constraint === constraint,
  );
}

function withDatabaseName(databaseUrl: string, databaseName: string): string {
  const parsed = new URL(databaseUrl);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}
