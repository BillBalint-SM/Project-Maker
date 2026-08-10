import generalPlaybookData from '../playbooks/general.v1.json' with { type: 'json' };

export * from './projects.js';
export * from './question-bank.js';
export * from './interviews.js';
export * from './markdown-revisions.js';
export * from './follow-ups.js';
export * from './discovery-follow-ups.js';
export * from './audit.js';
export * from './readiness.js';

export const generalPlaybookV1SourcePath = 'playbooks/general.v1.json' as const;

export interface PlaybookItem {
  readonly id: number;
  readonly category: string;
  readonly controlPoint: string;
  readonly exampleQuestion: string;
  readonly hint: string;
  readonly requiredForMvp: boolean;
  readonly requiredForEstimate: boolean;
  readonly blockingIfMissing: boolean;
}

export interface PlaybookStatuses {
  readonly project: readonly string[];
  readonly priority: readonly string[];
  readonly checklist: readonly string[];
  readonly followUp: readonly string[];
  readonly decision: readonly string[];
  readonly completion: readonly string[];
  readonly readinessGapSeverity: readonly string[];
  readonly decisionScoreLabel: readonly string[];
}

export interface GeneralPlaybookScoring {
  readonly readiness: {
    readonly weights: {
      readonly baseInfo: number;
      readonly business: number;
      readonly ownership: number;
      readonly checklist: number;
      readonly followUpResolution: number;
    };
    readonly checklistStatusValue: Readonly<Record<string, number>>;
    readonly excludedChecklistStatus: string;
    readonly resolvedFollowUpStatuses: readonly string[];
    readonly thresholds: {
      readonly clarificationBelow: number;
      readonly estimatePreparationFrom: number;
      readonly estimateReadyFrom: number;
      readonly developmentReadyFrom: number;
    };
    readonly inputBindings: {
      readonly baseInfoProjectFields: readonly string[];
      readonly businessChecklistItemIds: readonly number[];
      readonly ownershipProjectFields: readonly string[];
      readonly ownershipChecklistItemIds: readonly number[];
    };
  };
  readonly decision: {
    readonly weights: {
      readonly businessValue: number;
      readonly strategicAlignment: number;
      readonly urgency: number;
      readonly confidence: number;
      readonly complexity: number;
      readonly risk: number;
      readonly readiness: number;
    };
    readonly scale: {
      readonly minimum: number;
      readonly maximum: number;
      readonly percentageStep: number;
      readonly invertedDimensions: readonly string[];
    };
    readonly thresholds: {
      readonly high: number;
      readonly medium: number;
    };
    readonly clarificationRules: {
      readonly criticalGap: boolean;
      readonly estimateBlockingGapsAbove: number;
      readonly readinessBelow: number;
    };
    readonly estimateReadyRules: {
      readonly decisionScoreAtLeast: number;
      readonly readinessAtLeast: number;
      readonly estimateBlockingGaps: number;
    };
    readonly conditionalEstimateRules: {
      readonly decisionScoreAtLeast: number;
      readonly readinessAtLeast: number;
    };
  };
}

export interface GeneralPlaybook {
  readonly id: string;
  readonly version: number;
  readonly name: string;
  readonly statuses: PlaybookStatuses;
  readonly scoring: GeneralPlaybookScoring;
  readonly items: readonly PlaybookItem[];
}

type UnknownRecord = Record<string, unknown>;

function failValidation(path: string, expected: string): never {
  throw new TypeError(`General playbook validation failed: expected ${expected} at ${path}.`);
}

function assertRecord(value: unknown, path: string): asserts value is UnknownRecord {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    failValidation(path, 'a record');
  }
}

function assertString(value: unknown, path: string): asserts value is string {
  if (typeof value !== 'string') {
    failValidation(path, 'a string');
  }
}

function assertBoolean(value: unknown, path: string): asserts value is boolean {
  if (typeof value !== 'boolean') {
    failValidation(path, 'a boolean');
  }
}

function assertNumber(value: unknown, path: string): asserts value is number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    failValidation(path, 'a finite number');
  }
}

