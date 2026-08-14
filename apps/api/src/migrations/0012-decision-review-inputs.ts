import type { MigrationInterface, QueryRunner } from 'typeorm';

const ratingColumns = [
  'business_value_rating',
  'strategic_alignment_rating',
  'urgency_rating',
  'confidence_rating',
  'complexity_rating',
  'risk_rating',
] as const;

export class DecisionReviewInputs0012DecisionReviewInputs1786867200000
  implements MigrationInterface
{
  name = 'DecisionReviewInputs0012DecisionReviewInputs1786867200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const column of ratingColumns) {
      await queryRunner.query(`ALTER TABLE "projects" ADD COLUMN "${column}" smallint`);
      await queryRunner.query(`
        ALTER TABLE "projects"
        ADD CONSTRAINT "chk_projects_${column}_range"
        CHECK ("${column}" IS NULL OR "${column}" BETWEEN 1 AND 5)
      `);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('LOCK TABLE "projects" IN ACCESS EXCLUSIVE MODE');
    const rows = await queryRunner.query(`
      SELECT 1
      FROM "projects"
      WHERE ${ratingColumns.map((column) => `"${column}" IS NOT NULL`).join(' OR ')}
      LIMIT 1
    `);
    if (rows.length > 0) {
      throw new Error('Migration 0012 cannot remove persisted Decision Review inputs.');
    }

    for (const column of [...ratingColumns].reverse()) {
      await queryRunner.query(
        `ALTER TABLE "projects" DROP CONSTRAINT "chk_projects_${column}_range"`,
      );
      await queryRunner.query(`ALTER TABLE "projects" DROP COLUMN "${column}"`);
    }
  }
}
