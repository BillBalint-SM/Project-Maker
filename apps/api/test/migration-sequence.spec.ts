import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { migrationSequence, migrationsThrough } from '../src/database/migration-sequence';
import {
  migrationsForFreshDatabase,
  migrationsForHistoricalDatabase,
} from './migration-harness';

const expectedMigrationNames = [
  'Core0001Core1785916800000',
  'QuestionsRounds0002QuestionsRounds1786003200000',
  'MarkdownRevisions0003MarkdownRevisions1786089600000',
  'CustomerFollowUps0004CustomerFollowUps1786176000000',
  'InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000',
  'DiscoveryFollowUps0006DiscoveryFollowUps1786348800000',
  'DiscoveryFollowUpResolution0007DiscoveryFollowUpResolution1786435200000',
  'DiscoveryFollowUpEditVersion0008DiscoveryFollowUpEditVersion1786521600000',
  'RoundQuestionAssessmentOverrides0009RoundQuestionAssessmentOverrides1786608000000',
  'RoundAnswerValidationParity0010RoundAnswerValidationParity1786694400000',
  'DiscoveryFollowUpSourceLinkage0011DiscoveryFollowUpSourceLinkage1786780800000',
  'DecisionReviewInputs0012DecisionReviewInputs1786867200000',
  'MarkdownTemplateLibrary0013MarkdownTemplateLibrary1786953600000',
  'InterviewCustomerHandoff0014InterviewCustomerHandoff1787039999000',
  'CustomerFollowUpPingDraft0015CustomerFollowUpPingDraft1787126400000',
  'ProjectStartCreationRequest0016ProjectStartCreationRequest1787212800000',
  'M365InterviewHandoff0017M365InterviewHandoff1787299200000',
  'M365CustomerFollowUpPing0018M365CustomerFollowUpPing1787385600000',
  'CustomerMailboxSync0019CustomerMailboxSync1787472000000',
  'CorrelatedCustomerReplies0020CorrelatedCustomerReplies1787558400000',
  'CustomerCorrespondenceProcessing0021CustomerCorrespondenceProcessing1787644800000',
  'ReceiptProvenHandoffRevision0022ReceiptProvenHandoffRevision1787731200000',
  'CustomerMailTriage0023CustomerMailTriage1787817600000',
  'OperatorMailGatewaySender0024OperatorMailGatewaySender1787904000000',
  'LocalIdentityAndAuditActor0025LocalIdentityAndAuditActor1787990400000',
  'EvidenceBasedDiscovery0026EvidenceBasedDiscovery1788076800000',
  'DecisionAndPortfolio0027DecisionAndPortfolio1788163200000',
  'CustomerResponseAndNotifications0028CustomerResponseAndNotifications1788249600000',
  'CustomerResponseEvidence0029CustomerResponseEvidence1788336000000',
  'DeliveryAndGit0030DeliveryAndGit1788422400000',
  'ClaudeCodeMcpConnection0031ClaudeCodeMcpConnection1788508800000',
] as const;

type MigrationConstructor = new () => { readonly name?: string };

function namesOf(migrations: readonly MigrationConstructor[]): readonly string[] {
  return migrations.map((Migration) => {
    const name = new Migration().name;
    if (typeof name !== 'string') {
      throw new Error('A registered migration must expose its TypeORM name.');
    }
    return name;
  });
}

function isMigrationConstructor(candidate: string | Function): candidate is MigrationConstructor {
  return typeof candidate === 'function';
}

describe('Canonical API migration sequence', () => {
  it('publishes every migration in canonical order', () => {
    assert.deepEqual(namesOf(migrationSequence), expectedMigrationNames);
  });

  it('derives an inclusive historical prefix without a second migration list', () => {
    assert.deepEqual(
      namesOf(migrationsThrough('CustomerFollowUps0004CustomerFollowUps1786176000000')),
      expectedMigrationNames.slice(0, 4),
    );
  });

  it('gives fresh PostgreSQL harnesses the complete current migration sequence', () => {
    assert.deepEqual(namesOf(migrationsForFreshDatabase()), expectedMigrationNames);
  });

  it('gives every historical PostgreSQL harness an exact canonical inclusive prefix', () => {
    const historicalHarnesses = [
      ['QuestionsRounds0002QuestionsRounds1786003200000', 2],
      ['InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000', 5],
      ['RoundQuestionAssessmentOverrides0009RoundQuestionAssessmentOverrides1786608000000', 9],
      ['RoundAnswerValidationParity0010RoundAnswerValidationParity1786694400000', 10],
    ] as const;

    for (const [lastMigrationName, expectedLength] of historicalHarnesses) {
      assert.deepEqual(
        namesOf(migrationsForHistoricalDatabase(lastMigrationName)),
        expectedMigrationNames.slice(0, expectedLength),
      );
    }
  });

  it('configures the runtime DataSource from the complete canonical sequence without connecting', async () => {
    const previousDatabaseUrl = process.env['DATABASE_URL'];
    process.env['DATABASE_URL'] = 'postgresql://127.0.0.1/project_maker_test';

    try {
      const { default: dataSource } = await import('../src/database/migration-data-source');
      assert.ok(Array.isArray(dataSource.options.migrations));
      const runtimeMigrations = dataSource.options.migrations.filter(isMigrationConstructor);
      assert.equal(runtimeMigrations.length, dataSource.options.migrations.length);
      assert.deepEqual(namesOf(runtimeMigrations), expectedMigrationNames);
    } finally {
      if (previousDatabaseUrl === undefined) {
        delete process.env['DATABASE_URL'];
      } else {
        process.env['DATABASE_URL'] = previousDatabaseUrl;
      }
    }
  });
});
