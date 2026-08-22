import {
  TableForeignKey,
  type MigrationInterface,
  type QueryRunner,
} from 'typeorm';

const internalProjectDataForeignKeys = [
  ['audit_events', 'fk_audit_events_project_id'],
  ['customer_follow_ups', 'fk_customer_follow_ups_project'],
  ['customer_follow_ups', 'fk_customer_follow_ups_reference_project'],
  ['delivery_packages', 'delivery_packages_project_id_fkey'],
  ['delivery_packages', 'delivery_packages_specification_revision_id_fkey'],
  ['discovery_follow_ups', 'fk_discovery_follow_ups_project'],
  ['discovery_follow_ups', 'fk_discovery_follow_ups_source_snapshot'],
  ['evidence', 'evidence_attachment_id_fkey'],
  ['evidence', 'evidence_project_id_fkey'],
  ['evidence', 'evidence_round_id_fkey'],
  ['evidence', 'evidence_snapshot_id_fkey'],
  ['formal_decisions', 'formal_decisions_project_id_fkey'],
  ['formal_decisions', 'formal_decisions_specification_revision_id_fkey'],
  ['governed_attachments', 'governed_attachments_project_id_fkey'],
  ['insight_evidence', 'insight_evidence_evidence_id_fkey'],
  ['insights', 'insights_project_id_fkey'],
  ['interview_customer_handoffs', 'fk_interview_customer_handoffs_project'],
  ['interview_customer_handoffs', 'fk_interview_customer_handoffs_round'],
  ['interview_customer_handoffs', 'fk_interview_customer_handoffs_supersedes'],
  ['interview_rounds', 'fk_interview_rounds_project'],
  ['interview_rounds', 'fk_interview_rounds_schema'],
  ['markdown_revisions', 'fk_markdown_revisions_previous'],
  ['markdown_revisions', 'fk_markdown_revisions_project'],
  ['project_contacts', 'project_contacts_project_id_fkey'],
  ['project_question_schemas', 'fk_project_question_schemas_project'],
  ['project_schema_questions', 'fk_project_schema_questions_schema'],
  ['project_schema_questions', 'fk_project_schema_questions_schema_bank_version'],
  ['project_status_updates', 'project_status_updates_project_id_fkey'],
  ['round_answers', 'fk_round_answers_round'],
  ['round_answers', 'fk_round_answers_round_snapshot'],
  [
    'round_question_assessment_overrides',
    'fk_round_question_assessment_overrides_round_snapshot',
  ],
  ['round_question_snapshots', 'fk_round_question_snapshots_round'],
] as const;

