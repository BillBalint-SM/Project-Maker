import type { MigrationInterface, QueryRunner } from 'typeorm';

export class ClaudeCodeMcpConnection0031ClaudeCodeMcpConnection1788508800000
  implements MigrationInterface
{
  name = 'ClaudeCodeMcpConnection0031ClaudeCodeMcpConnection1788508800000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "internal_users"
      ADD COLUMN "mcp_token_digest" char(64),
      ADD COLUMN "mcp_token_created_at" timestamptz,
      ADD CONSTRAINT "chk_internal_users_mcp_token" CHECK (
        ("mcp_token_digest" IS NULL AND "mcp_token_created_at" IS NULL)
        OR ("mcp_token_digest" IS NOT NULL AND "mcp_token_created_at" IS NOT NULL)
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX "uq_internal_users_mcp_token_digest" ON "internal_users" ("mcp_token_digest") WHERE "mcp_token_digest" IS NOT NULL',
    );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "uq_internal_users_mcp_token_digest"');
    await queryRunner.query('ALTER TABLE "internal_users" DROP CONSTRAINT "chk_internal_users_mcp_token"');
    await queryRunner.query('ALTER TABLE "internal_users" DROP COLUMN "mcp_token_created_at", DROP COLUMN "mcp_token_digest"');
  }
}
