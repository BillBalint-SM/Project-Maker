import type { MigrationInterface, QueryRunner } from 'typeorm';

export class Core0001Core1785916800000 implements MigrationInterface {
  name = 'Core0001Core1785916800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "project_status" AS ENUM (
        'DRAFT',
        'INTAKE_IN_PROGRESS',
        'WAITING_INTERNAL',
        'WAITING_CUSTOMER',
        'READY_FOR_PLANNING',
        'ARCHIVED'
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "projects" (
        "id" uuid PRIMARY KEY,
        "name" varchar(255) NOT NULL,
        "customer_contact_name" varchar(255) NOT NULL,
        "customer_contact_email" varchar(320) NOT NULL,
        "status" "project_status" NOT NULL DEFAULT 'DRAFT',
        "ball_owner" varchar(255),
        "next_action" text,
        "due_date" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_projects_name_not_blank" CHECK (btrim("name") <> ''),
        CONSTRAINT "chk_projects_customer_contact_name_not_blank" CHECK (btrim("customer_contact_name") <> ''),
        CONSTRAINT "chk_projects_customer_contact_email" CHECK (
          btrim("customer_contact_email") <> ''
          AND position('@' IN "customer_contact_email") > 1
        )
      )
    `);

    await queryRunner.query(`
      CREATE FUNCTION "set_projects_updated_at"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        NEW."updated_at" = CURRENT_TIMESTAMP;
        RETURN NEW;
      END;
      $$
    `);

    await queryRunner.query(`
      CREATE TRIGGER "trg_projects_updated_at"
      BEFORE UPDATE ON "projects"
      FOR EACH ROW
      EXECUTE FUNCTION "set_projects_updated_at"()
    `);

    await queryRunner.query(`
      CREATE TABLE "audit_events" (
        "id" uuid PRIMARY KEY,
        "project_id" uuid NOT NULL,
        "event_type" varchar(100) NOT NULL,
        "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_audit_events_event_type_not_blank" CHECK (btrim("event_type") <> ''),
        CONSTRAINT "fk_audit_events_project_id"
          FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT
      )
    `);

    await queryRunner.query(
      'CREATE INDEX "idx_projects_status_updated_at" ON "projects" ("status", "updated_at" DESC)'
    );
    await queryRunner.query(
      'CREATE INDEX "idx_projects_due_date" ON "projects" ("due_date") WHERE "due_date" IS NOT NULL'
    );
    await queryRunner.query(
      'CREATE INDEX "idx_audit_events_project_id_created_at" ON "audit_events" ("project_id", "created_at" DESC)'
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE "audit_events"');
    await queryRunner.query('DROP TABLE "projects"');
    await queryRunner.query('DROP FUNCTION "set_projects_updated_at"()');
    await queryRunner.query('DROP TYPE "project_status"');
  }
}
