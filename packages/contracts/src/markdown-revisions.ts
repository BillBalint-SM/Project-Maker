import type { ProjectDecisionReview } from './decision-review.js';
import type { DiscoveryFollowUp } from './discovery-follow-ups.js';
import type { Evidence, Insight } from './discovery.js';
import type { FormalDecision } from './decision-portfolio.js';
import type { InterviewRound } from './interviews.js';
import type { ProjectQuestionSchema } from './question-bank.js';
import type { ProjectReadiness } from './readiness.js';
import type { ProjectWorkspace } from './projects.js';

export const markdownRevisionReasons = ['MANUAL', 'MILESTONE'] as const;

export type MarkdownRevisionReason = (typeof markdownRevisionReasons)[number];

export const markdownSourceSnapshotVersion = 2 as const;

interface MarkdownRevisionSourceSnapshotBase {
  readonly project: ProjectWorkspace;
  readonly projectSchema: ProjectQuestionSchema | null;
  readonly interviewRounds: readonly InterviewRound[];
}

export interface MarkdownRevisionSourceSnapshotV1 extends MarkdownRevisionSourceSnapshotBase {
  readonly version: 1;
}

export interface MarkdownRevisionSourceInsight extends Omit<Insight, 'projectId' | 'evidence'> {
  readonly evidenceIds: readonly string[];
}

export interface MarkdownRevisionSourceSnapshotV2 extends MarkdownRevisionSourceSnapshotBase {
  readonly version: typeof markdownSourceSnapshotVersion;
  readonly discovery: {
    readonly insights: readonly MarkdownRevisionSourceInsight[];
    readonly evidence: readonly Evidence[];
    readonly followUps: readonly DiscoveryFollowUp[];
  };
  readonly decision: {
    readonly readiness: ProjectReadiness;
    readonly review: ProjectDecisionReview;
    readonly formalDecision: FormalDecision | null;
    readonly referencedSpecification: MarkdownRevisionSummary | null;
  };
}

export type MarkdownRevisionSourceSnapshot =
  | MarkdownRevisionSourceSnapshotV1
  | MarkdownRevisionSourceSnapshotV2;

export interface CreateMarkdownRevisionInput {
  readonly reason: MarkdownRevisionReason;
  readonly milestone?: string | null;
  readonly templateId?: string | null;
}

export interface MarkdownRevisionTemplateProvenance {
  readonly id: string;
  readonly name: string;
  readonly version: number;
}

export interface MarkdownGenerationConfiguration {
  readonly selectedTemplateId: string;
  readonly templates: readonly import('./markdown-templates.js').MarkdownTemplateSummary[];
}

export interface MarkdownRevision {
  readonly id: string;
  readonly projectId: string;
  readonly version: number;
  readonly reason: MarkdownRevisionReason;
  readonly milestone: string | null;
  readonly createdAt: string;
  readonly sourceSnapshot: MarkdownRevisionSourceSnapshot;
  readonly changeSummary: string;
  readonly content: string;
  readonly previousRevisionId: string | null;
  readonly template: MarkdownRevisionTemplateProvenance | null;
}

export type MarkdownRevisionSummary = Pick<
  MarkdownRevision,
  'id' | 'version' | 'reason' | 'milestone' | 'createdAt'
>;
