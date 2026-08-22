import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';

import { DataSource } from 'typeorm';

import { migrationsForFreshDatabase, migrationsForHistoricalDatabase } from './migration-harness';

describe('Supported migration sequence (PostgreSQL)', () => {
  it('upgrades the oldest supported database without losing retained Project history', async () => {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) throw new Error('DATABASE_URL is required for the supported migration sequence proof.');

    const databaseName = `supported_migration_sequence_${randomUUID().replaceAll('-', '')}`;
    const admin = new DataSource({ type: 'postgres', url: databaseUrl });
    let database: DataSource | undefined;
    const projectId = randomUUID();
    const auditId = randomUUID();
    const revisionId = randomUUID();
    const inboundId = randomUUID();
    const userId = randomUUID();
    const attachmentId = randomUUID();
    const mailboxAddress = `migration-${randomUUID()}@example.test`;

    const connectThrough = async (migrationName: string): Promise<DataSource> => {
      if (database?.isInitialized) await database.destroy();
      database = new DataSource({
        type: 'postgres',
        url: withDatabaseName(databaseUrl, databaseName),
        migrations: [...migrationsForHistoricalDatabase(migrationName)],
        migrationsTransactionMode: 'each',
      });
      await database.initialize();
      await database.runMigrations();
      return database;
    };

    try {
      await admin.initialize();
      await admin.query(`CREATE DATABASE "${databaseName}"`);

      let current = await connectThrough('Core0001Core1785916800000');
      await current.query(
        `INSERT INTO projects (id, name, customer_contact_name, customer_contact_email)
         VALUES ($1, 'Retained Project', 'Customer contact', 'customer@example.test')`,
        [projectId],
      );
      await current.query(
        `INSERT INTO audit_events (id, project_id, event_type, payload)
         VALUES ($1, $2, 'PROJECT_CREATED', '{"source":"oldest-supported"}'::jsonb)`,
        [auditId, projectId],
      );

      current = await connectThrough('MarkdownRevisions0003MarkdownRevisions1786089600000');
      await current.query(
        `INSERT INTO markdown_revisions (id, project_id, version, reason, source_snapshot, change_summary, content)
         VALUES ($1, $2, 1, 'MANUAL', '{"source":"oldest-supported"}'::jsonb,
                 'Retained specification', '# Retained specification')`,
        [revisionId, projectId],
      );

      current = await connectThrough('CustomerMailboxSync0019CustomerMailboxSync1787472000000');
      await current.query(
        `INSERT INTO customer_mailbox_sync (mailbox_address, state)
         VALUES ($1, 'INITIALIZING')`,
        [mailboxAddress],
      );

      current = await connectThrough('CorrelatedCustomerReplies0020CorrelatedCustomerReplies1787558400000');
      await current.query(
        `INSERT INTO customer_inbound_messages (
           id, mailbox_address, provider_message_reference, correlation_state, correlation_evidence,
           sender_classification, recipient_addresses, text_content, visible_text, received_at,
           attachment_count, attachments
         ) VALUES ($1, $2, 'retained-customer-message', 'UNMATCHED', 'NO_VALID_REPLY_TOKEN',
                   'UNRECOGNIZED', '[]'::jsonb, 'Retained Customer-mail', 'Retained Customer-mail',
                   CURRENT_TIMESTAMP, 0, '[]'::jsonb)`,
        [inboundId, mailboxAddress],
      );

      current = await connectThrough('LocalIdentityAndAuditActor0025LocalIdentityAndAuditActor1787990400000');
      await current.query(
        `INSERT INTO internal_users (id, email, password_hash)
         VALUES ($1, 'retained.user@example.test', 'retained-password-digest')`,
        [userId],
      );

      current = await connectThrough('EvidenceBasedDiscovery0026EvidenceBasedDiscovery1788076800000');
      await current.query(
        `INSERT INTO governed_attachments (
           id, project_id, owner_kind, owner_id, original_name, content_type, size_bytes, sha256, content
         ) VALUES ($1, $2, 'QUESTION_BANK', $3, 'retained.txt', 'text/plain', 2,
                   repeat('a', 64), decode('0102', 'hex'))`,
        [attachmentId, projectId, randomUUID()],
      );

      if (database?.isInitialized) await database.destroy();
      database = new DataSource({
        type: 'postgres',
        url: withDatabaseName(databaseUrl, databaseName),
        migrations: [...migrationsForFreshDatabase()],
        migrationsTransactionMode: 'each',
      });
      await database.initialize();
      await database.runMigrations();

      const retained = await database.query<Array<{
        projectName: string;
        auditActor: string;
        specification: string;
        customerMail: string;
        identity: string;
        attachment: string;
      }>>(
        `SELECT project.name AS "projectName", audit.actor_id AS "auditActor",
                revision.content AS specification, inbound.visible_text AS "customerMail",
                internal_user.email AS identity, encode(attachment.content, 'hex') AS attachment
         FROM projects project
         JOIN audit_events audit ON audit.id = $2
         JOIN markdown_revisions revision ON revision.id = $3
         JOIN customer_inbound_messages inbound ON inbound.id = $4
         JOIN internal_users internal_user ON internal_user.id = $5
         JOIN governed_attachments attachment ON attachment.id = $6
         WHERE project.id = $1`,
        [projectId, auditId, revisionId, inboundId, userId, attachmentId],
      );
      assert.deepEqual(retained, [{
        projectName: 'Retained Project',
        auditActor: 'system',
        specification: '# Retained specification',
        customerMail: 'Retained Customer-mail',
        identity: 'retained.user@example.test',
        attachment: '0102',
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