function assertUnitInterval(value: unknown, path: string): asserts value is number {
  assertNumber(value, path);
  if (value < 0 || value > 1) {
    failValidation(path, 'a policy value from 0 to 1');
  }
}

function assertPercentage(value: unknown, path: string): asserts value is number {
  assertNumber(value, path);
  if (value < 0 || value > 100) {
    failValidation(path, 'a percentage from 0 to 100');
  }
}

function assertStringArray(value: unknown, path: string): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0) {
    failValidation(path, 'a non-empty string array');
  }

  for (const [index, item] of value.entries()) {
    assertString(item, `${path}[${index}]`);
  }
}

function assertNumberArray(value: unknown, path: string): asserts value is number[] {
  if (!Array.isArray(value) || value.length === 0) {
    failValidation(path, 'a non-empty number array');
  }

  for (const [index, item] of value.entries()) {
    assertNumber(item, `${path}[${index}]`);
  }
}

function assertNumericRecord(value: unknown, path: string): asserts value is UnknownRecord {
  assertRecord(value, path);

  const entries = Object.entries(value);
  if (entries.length === 0) {
    failValidation(path, 'a non-empty numeric record');
  }

  for (const [key, item] of entries) {
    assertNumber(item, `${path}.${key}`);
  }
}

function assertNumberFields(record: UnknownRecord, path: string, fields: readonly string[]): void {
  for (const field of fields) {
    assertNumber(record[field], `${path}.${field}`);
  }
}

function assertUnitIntervalFields(record: UnknownRecord, path: string, fields: readonly string[]): void {
  for (const field of fields) {
    assertUnitInterval(record[field], `${path}.${field}`);
  }
}

function assertCanonicalStringArray(
  value: unknown,
  canonicalValue: unknown,
  path: string,
  description: string
): void {
  assertStringArray(value, path);
  assertStringArray(canonicalValue, path);

  if (
    value.length !== canonicalValue.length ||
    value.some((item, index) => item !== canonicalValue[index])
  ) {
    failValidation(path, description);
  }
}

function assertCanonicalPolicy(value: unknown, canonicalValue: unknown, path: string): void {
  if (typeof canonicalValue === 'number') {
    assertNumber(value, path);
    if (value !== canonicalValue) {
      failValidation(path, `the canonical policy value ${canonicalValue}`);
    }
    return;
  }

  if (typeof canonicalValue === 'string') {
    assertString(value, path);
    if (value !== canonicalValue) {
      failValidation(path, `the canonical policy value ${canonicalValue}`);
    }
    return;
  }

  if (typeof canonicalValue === 'boolean') {
    assertBoolean(value, path);
    if (value !== canonicalValue) {
      failValidation(path, `the canonical policy value ${canonicalValue}`);
    }
    return;
  }

  if (Array.isArray(canonicalValue)) {
    if (!Array.isArray(value) || value.length !== canonicalValue.length) {
      failValidation(path, 'the canonical policy array');
    }

    for (const [index, expectedItem] of canonicalValue.entries()) {
      assertCanonicalPolicy(value[index], expectedItem, `${path}[${index}]`);
    }
    return;
  }

  assertRecord(canonicalValue, path);
  assertRecord(value, path);
  const canonicalKeys = Object.keys(canonicalValue).sort();
  const valueKeys = Object.keys(value).sort();

  if (
    canonicalKeys.length !== valueKeys.length ||
    canonicalKeys.some((key, index) => key !== valueKeys[index])
  ) {
    failValidation(path, 'the canonical policy fields');
  }

  for (const key of canonicalKeys) {
    assertCanonicalPolicy(value[key], canonicalValue[key], `${path}.${key}`);
  }
}