export class ProjectDraftDeletion0034ProjectDraftDeletion1788768000000
  implements MigrationInterface
{
  name = 'ProjectDraftDeletion0034ProjectDraftDeletion1788768000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const [tableName, constraintName] of internalProjectDataForeignKeys) {
      await useCascadeDelete(queryRunner, tableName, constraintName);
    }

    await queryRunner.query(`
      DROP TRIGGER "trg_project_question_schemas_immutable" ON "project_question_schemas";
      CREATE TRIGGER "trg_project_question_schemas_immutable"
        BEFORE UPDATE ON "project_question_schemas"
        FOR EACH ROW EXECUTE FUNCTION "reject_immutable_question_record_change"();
      CREATE TRIGGER "trg_project_question_schemas_delete_guard"
        BEFORE DELETE ON "project_question_schemas"
        FOR EACH ROW WHEN (pg_trigger_depth() = 0)
        EXECUTE FUNCTION "reject_immutable_question_record_change"()
    `);
    await queryRunner.query(`
      DROP TRIGGER "trg_project_schema_questions_immutable" ON "project_schema_questions";
      CREATE TRIGGER "trg_project_schema_questions_immutable"
        BEFORE UPDATE ON "project_schema_questions"
        FOR EACH ROW EXECUTE FUNCTION "reject_immutable_question_record_change"();
      CREATE TRIGGER "trg_project_schema_questions_delete_guard"
        BEFORE DELETE ON "project_schema_questions"
        FOR EACH ROW WHEN (pg_trigger_depth() = 0)
        EXECUTE FUNCTION "reject_immutable_question_record_change"()
    `);
    await queryRunner.query(`
      DROP TRIGGER "trg_round_question_snapshots_immutable" ON "round_question_snapshots";
      CREATE TRIGGER "trg_round_question_snapshots_immutable"
        BEFORE UPDATE ON "round_question_snapshots"
        FOR EACH ROW EXECUTE FUNCTION "reject_immutable_question_record_change"();
      CREATE TRIGGER "trg_round_question_snapshots_delete_guard"
        BEFORE DELETE ON "round_question_snapshots"
        FOR EACH ROW WHEN (pg_trigger_depth() = 0)
        EXECUTE FUNCTION "reject_immutable_question_record_change"()
    `);
    await queryRunner.query(`
      DROP TRIGGER "trg_interview_rounds_protect_change" ON "interview_rounds";
      CREATE TRIGGER "trg_interview_rounds_protect_change"
        BEFORE INSERT OR UPDATE ON "interview_rounds"
        FOR EACH ROW EXECUTE FUNCTION "protect_interview_round_change"();
      CREATE TRIGGER "trg_interview_rounds_protect_delete"
        BEFORE DELETE ON "interview_rounds"
        FOR EACH ROW WHEN (pg_trigger_depth() = 0)
        EXECUTE FUNCTION "protect_interview_round_change"()
    `);
    await queryRunner.query(`
      DROP TRIGGER "trg_round_answers_protect_change" ON "round_answers";
      CREATE TRIGGER "trg_round_answers_protect_change"
        BEFORE INSERT OR UPDATE ON "round_answers"
        FOR EACH ROW EXECUTE FUNCTION "protect_round_answer_change"();
      CREATE TRIGGER "trg_round_answers_protect_delete"
        BEFORE DELETE ON "round_answers"
        FOR EACH ROW WHEN (pg_trigger_depth() = 0)
        EXECUTE FUNCTION "protect_round_answer_change"()
    `);
    await queryRunner.query(`
      DROP TRIGGER "trg_round_question_assessment_overrides_protect_change"
        ON "round_question_assessment_overrides";
      CREATE TRIGGER "trg_round_question_assessment_overrides_protect_change"
        BEFORE INSERT OR UPDATE ON "round_question_assessment_overrides"
        FOR EACH ROW EXECUTE FUNCTION "protect_round_question_assessment_override_change"();
      CREATE TRIGGER "trg_round_question_assessment_overrides_protect_delete"
        BEFORE DELETE ON "round_question_assessment_overrides"
        FOR EACH ROW WHEN (pg_trigger_depth() = 0)
        EXECUTE FUNCTION "protect_round_question_assessment_override_change"()
    `);
    await queryRunner.query(`
      DROP TRIGGER "trg_markdown_revisions_immutable" ON "markdown_revisions";
      CREATE TRIGGER "trg_markdown_revisions_immutable"
        BEFORE UPDATE ON "markdown_revisions"
        FOR EACH ROW EXECUTE FUNCTION "reject_immutable_markdown_revision_change"();
      CREATE TRIGGER "trg_markdown_revisions_delete_guard"
        BEFORE DELETE ON "markdown_revisions"
        FOR EACH ROW WHEN (pg_trigger_depth() = 0)
        EXECUTE FUNCTION "reject_immutable_markdown_revision_change"()
    `);
    await queryRunner.query(`
      DROP TRIGGER "trg_interview_customer_handoffs_protect_change"
        ON "interview_customer_handoffs";
      CREATE TRIGGER "trg_interview_customer_handoffs_protect_change"
        BEFORE UPDATE ON "interview_customer_handoffs"
        FOR EACH ROW EXECUTE FUNCTION "protect_interview_customer_handoff_change"();
      CREATE TRIGGER "trg_interview_customer_handoffs_protect_delete"
        BEFORE DELETE ON "interview_customer_handoffs"
        FOR EACH ROW
        WHEN (OLD."state" <> 'DRAFT' OR pg_trigger_depth() = 0)
        EXECUTE FUNCTION "protect_interview_customer_handoff_change"()
    `);
    await queryRunner.query(`
      DROP TRIGGER "trg_formal_decisions_immutable" ON "formal_decisions";
      CREATE TRIGGER "trg_formal_decisions_immutable"
        BEFORE UPDATE ON "formal_decisions"
        FOR EACH ROW EXECUTE FUNCTION "protect_formal_decision"();
      CREATE TRIGGER "trg_formal_decisions_delete_guard"
        BEFORE DELETE ON "formal_decisions"
        FOR EACH ROW WHEN (pg_trigger_depth() = 0)
        EXECUTE FUNCTION "protect_formal_decision"()
    `);
    await queryRunner.query(`
      DROP TRIGGER "trg_project_status_updates_protect" ON "project_status_updates";
      CREATE TRIGGER "trg_project_status_updates_protect"
        BEFORE UPDATE ON "project_status_updates"
        FOR EACH ROW EXECUTE FUNCTION "protect_project_status_update"();
      CREATE TRIGGER "trg_project_status_updates_delete_guard"
        BEFORE DELETE ON "project_status_updates"
        FOR EACH ROW WHEN (pg_trigger_depth() = 0)
        EXECUTE FUNCTION "protect_project_status_update"()
    `);
  }

  async down(): Promise<void> {
    throw new Error(
      'Project draft deletion is forward-only because a completed cascade cannot restore deleted internal draft data.',
    );
  }
}

async function useCascadeDelete(
  queryRunner: QueryRunner,
  tableName: string,
  constraintName: string,
): Promise<void> {
  const table = await queryRunner.getTable(tableName);
  if (!table) {
    throw new Error(`Migration 0034 requires table ${tableName}.`);
  }
  const foreignKey = table.foreignKeys.find(({ name }) => name === constraintName);
  if (!foreignKey) {
    throw new Error(`Migration 0034 requires foreign key ${tableName}.${constraintName}.`);
  }

  await queryRunner.dropForeignKey(table, foreignKey);
  await queryRunner.createForeignKey(table, new TableForeignKey({
    name: foreignKey.name,
    columnNames: foreignKey.columnNames,
    referencedDatabase: foreignKey.referencedDatabase,
    referencedSchema: foreignKey.referencedSchema,
    referencedTableName: foreignKey.referencedTableName,
    referencedColumnNames: foreignKey.referencedColumnNames,
    onDelete: 'CASCADE',
    onUpdate: foreignKey.onUpdate,
    deferrable: foreignKey.deferrable,
  }));
}
