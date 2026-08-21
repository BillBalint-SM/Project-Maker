import type { MigrationInterface, QueryRunner } from 'typeorm';

export class LocalIdentityAndAuditActor0025LocalIdentityAndAuditActor1787990400000
  implements MigrationInterface
{
  name = 'LocalIdentityAndAuditActor0025LocalIdentityAndAuditActor1787990400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "internal_users" (
        "id" uuid PRIMARY KEY,
        "email" varchar(320) NOT NULL,
        "password_hash" text NOT NULL,
        "active" boolean NOT NULL DEFAULT true,
        "deactivated_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_internal_users_email" CHECK (
          "email" = lower(btrim("email"))
          AND position('@' IN "email") > 1
        ),
        CONSTRAINT "chk_internal_users_deactivation" CHECK (
          ("active" AND "deactivated_at" IS NULL)
          OR (NOT "active" AND "deactivated_at" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_internal_users_email" ON "internal_users" (lower("email"))',
    );
    await queryRunner.query(`
      CREATE TABLE "internal_user_sessions" (
        "token_digest" char(64) PRIMARY KEY,
        "user_id" uuid NOT NULL REFERENCES "internal_users"("id") ON DELETE CASCADE,
        "expires_at" timestamptz NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_internal_user_sessions_expires_at" ON "internal_user_sessions" ("expires_at")',
    );
    await queryRunner.query(`
      ALTER TABLE "audit_events"
      ADD COLUMN "actor_id" varchar(100) NOT NULL DEFAULT 'system',
      ADD CONSTRAINT "chk_audit_events_actor_id" CHECK (btrim("actor_id") <> '')
    `);
  }

  async down(): Promise<void> {
    throw new Error('Migration 0025 is forward-only because it stores internal account history.');
  }
}