function assertPlaybookItems(value: unknown): asserts value is PlaybookItem[] {
  if (!Array.isArray(value) || value.length !== 30) {
    failValidation('$.items', 'the 30-item general template');
  }

  for (const [index, item] of value.entries()) {
    const path = `$.items[${index}]`;
    assertRecord(item, path);
    assertNumber(item.id, `${path}.id`);
    if (item.id !== index + 1) {
      failValidation(`${path}.id`, `stable ID ${index + 1}`);
    }
    assertString(item.category, `${path}.category`);
    assertString(item.controlPoint, `${path}.controlPoint`);
    assertString(item.exampleQuestion, `${path}.exampleQuestion`);
    assertString(item.hint, `${path}.hint`);
    assertBoolean(item.requiredForMvp, `${path}.requiredForMvp`);
    assertBoolean(item.requiredForEstimate, `${path}.requiredForEstimate`);
    assertBoolean(item.blockingIfMissing, `${path}.blockingIfMissing`);
  }
}

function assertStatuses(value: unknown, canonicalValue: unknown): asserts value is PlaybookStatuses {
  assertRecord(value, '$.statuses');
  assertRecord(canonicalValue, '$.statuses');
  for (const field of [
    'project',
    'priority',
    'checklist',
    'followUp',
    'decision',
    'completion',
    'readinessGapSeverity',
    'decisionScoreLabel'
  ]) {
    assertCanonicalStringArray(
      value[field],
      canonicalValue[field],
      `$.statuses.${field}`,
      `the canonical ${field} status vocabulary`
    );
  }
}

function assertScoring(value: unknown, canonicalValue: unknown): asserts value is GeneralPlaybookScoring {
  assertRecord(value, '$.scoring');
  assertRecord(canonicalValue, '$.scoring');
  assertRecord(value.readiness, '$.scoring.readiness');
  assertRecord(value.readiness.weights, '$.scoring.readiness.weights');
  assertUnitIntervalFields(value.readiness.weights, '$.scoring.readiness.weights', [
    'baseInfo',
    'business',
    'ownership',
    'checklist',
    'followUpResolution'
  ]);
  assertNumericRecord(value.readiness.checklistStatusValue, '$.scoring.readiness.checklistStatusValue');
  for (const [key, score] of Object.entries(value.readiness.checklistStatusValue)) {
    assertUnitInterval(score, `$.scoring.readiness.checklistStatusValue.${key}`);
  }
  assertString(value.readiness.excludedChecklistStatus, '$.scoring.readiness.excludedChecklistStatus');
  assertStringArray(value.readiness.resolvedFollowUpStatuses, '$.scoring.readiness.resolvedFollowUpStatuses');
  assertRecord(value.readiness.thresholds, '$.scoring.readiness.thresholds');
  assertNumberFields(value.readiness.thresholds, '$.scoring.readiness.thresholds', [
    'clarificationBelow',
    'estimatePreparationFrom',
    'estimateReadyFrom',
    'developmentReadyFrom'
  ]);
  for (const [key, threshold] of Object.entries(value.readiness.thresholds)) {
    assertPercentage(threshold, `$.scoring.readiness.thresholds.${key}`);
  }
  assertRecord(value.readiness.inputBindings, '$.scoring.readiness.inputBindings');
  assertStringArray(
    value.readiness.inputBindings.baseInfoProjectFields,
    '$.scoring.readiness.inputBindings.baseInfoProjectFields'
  );
  assertNumberArray(
    value.readiness.inputBindings.businessChecklistItemIds,
    '$.scoring.readiness.inputBindings.businessChecklistItemIds'
  );
  assertStringArray(
    value.readiness.inputBindings.ownershipProjectFields,
    '$.scoring.readiness.inputBindings.ownershipProjectFields'
  );
  assertNumberArray(
    value.readiness.inputBindings.ownershipChecklistItemIds,
    '$.scoring.readiness.inputBindings.ownershipChecklistItemIds'
  );
  assertRecord(value.decision, '$.scoring.decision');
  assertRecord(value.decision.weights, '$.scoring.decision.weights');
  assertUnitIntervalFields(value.decision.weights, '$.scoring.decision.weights', [
    'businessValue',
    'strategicAlignment',
    'urgency',
    'confidence',
    'complexity',
    'risk',
    'readiness'
  ]);
  assertRecord(value.decision.scale, '$.scoring.decision.scale');
  assertNumberFields(value.decision.scale, '$.scoring.decision.scale', [
    'minimum',
    'maximum',
    'percentageStep'
  ]);
  assertStringArray(value.decision.scale.invertedDimensions, '$.scoring.decision.scale.invertedDimensions');
  assertRecord(value.decision.thresholds, '$.scoring.decision.thresholds');
  assertNumberFields(value.decision.thresholds, '$.scoring.decision.thresholds', ['high', 'medium']);
  assertPercentage(value.decision.thresholds.high, '$.scoring.decision.thresholds.high');
  assertPercentage(value.decision.thresholds.medium, '$.scoring.decision.thresholds.medium');
  assertRecord(value.decision.clarificationRules, '$.scoring.decision.clarificationRules');
  assertBoolean(value.decision.clarificationRules.criticalGap, '$.scoring.decision.clarificationRules.criticalGap');
  assertNumberFields(value.decision.clarificationRules, '$.scoring.decision.clarificationRules', [
    'estimateBlockingGapsAbove',
    'readinessBelow'
  ]);
  assertPercentage(value.decision.clarificationRules.readinessBelow, '$.scoring.decision.clarificationRules.readinessBelow');
  assertRecord(value.decision.estimateReadyRules, '$.scoring.decision.estimateReadyRules');
  assertNumberFields(value.decision.estimateReadyRules, '$.scoring.decision.estimateReadyRules', [
    'decisionScoreAtLeast',
    'readinessAtLeast',
    'estimateBlockingGaps'
  ]);
  assertPercentage(value.decision.estimateReadyRules.decisionScoreAtLeast, '$.scoring.decision.estimateReadyRules.decisionScoreAtLeast');
  assertPercentage(value.decision.estimateReadyRules.readinessAtLeast, '$.scoring.decision.estimateReadyRules.readinessAtLeast');
  assertRecord(value.decision.conditionalEstimateRules, '$.scoring.decision.conditionalEstimateRules');
  assertNumberFields(value.decision.conditionalEstimateRules, '$.scoring.decision.conditionalEstimateRules', [
    'decisionScoreAtLeast',
    'readinessAtLeast'
  ]);
  assertPercentage(value.decision.conditionalEstimateRules.decisionScoreAtLeast, '$.scoring.decision.conditionalEstimateRules.decisionScoreAtLeast');
  assertPercentage(value.decision.conditionalEstimateRules.readinessAtLeast, '$.scoring.decision.conditionalEstimateRules.readinessAtLeast');
  assertCanonicalPolicy(value, canonicalValue, '$.scoring');
}

