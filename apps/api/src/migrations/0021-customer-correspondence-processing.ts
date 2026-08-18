import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerCorrespondenceProcessing0021CustomerCorrespondenceProcessing1787644800000
  implements MigrationInterface
{
  name = 'CustomerCorrespondenceProcessing0021CustomerCorrespondenceProcessing1787644800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer_correspondences"
      ADD COLUMN "processing_version" integer NOT NULL DEFAULT 1
      CHECK ("processing_version" > 0)
    `);
    await queryRunner.query(`
      CREATE TABLE "customer_inbound_message_processing" (
        "message_id" uuid PRIMARY KEY REFERENCES "customer_inbound_messages"("id") ON DELETE RESTRICT,
        "classification" varchar(40) NOT NULL,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_customer_message_classification" CHECK (
          "classification" IN ('Elfogadva', 'Módosítást kér', 'Kérdés vagy válasz', 'Egyéb')
        )
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const retained = await queryRunner.query(
      'SELECT COUNT(*)::text AS "count" FROM "customer_inbound_message_processing"',
    ) as Array<{ count: string }>;
    if ((retained[0]?.count ?? '0') !== '0') {
      throw new Error('Migration 0021 cannot remove retained Customer correspondence processing history.');
    }
    await queryRunner.query('DROP TABLE "customer_inbound_message_processing"');
    await queryRunner.query('ALTER TABLE "customer_correspondences" DROP COLUMN "processing_version"');
  }
}
