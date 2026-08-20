import type { MigrationInterface, QueryRunner } from 'typeorm';

export class OperatorMailGatewaySender0024OperatorMailGatewaySender1787904000000
  implements MigrationInterface
{
  name = 'OperatorMailGatewaySender0024OperatorMailGatewaySender1787904000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "customer_outbound_communications"
      DROP CONSTRAINT "customer_outbound_communications_sender_address_check",
      ADD CONSTRAINT "customer_outbound_communications_sender_address_check"
        CHECK (lower("sender_address") ~ '^[^@[:space:]]+@[^@[:space:]]+$')
    `);
    await queryRunner.query(`
      ALTER TABLE "interview_customer_handoffs"
      DROP CONSTRAINT "chk_handoff_sender_snapshot",
      ADD CONSTRAINT "chk_handoff_sender_snapshot" CHECK (
        ("sender_name" IS NULL AND "sender_address" IS NULL)
        OR (
          length(btrim("sender_name")) > 0
          AND lower("sender_address") ~ '^[^@[:space:]]+@[^@[:space:]]+$'
        )
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_follow_ups"
      DROP CONSTRAINT "chk_follow_up_preview_sender",
      ADD CONSTRAINT "chk_follow_up_preview_sender" CHECK (
        ("preview_sender_name" IS NULL AND "preview_sender_address" IS NULL)
        OR (
          length(btrim("preview_sender_name")) > 0
          AND lower("preview_sender_address") ~ '^[^@[:space:]]+@[^@[:space:]]+$'
        )
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(`
      SELECT (
        (SELECT COUNT(*) FROM "customer_outbound_communications"
          WHERE lower("sender_address") !~ '^[^@[:space:]]+@pte\\.hu$')
        + (SELECT COUNT(*) FROM "interview_customer_handoffs"
          WHERE "sender_address" IS NOT NULL
            AND lower("sender_address") !~ '^[^@[:space:]]+@pte\\.hu$')
        + (SELECT COUNT(*) FROM "customer_follow_ups"
          WHERE "preview_sender_address" IS NOT NULL
            AND lower("preview_sender_address") !~ '^[^@[:space:]]+@pte\\.hu$')
      )::text AS "incompatibleCount"
    `)) as Array<{ incompatibleCount: string }>;
    if ((rows[0]?.incompatibleCount ?? '0') !== '0') {
      throw new Error(
        'Migration 0024 cannot restore the retired provider-specific sender constraint while non-provider correspondence history exists.',
      );
    }

    await queryRunner.query(`
      ALTER TABLE "customer_follow_ups"
      DROP CONSTRAINT "chk_follow_up_preview_sender",
      ADD CONSTRAINT "chk_follow_up_preview_sender" CHECK (
        ("preview_sender_name" IS NULL AND "preview_sender_address" IS NULL)
        OR (
          length(btrim("preview_sender_name")) > 0
          AND lower("preview_sender_address") ~ '^[^@[:space:]]+@pte\\.hu$'
        )
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "interview_customer_handoffs"
      DROP CONSTRAINT "chk_handoff_sender_snapshot",
      ADD CONSTRAINT "chk_handoff_sender_snapshot" CHECK (
        ("sender_name" IS NULL AND "sender_address" IS NULL)
        OR (
          length(btrim("sender_name")) > 0
          AND lower("sender_address") ~ '^[^@[:space:]]+@pte\\.hu$'
        )
      )
    `);
    await queryRunner.query(`
      ALTER TABLE "customer_outbound_communications"
      DROP CONSTRAINT "customer_outbound_communications_sender_address_check",
      ADD CONSTRAINT "customer_outbound_communications_sender_address_check"
        CHECK (lower("sender_address") ~ '^[^@[:space:]]+@pte\\.hu$')
    `);
  }
}
