import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DiscoveryFollowUpEditVersion0008DiscoveryFollowUpEditVersion1786521600000
  implements MigrationInterface
{
  name = 'DiscoveryFollowUpEditVersion0008DiscoveryFollowUpEditVersion1786521600000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "discovery_follow_ups"
      ADD COLUMN "version" integer NOT NULL DEFAULT 1,
      ADD CONSTRAINT "chk_discovery_follow_ups_version_positive"
      CHECK ("version" > 0)
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "discovery_follow_ups"
      DROP CONSTRAINT "chk_discovery_follow_ups_version_positive",
      DROP COLUMN "version"
    `);
  }
}
