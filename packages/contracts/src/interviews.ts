import type { BaseQuestionType } from './question-bank.js';

export const interviewRoundTypes = [
  'INITIAL_INTAKE',
  'STAKEHOLDER',
  'CLARIFICATION',
] as const;

export type InterviewRoundType = (typeof interviewRoundTypes)[number];

export const interviewRoundStatuses = ['OPEN', 'ENDED'] as const;

export type InterviewRoundStatus = (typeof interviewRoundStatuses)[number];

export type AnswerValue = string | number | boolean | readonly string[];

export interface CreateInterviewRoundInput {
  readonly type: InterviewRoundType;
  readonly selectedStableKeys?: readonly string[];
  readonly adHocQuestions?: readonly AdHocRoundQuestionInput[];
}

export interface AdHocRoundQuestionInput {
  readonly text: string;
  readonly topic: string;
}

export interface RoundQuestionSnapshot {
  readonly id: string;
  readonly baseQuestionId: string | null;
  readonly stableKey: string;
  readonly topic: string;
  readonly controlPoint: string;
  readonly text: string;
  readonly type: BaseQuestionType;
  readonly required: boolean;
  readonly blocking: boolean;
  readonly order: number;
  readonly hint: string | null;
  readonly options: readonly string[] | null;
  readonly answer: AnswerValue | null;
  readonly answeredAt: string | null;
  readonly checklistStatus: string;
  readonly assessmentRationale: string | null;
}

export interface InterviewRound {
  readonly id: string;
  readonly projectId: string;
  readonly projectSchemaId: string;
  readonly schemaVersion: number;
  readonly type: InterviewRoundType;
  readonly status: InterviewRoundStatus;
  readonly contentVersion: number;
  readonly createdAt: string;
  readonly endedAt: string | null;
  readonly questions: readonly RoundQuestionSnapshot[];
}

export interface UpdateRoundAnswerInput {
  readonly value: AnswerValue | null;
}

export interface SetRoundQuestionAssessmentInput {
  readonly status: string;
  readonly rationale: string | null;
}
