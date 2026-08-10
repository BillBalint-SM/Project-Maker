import { DataSource } from 'typeorm';

import {
  createDatabaseConfiguration,
  createDatabaseDataSourceOptions,
} from '../config/database.config';
import { Core0001Core1785916800000 } from '../migrations/0001-core';
import { QuestionsRounds0002QuestionsRounds1786003200000 } from '../migrations/0002-questions-rounds';
import { MarkdownRevisions0003MarkdownRevisions1786089600000 } from '../migrations/0003-markdown-revisions';
import { CustomerFollowUps0004CustomerFollowUps1786176000000 } from '../migrations/0004-customer-follow-ups';
import { InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000 } from '../migrations/0005-initial-intake-open-round';
import { DiscoveryFollowUps0006DiscoveryFollowUps1786348800000 } from '../migrations/0006-discovery-follow-ups';
import { DiscoveryFollowUpResolution0007DiscoveryFollowUpResolution1786435200000 } from '../migrations/0007-discovery-follow-up-resolution';
import { DiscoveryFollowUpEditVersion0008DiscoveryFollowUpEditVersion1786521600000 } from '../migrations/0008-discovery-follow-up-edit-version';
import { RoundQuestionAssessmentOverrides0009RoundQuestionAssessmentOverrides1786608000000 } from '../migrations/0009-round-question-assessment-overrides';

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
    InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000,
    DiscoveryFollowUps0006DiscoveryFollowUps1786348800000,
    DiscoveryFollowUpResolution0007DiscoveryFollowUpResolution1786435200000,
    DiscoveryFollowUpEditVersion0008DiscoveryFollowUpEditVersion1786521600000,
    RoundQuestionAssessmentOverrides0009RoundQuestionAssessmentOverrides1786608000000,
  ],
});

export default dataSource;
