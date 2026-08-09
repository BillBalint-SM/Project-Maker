import type { MigrationInterface, QueryRunner } from 'typeorm';

export class DiscoveryFollowUpResolution0007DiscoveryFollowUpResolution1786435200000
  implements MigrationInterface
{
  name = 'DiscoveryFollowUpResolution0007DiscoveryFollowUpResolution1786435200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "discovery_follow_ups" ADD COLUMN "decision_or_answer" text',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'ALTER TABLE "discovery_follow_ups" DROP COLUMN "decision_or_answer"',
    );
  }
}
