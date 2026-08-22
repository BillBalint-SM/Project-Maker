import type {
  AnswerValue,
  BaseQuestionType,
  GeneralPlaybook,
  QuestionReferenceFile,
  RoundQuestionSnapshot,
} from '@project-maker/contracts';
import { loadGeneralPlaybookV1 } from '@project-maker/contracts/general-playbook-runtime';

import type { RoundAnswerEntity } from './round-answer.entity';
import type { RoundQuestionAssessmentOverrideEntity } from './round-question-assessment-override.entity';
import type { RoundQuestionSnapshotEntity } from './round-question-snapshot.entity';

export const assessmentRationaleMaxLength = 10_000;

const explicitRoundAnswerWhitespace = new Set([' ', '\t', '\n', '\r', '\f', '\v']);

export interface RoundQuestionAssessmentPolicy {
  readonly missingStatus: string;
  readonly partialStatus: string;
  readonly completeStatus: string;
  readonly notRelevantStatus: string;
}

export async function loadRoundQuestionAssessmentPolicy(): Promise<RoundQuestionAssessmentPolicy> {
  return toRoundQuestionAssessmentPolicy(await loadGeneralPlaybookV1());
}

export function roundAnswerValidationError(
  type: BaseQuestionType,
  options: readonly string[] | null,
  value: AnswerValue,
): string | null {
  if (type === 'TEXT' || type === 'LONG_TEXT') {
    return typeof value === 'string' && hasRoundAnswerTextContent(value)
      ? null
      : 'Text answers must not be blank.';
  }
  if (type === 'BOOLEAN') {
    return typeof value === 'boolean'
      ? null
      : 'Boolean questions require a boolean answer.';
  }
  if (type === 'NUMBER') {
    return typeof value === 'number' && Number.isFinite(value)
      ? null
      : 'Number questions require a finite numeric answer.';
  }
  if (type === 'DATE') {
    return typeof value === 'string' && isIsoCalendarDate(value)
      ? null
      : 'Date questions require a YYYY-MM-DD answer.';
  }
  if (type === 'SINGLE_SELECT') {
    return typeof value === 'string' && options?.includes(value)
      ? null
      : 'Single-select answers must match one configured option.';
  }
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((selection) => options?.includes(selection)) &&
    new Set(value).size === value.length
    ? null
    : 'Multi-select answers must contain unique configured options.';
}

export function toEffectiveRoundQuestionSnapshot(
  snapshot: RoundQuestionSnapshotEntity,
  answer: RoundAnswerEntity | null,
  override: RoundQuestionAssessmentOverrideEntity | null,
  policy: RoundQuestionAssessmentPolicy,
  referenceFiles: readonly QuestionReferenceFile[] = [],
): RoundQuestionSnapshot {
  const answerIsValid =
    answer !== null &&
    roundAnswerValidationError(snapshot.type, snapshot.options, answer.value) === null;
  const assessment = effectiveAssessment(override, answerIsValid, policy);
  return {
    id: snapshot.id,
    baseQuestionId: snapshot.baseQuestionId,
    stableKey: snapshot.stableKey,
    topic: snapshot.topic,
    controlPoint: snapshot.controlPoint,
    text: snapshot.text,
    type: snapshot.type,
    required: snapshot.required,
    blocking: snapshot.blocking,
    order: snapshot.order,
    hint: snapshot.hint,
    options: snapshot.options,
    answer: answer?.value ?? null,
    answeredAt: answer ? toIso(answer.answeredAt, 'answer answeredAt') : null,
    checklistStatus: assessment.status,
    assessmentRationale: assessment.rationale,
    referenceFiles,
  };
}

export function unicodeCodePointLength(value: string): number {
  return Array.from(value).length;
}

function toRoundQuestionAssessmentPolicy(
  playbook: GeneralPlaybook,
): RoundQuestionAssessmentPolicy {
  const scoreEntries = Object.entries(playbook.scoring.readiness.checklistStatusValue);
  const missingStatus = requireSingleStatus(scoreEntries, (score) => score === 0, 'missing');
  const partialStatus = requireSingleStatus(
    scoreEntries,
    (score) => score > 0 && score < 1,
    'partial',
  );
  const completeStatus = requireSingleStatus(scoreEntries, (score) => score === 1, 'complete');
  const notRelevantStatus = playbook.scoring.readiness.excludedChecklistStatus;
  const statuses = [missingStatus, partialStatus, completeStatus, notRelevantStatus];
  if (
    new Set(statuses).size !== statuses.length ||
    statuses.some((status) => !playbook.statuses.checklist.includes(status))
  ) {
    throw new TypeError('General playbook checklist assessment semantics are inconsistent.');
  }
  return { missingStatus, partialStatus, completeStatus, notRelevantStatus };
}

function requireSingleStatus(
  entries: readonly (readonly [string, number])[],
  matches: (score: number) => boolean,
  semantic: string,
): string {
  const statuses = entries.filter(([, score]) => matches(score)).map(([status]) => status);
  if (statuses.length !== 1) {
    throw new TypeError(
      `General playbook must define exactly one ${semantic} checklist assessment status.`,
    );
  }
  return statuses[0];
}

function effectiveAssessment(
  override: RoundQuestionAssessmentOverrideEntity | null,
  answerIsValid: boolean,
  policy: RoundQuestionAssessmentPolicy,
): { readonly status: string; readonly rationale: string | null } {
  if (override) {
    if (override.status === policy.partialStatus) {
      return { status: override.status, rationale: null };
    }
    if (override.status === policy.notRelevantStatus && override.rationale !== null) {
      return { status: override.status, rationale: override.rationale };
    }
    throw new TypeError('Stored round question assessment override is inconsistent with policy.');
  }
  return {
    status: answerIsValid ? policy.completeStatus : policy.missingStatus,
    rationale: null,
  };
}

function isIsoCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return year >= 1 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month);
}

function hasRoundAnswerTextContent(value: string): boolean {
  for (const character of value) {
    if (!explicitRoundAnswerWhitespace.has(character)) {
      return true;
    }
  }
  return false;
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    return isLeapYear(year) ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

function isLeapYear(year: number): boolean {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function toIso(value: Date, field: string): string {
  const timestamp = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(timestamp.getTime())) {
    throw new TypeError(`Stored interview round ${field} is invalid.`);
  }
  return timestamp.toISOString();
}
