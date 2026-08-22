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
import { InterviewCustomerHandoff0014InterviewCustomerHandoff1787039999000 } from '../migrations/0014-interview-customer-handoff';
import { CustomerFollowUpPingDraft0015CustomerFollowUpPingDraft1787126400000 } from '../migrations/0015-customer-follow-up-ping-draft';
import { ProjectStartCreationRequest0016ProjectStartCreationRequest1787212800000 } from '../migrations/0016-project-start-creation-request';
import { M365InterviewHandoff0017M365InterviewHandoff1787299200000 } from '../migrations/0017-m365-interview-handoff';
import { M365CustomerFollowUpPing0018M365CustomerFollowUpPing1787385600000 } from '../migrations/0018-m365-customer-follow-up-ping';
import { CustomerMailboxSync0019CustomerMailboxSync1787472000000 } from '../migrations/0019-customer-mailbox-sync';
import { CorrelatedCustomerReplies0020CorrelatedCustomerReplies1787558400000 } from '../migrations/0020-correlated-customer-replies';
import { CustomerCorrespondenceProcessing0021CustomerCorrespondenceProcessing1787644800000 } from '../migrations/0021-customer-correspondence-processing';
import { ReceiptProvenHandoffRevision0022ReceiptProvenHandoffRevision1787731200000 } from '../migrations/0022-receipt-proven-handoff-revision';
import { CustomerMailTriage0023CustomerMailTriage1787817600000 } from '../migrations/0023-customer-mail-triage';
import { OperatorMailGatewaySender0024OperatorMailGatewaySender1787904000000 } from '../migrations/0024-operator-mail-gateway-sender';
import { LocalIdentityAndAuditActor0025LocalIdentityAndAuditActor1787990400000 } from '../migrations/0025-local-identity-and-audit-actor';
import { EvidenceBasedDiscovery0026EvidenceBasedDiscovery1788076800000 } from '../migrations/0026-evidence-based-discovery';
import { DecisionAndPortfolio0027DecisionAndPortfolio1788163200000 } from '../migrations/0027-decision-and-portfolio';
import { CustomerResponseAndNotifications0028CustomerResponseAndNotifications1788249600000 } from '../migrations/0028-customer-response-and-notifications';
import { CustomerResponseEvidence0029CustomerResponseEvidence1788336000000 } from '../migrations/0029-customer-response-evidence';
import { DeliveryAndGit0030DeliveryAndGit1788422400000 } from '../migrations/0030-delivery-and-git';
import { ClaudeCodeMcpConnection0031ClaudeCodeMcpConnection1788508800000 } from '../migrations/0031-claude-code-mcp-connection';
import { CanonicalCustomerMailPersistence0032CanonicalCustomerMailPersistence1788595200000 } from '../migrations/0032-canonical-customer-mail-persistence';
import { ProjectArchiveResume0033ProjectArchiveResume1788681600000 } from '../migrations/0033-project-archive-resume';
import { ProjectDraftDeletion0034ProjectDraftDeletion1788768000000 } from '../migrations/0034-project-draft-deletion';
import { QuestionBankReferenceFiles0035QuestionBankReferenceFiles1788854400000 } from '../migrations/0035-question-bank-reference-files';
import { ProfessionalEnglishProductLanguage0036ProfessionalEnglishProductLanguage1788940800000 } from '../migrations/0036-professional-english-product-language';

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
  InterviewCustomerHandoff0014InterviewCustomerHandoff1787039999000,
  CustomerFollowUpPingDraft0015CustomerFollowUpPingDraft1787126400000,
  ProjectStartCreationRequest0016ProjectStartCreationRequest1787212800000,
  M365InterviewHandoff0017M365InterviewHandoff1787299200000,
  M365CustomerFollowUpPing0018M365CustomerFollowUpPing1787385600000,
  CustomerMailboxSync0019CustomerMailboxSync1787472000000,
  CorrelatedCustomerReplies0020CorrelatedCustomerReplies1787558400000,
  CustomerCorrespondenceProcessing0021CustomerCorrespondenceProcessing1787644800000,
  ReceiptProvenHandoffRevision0022ReceiptProvenHandoffRevision1787731200000,
  CustomerMailTriage0023CustomerMailTriage1787817600000,
  OperatorMailGatewaySender0024OperatorMailGatewaySender1787904000000,
  LocalIdentityAndAuditActor0025LocalIdentityAndAuditActor1787990400000,
  EvidenceBasedDiscovery0026EvidenceBasedDiscovery1788076800000,
  DecisionAndPortfolio0027DecisionAndPortfolio1788163200000,
  CustomerResponseAndNotifications0028CustomerResponseAndNotifications1788249600000,
  CustomerResponseEvidence0029CustomerResponseEvidence1788336000000,
  DeliveryAndGit0030DeliveryAndGit1788422400000,
  ClaudeCodeMcpConnection0031ClaudeCodeMcpConnection1788508800000,
  CanonicalCustomerMailPersistence0032CanonicalCustomerMailPersistence1788595200000,
  ProjectArchiveResume0033ProjectArchiveResume1788681600000,
  ProjectDraftDeletion0034ProjectDraftDeletion1788768000000,
  QuestionBankReferenceFiles0035QuestionBankReferenceFiles1788854400000,
  ProfessionalEnglishProductLanguage0036ProfessionalEnglishProductLanguage1788940800000,
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
