import type { DataSourceOptions } from 'typeorm';

const invalidDatabaseUrlMessage =
  'DATABASE_URL must be one valid postgres:// or postgresql:// connection URL.';

export interface DatabaseConfiguration {
  readonly url: string;
}

export function createDatabaseConfiguration(databaseUrl: string | undefined): DatabaseConfiguration {
  if (!databaseUrl || databaseUrl.trim() !== databaseUrl || !URL.canParse(databaseUrl)) {
    throw new Error(invalidDatabaseUrlMessage);
  }

  const parsedUrl = new URL(databaseUrl);
  if (parsedUrl.protocol !== 'postgres:' && parsedUrl.protocol !== 'postgresql:') {
    throw new Error(invalidDatabaseUrlMessage);
  }

  return { url: databaseUrl };
}

export function createDatabaseDataSourceOptions(
  configuration: DatabaseConfiguration
): DataSourceOptions {
  return {
    type: 'postgres',
    url: configuration.url,
    synchronize: false,
    migrationsRun: false,
  };
}
