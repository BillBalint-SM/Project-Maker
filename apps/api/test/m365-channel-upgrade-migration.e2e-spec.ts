import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';

import { migrationsForFreshDatabase, migrationsForHistoricalDatabase } from './migration-harness';

describe('Microsoft 365 channel supported-baseline migration (PostgreSQL)', () => {
  it('preserves legacy Project, handoff and ping records through the complete channel schema', async () => {
    const configuredDatabaseUrl = process.env['DATABASE_URL'];
    if (!configuredDatabaseUrl) {
      throw new Error('DATABASE_URL is required for the Microsoft 365 channel migration proof.');
    }

    const databaseName = `m365_channel_upgrade_${randomUUID().replaceAll('-', '')}`;
    const admin = new DataSource({ type: 'postgres', url: configuredDatabaseUrl });
    let database: DataSource | undefined;

    const projectId = randomUUID();
    const schemaId = randomUUID();
    const roundId = randomUUID();
    const handoffId = randomUUID();
    const followUpId = randomUUID();
    const pingAttemptId = randomUUID();

    try {
      await admin.initialize();
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      database = new DataSource({
        type: 'postgres',
        url: withDatabaseName(configuredDatabaseUrl, databaseName),
        migrations: [
          ...migrationsForHistoricalDatabase(
            'ProjectStartCreationRequest0016ProjectStartCreationRequest1787212800000',
          ),
        ],
      });
      await database.initialize();
      await database.runMigrations();

      const questions = await database.query<Array<{ id: string }>>(
        'SELECT id FROM base_questions ORDER BY display_order LIMIT 1',
      );
      assert.ok(questions[0]?.id);
      await database.query(
        `INSERT INTO projects (
           id, name, customer_contact_name, customer_contact_email,
           internal_owner_name, next_action_owner_role
         ) VALUES ($1, 'Legacy channel Project', 'Test Customer', 'customer@example.test',
           'Test Owner', 'INTERNAL_OWNER')`,
        [projectId],
      );
      await database.query(
        `INSERT INTO project_question_schemas (id, project_id, schema_version, bank_version, source)
         VALUES ($1, $2, 1, 1, 'M365_CHANNEL_UPGRADE')`,
        [schemaId, projectId],
      );
      await database.query(
        `INSERT INTO interview_rounds (
           id, project_id, project_schema_id, type, source
         ) VALUES ($1, $2, $3, 'INITIAL_INTAKE', 'M365_CHANNEL_UPGRADE')`,
        [roundId, projectId, schemaId],
      );
      await database.query(
        `INSERT INTO round_question_snapshots (
           id, round_id, base_question_id, stable_key, topic, control_point,
           text, type, required, blocking, display_order
         ) VALUES ($1, $2, $3, 'm365-channel-upgrade', 'Channel', 'Upgrade',
           'Synthetic migration proof', 'TEXT', false, false, 1)`,
        [randomUUID(), roundId, questions[0].id],
      );
      await database.query(
        `UPDATE interview_rounds
         SET status = 'ENDED', completed_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [roundId],
      );
      await database.query(
        `INSERT INTO interview_customer_handoffs (id, project_id, round_id, version, state)
         VALUES ($1, $2, $3, 1, 'DRAFT')`,
        [handoffId, projectId, roundId],
      );
      await database.query(
        `INSERT INTO customer_follow_ups (
           id, project_id, message_draft, draft_version, last_delivery_status
         ) VALUES ($1, $2, 'Synthetic ping draft', 1, 'SENT')`,
        [followUpId, projectId],
      );
      await database.query(
        `INSERT INTO customer_follow_up_delivery_attempts (
           id, project_id, draft_version, state, recipient_email,
           subject_length, text_length, attempted_at, sent_at
         ) VALUES ($1, $2, 1, 'SENT', 'customer@example.test', 20, 20,
           CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [pingAttemptId, projectId],
      );
      await database.destroy();

      database = new DataSource({
        type: 'postgres',
        url: withDatabaseName(configuredDatabaseUrl, databaseName),
        migrations: [...migrationsForFreshDatabase()],
      });
      await database.initialize();
      await database.runMigrations();

      const retained = await database.query<Array<{
        projectId: string;
        handoffId: string;
        handoffState: string;
        handoffCorrespondenceId: string | null;
        pingAttemptId: string;
        pingState: string;
        pingCorrespondenceId: string | null;
      }>>(
        `SELECT project.id AS "projectId", handoff.id AS "handoffId",
           handoff.state AS "handoffState",
           handoff.correspondence_id AS "handoffCorrespondenceId",
           attempt.id AS "pingAttemptId", attempt.state AS "pingState",
           attempt.correspondence_id AS "pingCorrespondenceId"
         FROM projects project
         JOIN interview_customer_handoffs handoff ON handoff.project_id = project.id
         JOIN customer_follow_up_delivery_attempts attempt ON attempt.project_id = project.id
         WHERE project.id = $1`,
        [projectId],
      );
      assert.deepEqual(retained, [{
        projectId,
        handoffId,
        handoffState: 'DRAFT',
        handoffCorrespondenceId: null,
        pingAttemptId,
        pingState: 'SENT',
        pingCorrespondenceId: null,
      }]);

      const currentChannelTables = await database.query<Array<{ tableName: string }>>(
        `SELECT table_name AS "tableName"
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name IN (
             'customer_mailbox_sync',
             'customer_inbound_messages',
             'customer_inbound_message_processing',
             'customer_mail_triage'
           )
         ORDER BY table_name`,
      );
      assert.deepEqual(currentChannelTables.map(({ tableName }) => tableName), [
        'customer_inbound_message_processing',
        'customer_inbound_messages',
        'customer_mail_triage',
        'customer_mailbox_sync',
      ]);
    } finally {
      if (database?.isInitialized) await database.destroy();
      if (admin.isInitialized) {
        await admin.query(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
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
