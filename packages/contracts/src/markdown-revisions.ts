import type { InterviewRound } from './interviews.js';
import type { ProjectQuestionSchema } from './question-bank.js';
import type { ProjectWorkspace } from './projects.js';

export const markdownRevisionReasons = ['MANUAL', 'MILESTONE'] as const;

export type MarkdownRevisionReason = (typeof markdownRevisionReasons)[number];

export const markdownSourceSnapshotVersion = 1 as const;

export interface MarkdownRevisionSourceSnapshot {
  readonly version: typeof markdownSourceSnapshotVersion;
  readonly project: ProjectWorkspace;
  readonly projectSchema: ProjectQuestionSchema | null;
  readonly interviewRounds: readonly InterviewRound[];
}

export interface CreateMarkdownRevisionInput {
  readonly reason: MarkdownRevisionReason;
  readonly milestone?: string | null;
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
}
