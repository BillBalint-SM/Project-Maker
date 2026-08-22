import type { MigrationInterface, QueryRunner } from 'typeorm';

export class QuestionBankReferenceFiles0035QuestionBankReferenceFiles1788854400000
  implements MigrationInterface
{
  name = 'QuestionBankReferenceFiles0035QuestionBankReferenceFiles1788854400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "question_reference_file_contents" (
        "id" uuid PRIMARY KEY,
        "original_name" varchar(255) NOT NULL,
        "content_type" varchar(100) NOT NULL,
        "size_bytes" integer NOT NULL,
        "sha256" char(64) NOT NULL,
        "content" bytea NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "chk_question_reference_contents_name" CHECK (btrim("original_name") <> ''),
        CONSTRAINT "chk_question_reference_contents_type" CHECK (btrim("content_type") <> ''),
        CONSTRAINT "chk_question_reference_contents_size" CHECK (
          "size_bytes" > 0 AND "size_bytes" <= 52428800
        ),
        CONSTRAINT "chk_question_reference_contents_digest" CHECK (
          "sha256" ~ '^[0-9a-f]{64}$'
        )
      )
    `);
    await queryRunner.query(`
      CREATE TABLE "question_reference_files" (
        "question_id" uuid NOT NULL REFERENCES "base_questions"("id") ON DELETE RESTRICT,
        "file_id" uuid NOT NULL REFERENCES "question_reference_file_contents"("id") ON DELETE RESTRICT,
        PRIMARY KEY ("question_id", "file_id")
      )
    `);
    await queryRunner.query(
      'CREATE INDEX "idx_question_reference_files_file" ON "question_reference_files" ("file_id", "question_id")',
    );
    await queryRunner.query(`
      INSERT INTO "question_reference_file_contents" (
        "id", "original_name", "content_type", "size_bytes", "sha256", "content", "created_at"
      )
      SELECT attachment."id", attachment."original_name", attachment."content_type",
             attachment."size_bytes", attachment."sha256", attachment."content",
             attachment."created_at"
      FROM "governed_attachments" attachment
      INNER JOIN "base_questions" question ON question."id" = attachment."owner_id"
      WHERE attachment."owner_kind" = 'QUESTION_BANK'
    `);
    await queryRunner.query(`
      INSERT INTO "question_reference_files" ("question_id", "file_id")
      SELECT attachment."owner_id", attachment."id"
      FROM "governed_attachments" attachment
      INNER JOIN "base_questions" question ON question."id" = attachment."owner_id"
      WHERE attachment."owner_kind" = 'QUESTION_BANK'
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_question_reference_contents_immutable"
      BEFORE UPDATE OR DELETE ON "question_reference_file_contents"
      FOR EACH ROW EXECUTE FUNCTION "reject_immutable_question_record_change"()
    `);
    await queryRunner.query(`
      CREATE TRIGGER "trg_question_reference_files_immutable"
      BEFORE UPDATE OR DELETE ON "question_reference_files"
      FOR EACH ROW EXECUTE FUNCTION "reject_immutable_question_record_change"()
    `);
  }

  async down(): Promise<void> {
    throw new Error(
      'Question Bank reference files are forward-only because published bank versions retain their exact file set.',
    );
  }
}
