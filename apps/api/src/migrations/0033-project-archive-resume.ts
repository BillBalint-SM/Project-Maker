import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectArchiveResume0033ProjectArchiveResume1788681600000
  implements MigrationInterface
{
  name = 'ProjectArchiveResume0033ProjectArchiveResume1788681600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN "archived_from_status" "project_status",
      ADD CONSTRAINT "chk_projects_archived_from_status_active"
        CHECK ("archived_from_status" IS NULL OR "archived_from_status" <> 'ARCHIVED')
    `);
    await queryRunner.query(`
      UPDATE "projects" project
      SET "archived_from_status" = COALESCE((
        SELECT CASE
          WHEN event."payload" ->> 'fromStatus' IN (
            'DRAFT', 'INTAKE_IN_PROGRESS', 'WAITING_INTERNAL',
            'WAITING_CUSTOMER', 'READY_FOR_PLANNING'
          ) THEN (event."payload" ->> 'fromStatus')::"project_status"
          ELSE NULL
        END
        FROM "audit_events" event
        WHERE event."project_id" = project."id"
          AND event."event_type" = 'PROJECT_ARCHIVED'
        ORDER BY event."created_at" DESC, event."id" DESC
        LIMIT 1
      ), 'DRAFT'::"project_status")
      WHERE project."status" = 'ARCHIVED'
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_follow_ups"
      ADD COLUMN "paused_remaining_milliseconds" bigint,
      ADD CONSTRAINT "chk_customer_follow_ups_paused_remaining_milliseconds"
        CHECK (
          "paused_remaining_milliseconds" IS NULL
          OR "paused_remaining_milliseconds" BETWEEN 1 AND 31536000000
        )
    `);
    await queryRunner.query(`
      UPDATE "customer_follow_ups" follow_up
      SET "paused_remaining_milliseconds" = follow_up."interval_minutes"::bigint * 60000,
          "next_ping_at" = NULL
      FROM "projects" project
      WHERE project."id" = follow_up."project_id"
        AND project."status" = 'ARCHIVED'
        AND follow_up."enabled"
        AND follow_up."next_ping_at" IS NOT NULL
    `);
  }

  async down(): Promise<void> {
    throw new Error(
      'Project archive resume is forward-only because it stores the phase and reminder cadence needed to resume retained Project work.',
    );
  }
}
