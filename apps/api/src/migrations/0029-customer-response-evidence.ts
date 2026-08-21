import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerResponseEvidence0029CustomerResponseEvidence1788336000000 implements MigrationInterface {
  name = 'CustomerResponseEvidence0029CustomerResponseEvidence1788336000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "evidence"
      DROP CONSTRAINT "chk_evidence_source_kind",
      ADD CONSTRAINT "chk_evidence_source_kind" CHECK (
        "source_kind" IN ('ROUND_ANSWER', 'CUSTOMER_MESSAGE_EXCERPT', 'METRIC', 'HTTPS_LINK', 'ATTACHMENT', 'CUSTOMER_RESPONSE')
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const retained = await queryRunner.query(`SELECT COUNT(*)::text AS "count" FROM "evidence" WHERE "source_kind" = 'CUSTOMER_RESPONSE'`) as Array<{ count: string }>;
    if ((retained[0]?.count ?? '0') !== '0') {
      throw new Error('Migration 0029 cannot remove retained Customer response Evidence.');
    }
    await queryRunner.query(`
      ALTER TABLE "evidence"
      DROP CONSTRAINT "chk_evidence_source_kind",
      ADD CONSTRAINT "chk_evidence_source_kind" CHECK (
        "source_kind" IN ('ROUND_ANSWER', 'CUSTOMER_MESSAGE_EXCERPT', 'METRIC', 'HTTPS_LINK', 'ATTACHMENT')
      )
    `);
  }
}
