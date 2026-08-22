import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { describe, it } from 'node:test';
import { DataSource } from 'typeorm';

import {
  migrationsForFreshDatabase,
  migrationsForHistoricalDatabase,
} from './migration-harness';

describe('Project archive resume migration (PostgreSQL)', () => {
  it('retains the latest known phase and safely pauses legacy automatic reminders', async () => {
    const databaseUrl = process.env['DATABASE_URL'];
    if (!databaseUrl) {
      throw new Error('DATABASE_URL is required for the Project archive resume migration proof.');
    }

    const databaseName = `project_archive_resume_${randomUUID().replaceAll('-', '')}`;
    const admin = new DataSource({ type: 'postgres', url: databaseUrl });
    let database: DataSource | undefined;
    const retainedProjectId = randomUUID();
    const fallbackProjectId = randomUUID();
    const activeProjectId = randomUUID();

    try {
      await admin.initialize();
      await admin.query(`CREATE DATABASE "${databaseName}"`);
      database = new DataSource({
        type: 'postgres',
        url: withDatabaseName(databaseUrl, databaseName),
        migrations: [
          ...migrationsForHistoricalDatabase(
            'CanonicalCustomerMailPersistence0032CanonicalCustomerMailPersistence1788595200000',
          ),
        ],
      });
      await database.initialize();
      await database.runMigrations();

      await database.query(
        `INSERT INTO projects (id, name, customer_contact_name, customer_contact_email, status)
         VALUES
           ($1, 'Retained archived phase', 'Customer', 'retained@example.test', 'ARCHIVED'),
           ($2, 'Fallback archived phase', 'Customer', 'fallback@example.test', 'ARCHIVED'),
           ($3, 'Active project', 'Customer', 'active@example.test', 'WAITING_INTERNAL')`,
        [retainedProjectId, fallbackProjectId, activeProjectId],
      );
      await database.query(
        `INSERT INTO audit_events (id, project_id, event_type, payload, created_at)
         VALUES
           ($1, $3, 'PROJECT_ARCHIVED', '{"fromStatus":"DRAFT","toStatus":"ARCHIVED"}'::jsonb, '2026-08-20T09:00:00.000Z'),
           ($2, $3, 'PROJECT_ARCHIVED', '{"fromStatus":"WAITING_CUSTOMER","toStatus":"ARCHIVED"}'::jsonb, '2026-08-21T09:00:00.000Z')`,
        [randomUUID(), randomUUID(), retainedProjectId],
      );
      await database.query(
        `INSERT INTO customer_follow_ups (id, project_id, enabled, interval_minutes, next_ping_at)
         VALUES
           ($1, $3, true, 45, '2026-08-22T10:00:00.000Z'),
           ($2, $4, true, 30, '2026-08-22T10:00:00.000Z')`,
        [randomUUID(), randomUUID(), retainedProjectId, activeProjectId],
      );

      await database.destroy();
      database = new DataSource({
        type: 'postgres',
        url: withDatabaseName(databaseUrl, databaseName),
        migrations: [...migrationsForFreshDatabase()],
      });
      await database.initialize();
      await database.runMigrations();

      const projects = await database.query<
        Array<{ id: string; archivedFromStatus: string | null }>
      >(
        `SELECT id, archived_from_status AS "archivedFromStatus"
         FROM projects WHERE id = ANY($1::uuid[]) ORDER BY id`,
        [[retainedProjectId, fallbackProjectId, activeProjectId]],
      );
      const phaseByProject = new Map(
        projects.map((project) => [project.id, project.archivedFromStatus]),
      );
      assert.equal(phaseByProject.get(retainedProjectId), 'WAITING_CUSTOMER');
      assert.equal(phaseByProject.get(fallbackProjectId), 'DRAFT');
      assert.equal(phaseByProject.get(activeProjectId), null);

      const schedules = await database.query<
        Array<{
          projectId: string;
          enabled: boolean;
          nextPingAt: Date | null;
          pausedRemainingMilliseconds: string | null;
        }>
      >(
        `SELECT project_id AS "projectId", enabled, next_ping_at AS "nextPingAt",
                paused_remaining_milliseconds AS "pausedRemainingMilliseconds"
         FROM customer_follow_ups WHERE project_id = ANY($1::uuid[]) ORDER BY project_id`,
        [[retainedProjectId, activeProjectId]],
      );
      const scheduleByProject = new Map(schedules.map((schedule) => [schedule.projectId, schedule]));
      assert.deepEqual(scheduleByProject.get(retainedProjectId), {
        projectId: retainedProjectId,
        enabled: true,
        nextPingAt: null,
        pausedRemainingMilliseconds: String(45 * 60_000),
      });
      assert.equal(scheduleByProject.get(activeProjectId)?.enabled, true);
      assert.ok(scheduleByProject.get(activeProjectId)?.nextPingAt instanceof Date);
      assert.equal(
        scheduleByProject.get(activeProjectId)?.pausedRemainingMilliseconds,
        null,
      );
      await assert.rejects(
        database.query(
          `UPDATE customer_follow_ups
           SET paused_remaining_milliseconds = 31536000001
           WHERE project_id = $1`,
          [retainedProjectId],
        ),
        /chk_customer_follow_ups_paused_remaining_milliseconds/,
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

function withDatabaseName(databaseUrl: string, databaseName: string): string {
  const parsed = new URL(databaseUrl);
  parsed.pathname = `/${databaseName}`;
  return parsed.toString();
}
