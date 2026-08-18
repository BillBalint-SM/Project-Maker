import type { MigrationInterface, QueryRunner } from 'typeorm';

export class CustomerMailboxSync0019CustomerMailboxSync1787472000000
  implements MigrationInterface
{
  name = 'CustomerMailboxSync0019CustomerMailboxSync1787472000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "customer_mailbox_sync" (
        "mailbox_address" varchar(320) PRIMARY KEY,
        "delta_checkpoint" text,
        "baseline_established" boolean NOT NULL DEFAULT false,
        "state" varchar(40) NOT NULL,
        "last_successful_sync_at" timestamptz,
        "last_attempted_sync_at" timestamptz,
        "failure_code" varchar(40),
        "lease_token" uuid,
        "lease_expires_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_customer_mailbox_sync_state" CHECK (
          "state" IN ('INITIALIZING', 'CURRENT', 'DELAYED', 'UNAVAILABLE', 'CONFIGURATION_ERROR', 'AUTHORIZATION_ERROR')
        ),
        CONSTRAINT "chk_customer_mailbox_sync_lease" CHECK (
          ("lease_token" IS NULL AND "lease_expires_at" IS NULL)
          OR ("lease_token" IS NOT NULL AND "lease_expires_at" IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "customer_mailbox_change_inbox" (
        "mailbox_address" varchar(320) NOT NULL,
        "message_reference" varchar(500) NOT NULL,
        "internet_message_id" text,
        "in_reply_to" text,
        "sender_address" varchar(320),
        "subject" text,
        "text_content" text,
        "received_at" timestamptz,
        "observed_at" timestamptz NOT NULL,
        CONSTRAINT "pk_customer_mailbox_change_inbox"
          PRIMARY KEY ("mailbox_address", "message_reference"),
        CONSTRAINT "fk_customer_mailbox_change_inbox_mailbox"
          FOREIGN KEY ("mailbox_address") REFERENCES "customer_mailbox_sync" ("mailbox_address")
      )
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const retained = await queryRunner.query(
      `SELECT (
         (SELECT COUNT(*) FROM "customer_mailbox_sync"
          WHERE "baseline_established" = true OR "delta_checkpoint" IS NOT NULL)
         + (SELECT COUNT(*) FROM "customer_mailbox_change_inbox")
       )::text AS "count"`,
    ) as Array<{ count: string }>;
    if ((retained[0]?.count ?? '0') !== '0') {
      throw new Error(
        'Migration 0019 cannot remove an established Customer mailbox delta baseline.',
      );
    }
    await queryRunner.query('DROP TABLE "customer_mailbox_change_inbox"');
    await queryRunner.query('DROP TABLE "customer_mailbox_sync"');
  }
}
