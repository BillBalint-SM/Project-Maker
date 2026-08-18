import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ReceiptProvenHandoffRevision0022ReceiptProvenHandoffRevision1787731200000
  implements MigrationInterface
{
  name = 'ReceiptProvenHandoffRevision0022ReceiptProvenHandoffRevision1787731200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "uq_interview_customer_handoffs_active_round"');
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_interview_customer_handoffs_active_round"
      ON "interview_customer_handoffs" ("round_id")
      WHERE "state" IN ('DRAFT', 'SENDING', 'FAILED')
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const incompatibleRounds = await queryRunner.query(`
      SELECT "round_id"
      FROM "interview_customer_handoffs"
      WHERE "state" <> 'SENT'
      GROUP BY "round_id"
      HAVING COUNT(*) > 1
      LIMIT 1
    `) as Array<{ round_id: string }>;
    if (incompatibleRounds.length > 0) {
      throw new Error('Migration 0022 cannot restore the prior active-handoff index after an UNKNOWN handoff was superseded.');
    }
    await queryRunner.query('DROP INDEX "uq_interview_customer_handoffs_active_round"');
    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_interview_customer_handoffs_active_round"
      ON "interview_customer_handoffs" ("round_id")
      WHERE "state" <> 'SENT'
    `);
  }
}
