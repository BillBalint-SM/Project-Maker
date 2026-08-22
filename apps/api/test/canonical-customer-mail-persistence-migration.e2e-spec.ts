import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';

import {
  migrationsForFreshDatabase,
  migrationsForHistoricalDatabase,
} from './migration-harness';

describe('Canonical Customer-mail persistence migration (PostgreSQL)', () => {
  it('moves complete legacy snapshots to the canonical mail records without discarding incomplete or inbound history', async () => {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) {
      throw new Error(
        'DATABASE_URL is required for the canonical Customer-mail migration proof.',
      );
    }

    const databaseName = `canonical_customer_mail_${Date.now()}_${randomUUID().replaceAll('-', '')}`;
    const admin = new DataSource({ type: 'postgres', url: databaseUrl });
    let database: DataSource | undefined;
    const ids = {
      project: randomUUID(),
      schema: randomUUID(),
      round: randomUUID(),
      firstHandoff: randomUUID(),
      secondHandoff: randomUUID(),
      incompleteHandoff: randomUUID(),
      firstOutbound: randomUUID(),
      secondOutbound: randomUUID(),
      firstCorrespondence: randomUUID(),
      secondCorrespondence: randomUUID(),
      linkedFollowUpAttempt: randomUUID(),
      legacyFollowUpAttempt: randomUUID(),
      followUpOutbound: randomUUID(),
      followUpCorrespondence: randomUUID(),
      followUp: randomUUID(),
      inbound: randomUUID(),
    };
    const mailboxAddress = `canonical-${randomUUID()}@example.test`;
    const retainedSyncAt = '2026-08-20T08:00:00.000Z';

    try {
      await admin.initialize();
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      database = new DataSource({
        type: 'postgres',
        url: withDatabaseName(databaseUrl, databaseName),
        migrations: [
          ...migrationsForHistoricalDatabase(
            'ClaudeCodeMcpConnection0031ClaudeCodeMcpConnection1788508800000',
          ),
        ],
      });
      await database.initialize();
      await database.runMigrations();

      await seedPre0032History(database, ids, mailboxAddress, retainedSyncAt);
      await database.destroy();

      database = new DataSource({
        type: 'postgres',
        url: withDatabaseName(databaseUrl, databaseName),
        migrations: [...migrationsForFreshDatabase()],
      });
      await database.initialize();
      await database.runMigrations();

      const handoffs = await database.query<
        Array<{
          id: string;
          outbound_communication_id: string | null;
          correspondence_id: string | null;
          sender_name: string | null;
          recipient_email: string | null;
          subject: string | null;
          sent_at: string | null;
        }>
      >(
        `SELECT id, outbound_communication_id, correspondence_id, sender_name, recipient_email, subject,
                to_char(sent_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS sent_at
         FROM interview_customer_handoffs
         WHERE id = ANY($1::uuid[])
         ORDER BY id`,
        [[ids.firstHandoff, ids.secondHandoff, ids.incompleteHandoff]],
      );
      const byHandoff = new Map(handoffs.map((row) => [row.id, row]));
      for (const handoffId of [ids.firstHandoff, ids.secondHandoff]) {
        const handoff = byHandoff.get(handoffId);
        assert.ok(
          handoff?.outbound_communication_id,
          'complete handoff retains a canonical outbound link',
        );
        assert.ok(
          handoff?.correspondence_id,
          'complete handoff retains a canonical correspondence link',
        );
        assert.equal(handoff.sender_name, null);
        assert.equal(handoff.recipient_email, null);
        assert.equal(handoff.subject, null);
        assert.equal(handoff.sent_at, null);
      }
      assert.deepEqual(byHandoff.get(ids.incompleteHandoff), {
        id: ids.incompleteHandoff,
        outbound_communication_id: null,
        correspondence_id: null,
        sender_name: null,
        recipient_email: 'legacy@example.test',
        subject: 'Régi, még olvasható összefoglaló',
        sent_at: '2026-08-17T10:00:00.000Z',
      });

      const correspondenceRows = await database.query<
        Array<{ id: string; predecessor_id: string | null }>
      >(
        'SELECT id, predecessor_id FROM customer_correspondences WHERE id = ANY($1::uuid[]) ORDER BY id',
        [[ids.firstCorrespondence, ids.secondCorrespondence]],
      );
      assert.deepEqual(
        new Map(
          correspondenceRows.map((row) => [row.id, row.predecessor_id]),
        ).get(ids.secondCorrespondence),
        ids.firstCorrespondence,
      );

      const outboundRows = await database.query<
        Array<{ source_id: string; sender_address: string; subject: string }>
      >(
        `SELECT source_id, sender_address, subject FROM customer_outbound_communications
         WHERE id = ANY($1::uuid[]) ORDER BY source_id`,
        [[ids.firstOutbound, ids.secondOutbound, ids.followUpOutbound]],
      );
      assert.deepEqual(
        new Map(
          outboundRows.map((row) => [
            row.source_id,
            {
              sender_address: row.sender_address,
              subject: row.subject,
            },
          ]),
        ),
        new Map([
          [
            ids.firstHandoff,
            { sender_address: 'po@pte.hu', subject: 'Első összefoglaló' },
          ],
          [
            ids.secondHandoff,
            { sender_address: 'po@pte.hu', subject: 'Javított összefoglaló' },
          ],
          [
            ids.linkedFollowUpAttempt,
            { sender_address: 'po@pte.hu', subject: 'Ügyfél egyeztetés' },
          ],
        ]),
      );

      const attempts = await database.query<
        Array<{
          outbound_communication_id: string;
          result: string;
          failure_code: string | null;
          message_reference: string | null;
        }>
      >(
        `SELECT outbound_communication_id, result, failure_code, message_reference
         FROM customer_outbound_attempts
         WHERE outbound_communication_id = ANY($1::uuid[])
         ORDER BY outbound_communication_id`,
        [[ids.firstOutbound, ids.secondOutbound, ids.followUpOutbound]],
      );
      assert.deepEqual(
        new Map(
          attempts.map((row) => [
            row.outbound_communication_id,
            {
              result: row.result,
              failure_code: row.failure_code,
              message_reference: row.message_reference,
            },
          ]),
        ),
        new Map([
          [
            ids.firstOutbound,
            {
              result: 'ACCEPTED',
              failure_code: null,
              message_reference: '<first@mailer.test>',
            },
          ],
          [
            ids.secondOutbound,
            {
              result: 'REJECTED',
              failure_code: 'SMTP_550',
              message_reference: '<second@mailer.test>',
            },
          ],
          [
            ids.followUpOutbound,
            {
              result: 'ACCEPTED',
              failure_code: null,
              message_reference: '<follow-up@mailer.test>',
            },
          ],
        ]),
      );

      const followUpAttempts = await database.query<
        Array<{
          id: string;
          outbound_communication_id: string | null;
          correspondence_id: string | null;
          recipient_email: string | null;
          subject_length: number | null;
          text_length: number | null;
          failure_code: string | null;
          sent_at: string | null;
        }>
      >(
        `SELECT id, outbound_communication_id, correspondence_id, recipient_email, subject_length, text_length, failure_code,
                to_char(sent_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS sent_at
         FROM customer_follow_up_delivery_attempts WHERE id = ANY($1::uuid[]) ORDER BY id`,
        [[ids.linkedFollowUpAttempt, ids.legacyFollowUpAttempt]],
      );
      const byFollowUpAttempt = new Map(
        followUpAttempts.map((row) => [row.id, row]),
      );
      assert.deepEqual(byFollowUpAttempt.get(ids.linkedFollowUpAttempt), {
        id: ids.linkedFollowUpAttempt,
        outbound_communication_id: ids.followUpOutbound,
        correspondence_id: ids.followUpCorrespondence,
        recipient_email: null,
        subject_length: null,
        text_length: null,
        failure_code: null,
        sent_at: null,
      });
      assert.deepEqual(byFollowUpAttempt.get(ids.legacyFollowUpAttempt), {
        id: ids.legacyFollowUpAttempt,
        outbound_communication_id: null,
        correspondence_id: null,
        recipient_email: 'legacy-ping@example.test',
        subject_length: 21,
        text_length: 34,
        failure_code: 'LEGACY_FAILURE',
        sent_at: null,
      });

      const legacyFollowUp = await database.query<
        Array<{
          last_delivery_status: string;
          last_delivery_error: string | null;
        }>
      >(
        'SELECT last_delivery_status, last_delivery_error FROM customer_follow_ups WHERE id = $1',
        [ids.followUp],
      );
      assert.deepEqual(legacyFollowUp, [
        {
          last_delivery_status: 'FAILED',
          last_delivery_error: 'LEGACY_FAILURE',
        },
      ]);

      const syncRows = await database.query<
        Array<{
          delta_checkpoint: string | null;
          baseline_established: boolean;
          state: string;
          last_successful_sync_at: string;
        }>
      >(
        `SELECT delta_checkpoint, baseline_established, state,
                to_char(last_successful_sync_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS last_successful_sync_at
         FROM customer_mailbox_sync WHERE mailbox_address = $1`,
        [mailboxAddress],
      );
      assert.deepEqual(syncRows, [
        {
          delta_checkpoint: null,
          baseline_established: false,
          state: 'INITIALIZING',
          last_successful_sync_at: retainedSyncAt,
        },
      ]);
      const retainedInbound = await database.query<
        Array<{ id: string; correlation_state: string }>
      >(
        'SELECT id, correlation_state FROM customer_inbound_messages WHERE id = $1',
        [ids.inbound],
      );
      assert.deepEqual(retainedInbound, [
        { id: ids.inbound, correlation_state: 'UNMATCHED' },
      ]);
      const retainedTriage = await database.query<
        Array<{ message_id: string; state: string }>
      >(
        'SELECT message_id, state FROM customer_mail_triage WHERE message_id = $1',
        [ids.inbound],
      );
      assert.deepEqual(retainedTriage, [
        { message_id: ids.inbound, state: 'OPEN' },
      ]);

      const constraints = await database.query<Array<{ conname: string }>>(
        `SELECT conname FROM pg_constraint
         WHERE conrelid IN ('customer_follow_up_delivery_attempts'::regclass, 'interview_customer_handoffs'::regclass)
           AND conname IN ('chk_customer_follow_up_attempt_lengths', 'chk_customer_follow_up_attempt_sent_at', 'chk_interview_customer_handoffs_sent_at')
         ORDER BY conname`,
      );
      assert.deepEqual(constraints, [
        { conname: 'chk_customer_follow_up_attempt_sent_at' },
        { conname: 'chk_interview_customer_handoffs_sent_at' },
      ]);
      const nullableLegacyFields = await database.query<
        Array<{ table_name: string; column_name: string; is_nullable: string }>
      >(
        `SELECT table_name, column_name, is_nullable FROM information_schema.columns
         WHERE (table_name = 'customer_follow_up_delivery_attempts' AND column_name IN ('recipient_email', 'subject_length', 'text_length'))
         ORDER BY column_name`,
      );
      assert.deepEqual(nullableLegacyFields, [
        {
          table_name: 'customer_follow_up_delivery_attempts',
          column_name: 'recipient_email',
          is_nullable: 'YES',
        },
        {
          table_name: 'customer_follow_up_delivery_attempts',
          column_name: 'subject_length',
          is_nullable: 'YES',
        },
        {
          table_name: 'customer_follow_up_delivery_attempts',
          column_name: 'text_length',
          is_nullable: 'YES',
        },
      ]);
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

async function seedPre0032History(
  database: DataSource,
  ids: Record<string, string>,
  mailboxAddress: string,
  retainedSyncAt: string,
): Promise<void> {
  await database.query(
    `INSERT INTO projects (id, name, customer_contact_name, customer_contact_email)
     VALUES ($1, 'Canonical migration', 'Ügyfél', 'customer@example.test')`,
    [ids.project],
  );
  await database.query(
    `INSERT INTO project_question_schemas (id, project_id, schema_version, bank_version, source)
     VALUES ($1, $2, 1, 1, 'migration-proof')`,
    [ids.schema, ids.project],
  );
  await database.query('ALTER TABLE interview_rounds DISABLE TRIGGER ALL');
  await database.query(
    `INSERT INTO interview_rounds (id, project_id, project_schema_id, type, status, completed_at, source, content_version)
     VALUES ($1, $2, $3, 'INITIAL_INTAKE', 'ENDED', '2026-08-17T09:00:00.000Z', 'migration-proof', 1)`,
    [ids.round, ids.project, ids.schema],
  );
  await database.query('ALTER TABLE interview_rounds ENABLE TRIGGER ALL');
  await database.query(
    'ALTER TABLE interview_customer_handoffs DISABLE TRIGGER ALL',
  );
  await database.query(
    `INSERT INTO interview_customer_handoffs (
       id, project_id, round_id, version, state, modification_summary, recipient_name, recipient_email,
       internal_owner_name, sender_name, sender_address, reply_to_address, reply_token_hash,
       mail_system_acceptance, message_reference, subject, html_content, text_content,
       preview_digest, source_content_version, failure_code, attempted_at, sent_at
     ) VALUES
       ($1, $2, $3, 1, 'SENT', NULL, 'Ügyfél', 'customer@example.test', 'PO', 'PO', 'po@pte.hu',
        'project-maker+first@pte.hu', repeat('a', 64), 'ACCEPTED', '<first@mailer.test>',
        'Első összefoglaló', '<p>Első</p>', 'Első', repeat('b', 64), 1, NULL,
        '2026-08-17T10:00:00.000Z', '2026-08-17T10:00:00.000Z'),
       ($4, $2, $3, 2, 'FAILED', 'Javított válasz', 'Ügyfél', 'customer@example.test', 'PO', 'PO', 'po@pte.hu',
        'project-maker+second@pte.hu', repeat('c', 64), 'REJECTED', '<second@mailer.test>',
        'Javított összefoglaló', '<p>Javított</p>', 'Javított', repeat('d', 64), 2, 'SMTP_550',
        '2026-08-17T11:00:00.000Z', NULL),
       ($5, $2, $3, 3, 'SENT', 'Régi megőrzött összefoglaló', 'Régi ügyfél', 'legacy@example.test', 'PO', NULL, NULL, NULL, NULL,
        NULL, NULL, 'Régi, még olvasható összefoglaló', '<p>Régi</p>', 'Régi', repeat('e', 64), 1, NULL,
        '2026-08-17T10:00:00.000Z', '2026-08-17T10:00:00.000Z')`,
    [
      ids.firstHandoff,
      ids.project,
      ids.round,
      ids.secondHandoff,
      ids.incompleteHandoff,
    ],
  );
  await database.query(
    'UPDATE interview_customer_handoffs SET supersedes_handoff_id = $2 WHERE id = $1',
    [ids.secondHandoff, ids.firstHandoff],
  );
  await database.query(
    'ALTER TABLE interview_customer_handoffs ENABLE TRIGGER ALL',
  );

  await database.query(
    'ALTER TABLE customer_outbound_communications DISABLE TRIGGER ALL',
  );
  await database.query(
    `INSERT INTO customer_outbound_communications (
       id, project_id, source_type, source_id, sender_name, sender_address, recipient_name, recipient_address,
       subject, html_content, text_content, source_content_version, preview_digest, reply_to_address, reply_token_hash
     ) VALUES
       ($1, $2, 'INTERVIEW_HANDOFF', $3, 'PO', 'po@pte.hu', 'Ügyfél', 'customer@example.test',
        'Első összefoglaló', '<p>Első</p>', 'Első', 1, repeat('b', 64), 'project-maker+first@pte.hu', repeat('a', 64)),
       ($4, $2, 'INTERVIEW_HANDOFF', $5, 'PO', 'po@pte.hu', 'Ügyfél', 'customer@example.test',
        'Javított összefoglaló', '<p>Javított</p>', 'Javított', 2, repeat('d', 64), 'project-maker+second@pte.hu', repeat('c', 64))`,
    [
      ids.firstOutbound,
      ids.project,
      ids.firstHandoff,
      ids.secondOutbound,
      ids.secondHandoff,
    ],
  );
  await database.query(
    'ALTER TABLE customer_outbound_communications ENABLE TRIGGER ALL',
  );
  await database.query(
    `INSERT INTO customer_correspondences (id, project_id, outbound_communication_id, predecessor_id, status)
     VALUES ($1, $2, $3, NULL, 'Válaszra vár'), ($4, $2, $5, $1, 'Válaszra vár')`,
    [
      ids.firstCorrespondence,
      ids.project,
      ids.firstOutbound,
      ids.secondCorrespondence,
      ids.secondOutbound,
    ],
  );
  await database.query(
    'ALTER TABLE interview_customer_handoffs DISABLE TRIGGER ALL',
  );
  await database.query(
    `UPDATE interview_customer_handoffs SET outbound_communication_id = CASE id
       WHEN $1::uuid THEN $2::uuid WHEN $3::uuid THEN $4::uuid END,
       correspondence_id = CASE id WHEN $1::uuid THEN $5::uuid WHEN $3::uuid THEN $6::uuid END
     WHERE id IN ($1, $3)`,
    [
      ids.firstHandoff,
      ids.firstOutbound,
      ids.secondHandoff,
      ids.secondOutbound,
      ids.firstCorrespondence,
      ids.secondCorrespondence,
    ],
  );
  await database.query(
    'ALTER TABLE interview_customer_handoffs ENABLE TRIGGER ALL',
  );

  await database.query(
    `INSERT INTO customer_follow_ups (id, project_id, enabled, last_delivery_status, last_delivery_error)
     VALUES ($1, $2, false, 'FAILED', 'LEGACY_FAILURE')`,
    [ids.followUp, ids.project],
  );
  await database.query(
    `INSERT INTO customer_follow_up_delivery_attempts (
       id, project_id, draft_version, state, recipient_email, subject_length, text_length, failure_code, attempted_at, sent_at
     ) VALUES
       ($1, $2, 1, 'SENT', 'customer@example.test', 21, 34, NULL, '2026-08-17T12:00:00.000Z', '2026-08-17T12:00:00.000Z'),
       ($3, $2, 2, 'FAILED', 'legacy-ping@example.test', 21, 34, 'LEGACY_FAILURE', '2026-08-17T13:00:00.000Z', NULL)`,
    [ids.linkedFollowUpAttempt, ids.project, ids.legacyFollowUpAttempt],
  );
  await database.query(
    'ALTER TABLE customer_outbound_communications DISABLE TRIGGER ALL',
  );
  await database.query(
    `INSERT INTO customer_outbound_communications (
       id, project_id, source_type, source_id, sender_name, sender_address, recipient_name, recipient_address,
       subject, html_content, text_content, source_content_version, preview_digest, reply_to_address, reply_token_hash
     ) VALUES ($1, $2, 'CUSTOMER_FOLLOW_UP_PING', $3, 'PO', 'po@pte.hu', 'Ügyfél', 'customer@example.test',
       'Ügyfél egyeztetés', '<p>Egyeztetés</p>', 'Egyeztetés', 1, repeat('f', 64),
       'project-maker+follow-up@pte.hu', repeat('9', 64))`,
    [ids.followUpOutbound, ids.project, ids.linkedFollowUpAttempt],
  );
  await database.query(
    'ALTER TABLE customer_outbound_communications ENABLE TRIGGER ALL',
  );
  await database.query(
    `INSERT INTO customer_correspondences (id, project_id, outbound_communication_id, status)
     VALUES ($1, $2, $3, 'Válaszra vár')`,
    [ids.followUpCorrespondence, ids.project, ids.followUpOutbound],
  );
  await database.query(
    `UPDATE customer_follow_up_delivery_attempts
     SET outbound_communication_id = $2, correspondence_id = $3,
         mail_system_acceptance = 'ACCEPTED', message_reference = '<follow-up@mailer.test>'
     WHERE id = $1`,
    [
      ids.linkedFollowUpAttempt,
      ids.followUpOutbound,
      ids.followUpCorrespondence,
    ],
  );

  await database.query(
    `INSERT INTO customer_mailbox_sync (
       mailbox_address, delta_checkpoint, baseline_established, state, last_successful_sync_at, lease_token, lease_expires_at
     ) VALUES ($1, 'v1:encrypted-looking-checkpoint', true, 'CURRENT', $2::timestamptz, $3, $4::timestamptz)`,
    [mailboxAddress, retainedSyncAt, randomUUID(), '2026-08-20T09:00:00.000Z'],
  );
  await database.query(
    `INSERT INTO customer_inbound_messages (
       id, mailbox_address, provider_message_reference, correlation_state, correlation_evidence, sender_classification,
       recipient_addresses, text_content, visible_text, received_at, attachment_count, attachments
     ) VALUES ($1, $2, 'retained-unmatched', 'UNMATCHED', 'NO_VALID_REPLY_TOKEN', 'UNRECOGNIZED',
       '[]'::jsonb, 'Megőrzött levél', 'Megőrzött levél', '2026-08-20T07:00:00.000Z', 0, '[]'::jsonb)`,
    [ids.inbound, mailboxAddress],
  );
  await database.query(
    'INSERT INTO customer_mail_triage (message_id) VALUES ($1)',
    [ids.inbound],
  );
}

function withDatabaseName(databaseUrl: string, databaseName: string): string {
  const parsed = new URL(databaseUrl);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}
