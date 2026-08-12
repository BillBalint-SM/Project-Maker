import {
  migrationSequence,
  migrationsThrough,
  type ApiMigration,
} from '../src/database/migration-sequence';

export function migrationsForFreshDatabase(): readonly ApiMigration[] {
  return migrationSequence;
}

export function migrationsForHistoricalDatabase(
  lastMigrationName: string,
): readonly ApiMigration[] {
  return migrationsThrough(lastMigrationName);
}
