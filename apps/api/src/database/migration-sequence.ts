import type { MigrationInterface } from 'typeorm';

import { Core0001Core1785916800000 } from '../migrations/0001-core';
import { QuestionsRounds0002QuestionsRounds1786003200000 } from '../migrations/0002-questions-rounds';
import { MarkdownRevisions0003MarkdownRevisions1786089600000 } from '../migrations/0003-markdown-revisions';
import { CustomerFollowUps0004CustomerFollowUps1786176000000 } from '../migrations/0004-customer-follow-ups';
import { InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000 } from '../migrations/0005-initial-intake-open-round';
import { DiscoveryFollowUps0006DiscoveryFollowUps1786348800000 } from '../migrations/0006-discovery-follow-ups';
import { DiscoveryFollowUpResolution0007DiscoveryFollowUpResolution1786435200000 } from '../migrations/0007-discovery-follow-up-resolution';
import { DiscoveryFollowUpEditVersion0008DiscoveryFollowUpEditVersion1786521600000 } from '../migrations/0008-discovery-follow-up-edit-version';
import { RoundQuestionAssessmentOverrides0009RoundQuestionAssessmentOverrides1786608000000 } from '../migrations/0009-round-question-assessment-overrides';
import { RoundAnswerValidationParity0010RoundAnswerValidationParity1786694400000 } from '../migrations/0010-round-answer-validation-parity';
import { DiscoveryFollowUpSourceLinkage0011DiscoveryFollowUpSourceLinkage1786780800000 } from '../migrations/0011-discovery-follow-up-source-linkage';
import { DecisionReviewInputs0012DecisionReviewInputs1786867200000 } from '../migrations/0012-decision-review-inputs';
import { MarkdownTemplateLibrary0013MarkdownTemplateLibrary1786953600000 } from '../migrations/0013-markdown-template-library';

export type ApiMigration = new () => MigrationInterface;

export const migrationSequence: readonly ApiMigration[] = [
  Core0001Core1785916800000,
  QuestionsRounds0002QuestionsRounds1786003200000,
  MarkdownRevisions0003MarkdownRevisions1786089600000,
  CustomerFollowUps0004CustomerFollowUps1786176000000,
  InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000,
  DiscoveryFollowUps0006DiscoveryFollowUps1786348800000,
  DiscoveryFollowUpResolution0007DiscoveryFollowUpResolution1786435200000,
  DiscoveryFollowUpEditVersion0008DiscoveryFollowUpEditVersion1786521600000,
  RoundQuestionAssessmentOverrides0009RoundQuestionAssessmentOverrides1786608000000,
  RoundAnswerValidationParity0010RoundAnswerValidationParity1786694400000,
  DiscoveryFollowUpSourceLinkage0011DiscoveryFollowUpSourceLinkage1786780800000,
  DecisionReviewInputs0012DecisionReviewInputs1786867200000,
  MarkdownTemplateLibrary0013MarkdownTemplateLibrary1786953600000,
];

export function migrationsThrough(migrationName: string): readonly ApiMigration[] {
  const lastMigrationIndex = migrationSequence.findIndex(
    (Migration) => new Migration().name === migrationName,
  );
  if (lastMigrationIndex === -1) {
    throw new Error(`Unknown API migration: ${migrationName}.`);
  }
  return migrationSequence.slice(0, lastMigrationIndex + 1);
}
