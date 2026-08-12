import { DataSource } from 'typeorm';

import {
  createDatabaseConfiguration,
  createDatabaseDataSourceOptions,
} from '../config/database.config';
import { migrationSequence } from './migration-sequence';

const runtime = globalThis as typeof globalThis & {
  readonly process: { readonly env: Readonly<Record<string, string | undefined>> };
};

const dataSource = new DataSource({
  ...createDatabaseDataSourceOptions(
    createDatabaseConfiguration(runtime.process.env['DATABASE_URL'])
  ),
  migrations: [...migrationSequence],
});

export default dataSource;
