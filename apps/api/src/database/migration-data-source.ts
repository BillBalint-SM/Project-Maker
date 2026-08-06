import { DataSource } from 'typeorm';

import {
  createDatabaseConfiguration,
  createDatabaseDataSourceOptions,
} from '../config/database.config';
import { Core0001Core1785916800000 } from '../migrations/0001-core';
import { QuestionsRounds0002QuestionsRounds1786003200000 } from '../migrations/0002-questions-rounds';
import { MarkdownRevisions0003MarkdownRevisions1786089600000 } from '../migrations/0003-markdown-revisions';
import { CustomerFollowUps0004CustomerFollowUps1786176000000 } from '../migrations/0004-customer-follow-ups';

const runtime = globalThis as typeof globalThis & {
  readonly process: { readonly env: Readonly<Record<string, string | undefined>> };
};

const dataSource = new DataSource({
  ...createDatabaseDataSourceOptions(
    createDatabaseConfiguration(runtime.process.env['DATABASE_URL'])
  ),
  migrations: [
    Core0001Core1785916800000,
    QuestionsRounds0002QuestionsRounds1786003200000,
    MarkdownRevisions0003MarkdownRevisions1786089600000,
    CustomerFollowUps0004CustomerFollowUps1786176000000,
  ],
});

export default dataSource;