function assertGeneralPlaybook(value: unknown, canonicalValue: unknown): asserts value is GeneralPlaybook {
  assertRecord(value, '$');
  assertRecord(canonicalValue, '$');
  assertString(value.id, '$.id');
  assertString(canonicalValue.id, '$.id');
  if (value.id !== canonicalValue.id) {
    failValidation('$.id', 'the canonical playbook ID');
  }
  assertNumber(value.version, '$.version');
  assertNumber(canonicalValue.version, '$.version');
  if (value.version !== canonicalValue.version) {
    failValidation('$.version', 'the canonical playbook version');
  }
  assertString(value.name, '$.name');
  assertString(canonicalValue.name, '$.name');
  if (value.name !== canonicalValue.name) {
    failValidation('$.name', 'the canonical playbook display name');
  }
  assertStatuses(value.statuses, canonicalValue.statuses);
  assertScoring(value.scoring, canonicalValue.scoring);
  assertPlaybookItems(value.items);
}

export function validateGeneralPlaybook(value: unknown): GeneralPlaybook {
  assertGeneralPlaybook(value, generalPlaybookData);
  return value;
}

function deepFreeze<Value>(value: Value): Value {
  if (value !== null && typeof value === 'object') {
    for (const nestedValue of Object.values(value)) {
      deepFreeze(nestedValue);
    }

    Object.freeze(value);
  }

  return value;
}

export const generalPlaybookV1 = deepFreeze(validateGeneralPlaybook(generalPlaybookData));

export const resolvedDiscoveryFollowUpStatuses =
  generalPlaybookV1.scoring.readiness.resolvedFollowUpStatuses;
