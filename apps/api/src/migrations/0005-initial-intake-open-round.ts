import type { MigrationInterface, QueryRunner } from 'typeorm';

interface DuplicateOpenInitialIntakeRow {
  readonly projectId: string;
  readonly openRoundIds: readonly string[];
  readonly openRoundCount: string;
}

export class InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000
  implements MigrationInterface
{
  name = 'InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const duplicateRows = (await queryRunner.query(`
        SELECT
          "project_id" AS "projectId",
          array_agg("id" ORDER BY "created_at" ASC) AS "openRoundIds",
          COUNT(*)::text AS "openRoundCount"
        FROM "interview_rounds"
        WHERE "status" = 'OPEN'
          AND "type" = 'INITIAL_INTAKE'
        GROUP BY "project_id"
        HAVING COUNT(*) > 1
        ORDER BY "project_id" ASC
      `)) as DuplicateOpenInitialIntakeRow[];

    if (duplicateRows.length > 0) {
      const duplicateSummary = duplicateRows
        .map(
          (row: DuplicateOpenInitialIntakeRow) =>
            `project ${row.projectId} has ${row.openRoundCount} open INITIAL_INTAKE rounds (${row.openRoundIds.join(', ')})`,
        )
        .join('; ');

      throw new Error(
        `Migration 0005 cannot create uq_interview_rounds_open_initial_intake because duplicate open INITIAL_INTAKE rounds already exist. Repair the conflicting project data explicitly before rerunning the migration. ${duplicateSummary}`,
      );
    }

    await queryRunner.query(`
      CREATE UNIQUE INDEX "uq_interview_rounds_open_initial_intake"
      ON "interview_rounds" ("project_id")
      WHERE "status" = 'OPEN' AND "type" = 'INITIAL_INTAKE'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX "uq_interview_rounds_open_initial_intake"');
  }
}
