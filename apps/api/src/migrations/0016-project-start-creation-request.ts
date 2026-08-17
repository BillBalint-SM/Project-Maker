import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ProjectStartCreationRequest0016ProjectStartCreationRequest1787212800000
  implements MigrationInterface
{
  name = 'ProjectStartCreationRequest0016ProjectStartCreationRequest1787212800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects"
      ADD COLUMN "creation_request_id" uuid,
      ADD CONSTRAINT "uq_projects_creation_request" UNIQUE ("creation_request_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "projects"
      DROP CONSTRAINT "uq_projects_creation_request",
      DROP COLUMN "creation_request_id"
    `);
  }
}
