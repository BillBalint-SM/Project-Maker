import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DiscoveryFollowUpSourceLinkage0011DiscoveryFollowUpSourceLinkage1786780800000
  implements MigrationInterface
{
  name = 'DiscoveryFollowUpSourceLinkage0011DiscoveryFollowUpSourceLinkage1786780800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "discovery_follow_ups" ADD COLUMN "source_snapshot_id" uuid',
    );
    await queryRunner.query(`
      ALTER TABLE "discovery_follow_ups"
      ADD CONSTRAINT "fk_discovery_follow_ups_source_snapshot"
      FOREIGN KEY ("source_snapshot_id")
      REFERENCES "round_question_snapshots"("id") ON DELETE RESTRICT
    `);
    await queryRunner.query(`
      CREATE INDEX "idx_discovery_follow_ups_source_snapshot_id"
      ON "discovery_follow_ups" ("source_snapshot_id")
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'DROP INDEX "idx_discovery_follow_ups_source_snapshot_id"',
    );
    await queryRunner.query(`
      ALTER TABLE "discovery_follow_ups"
      DROP CONSTRAINT "fk_discovery_follow_ups_source_snapshot"
    `);
    await queryRunner.query(
      'ALTER TABLE "discovery_follow_ups" DROP COLUMN "source_snapshot_id"',
    );
  }
}
