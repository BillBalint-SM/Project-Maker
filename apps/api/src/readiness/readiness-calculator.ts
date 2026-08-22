import type {
  AvailableProjectReadiness,
  GeneralPlaybook,
  ReadinessFactor,
  ReadinessGap,
} from '@project-maker/contracts';

import type {
  ReadinessCalculatorInput,
  ReadinessFollowUpInput,
  ReadinessSnapshotInput,
} from './readiness.types';

type FactorId =
  | 'baseInfo'
  | 'business'
  | 'ownership'
  | 'checklist'
  | 'followUpResolution';

interface SortableGap {
  readonly gap: ReadinessGap;
  readonly severityIndex: number;
  readonly targetIndex: number;
  readonly checklistOrder: number | null;
  readonly followUpDueDate: string | null;
  readonly followUpCreatedAt: string | null;
}

const factorCopy: Readonly<Record<FactorId, { readonly label: string; readonly helpText: string }>> = {
  baseInfo: {
    label: 'Core project information',
    helpText: 'Completeness of the Project and Customer baseline information.',
  },
  business: {
    label: 'Business clarity',
    helpText: 'Completion status of the checklist items that define the business outcomes.',
  },
  ownership: {
    label: 'Ownership',
    helpText: 'The assigned next-action owner and the status of ownership-related checklist items.',
  },
  checklist: {
    label: 'Readiness checklist',
    helpText: 'Completion of the relevant checklist items in the current Initial Intake.',
  },
  followUpResolution: {
    label: 'Discovery follow-ups',
    helpText: 'Resolution status of the Project\'s Discovery follow-ups.',
  },
};

export function calculateProjectReadiness(
  input: ReadinessCalculatorInput,
): AvailableProjectReadiness {
  const readinessPolicy = input.policy.scoring.readiness;
  const snapshotsByStableKey = indexSnapshots(input.snapshots);
  const relevantChecklistFraction = averageChecklistValue(
    input.snapshots,
    readinessPolicy.excludedChecklistStatus,
    readinessPolicy.checklistStatusValue,
  );
  const baseInfoFraction = projectFieldFraction(
    input,
    readinessPolicy.inputBindings.baseInfoProjectFields,
  );
  const businessFraction = boundChecklistFraction(
    input,
    snapshotsByStableKey,
    readinessPolicy.inputBindings.businessChecklistItemIds,
  );
  const ownershipFactorFraction = ownershipFraction(input, snapshotsByStableKey);
  const followUpFactorFraction = followUpResolutionFraction(input);

  const factors = [
    toFactor('baseInfo', readinessPolicy.weights.baseInfo, baseInfoFraction),
    toFactor('business', readinessPolicy.weights.business, businessFraction),
    toFactor('ownership', readinessPolicy.weights.ownership, ownershipFactorFraction),
    toFactor('checklist', readinessPolicy.weights.checklist, relevantChecklistFraction),
    toFactor(
      'followUpResolution',
      readinessPolicy.weights.followUpResolution,
      followUpFactorFraction,
    ),
  ];
  const completionPercentage = toPercentage(relevantChecklistFraction);
  const readinessPercentage = Math.round(
    (baseInfoFraction * readinessPolicy.weights.baseInfo +
      businessFraction * readinessPolicy.weights.business +
      ownershipFactorFraction * readinessPolicy.weights.ownership +
      relevantChecklistFraction * readinessPolicy.weights.checklist +
      followUpFactorFraction * readinessPolicy.weights.followUpResolution) *
      100,
  );

  return {
    available: true,
    projectId: input.project.id,
    sourceRoundId: input.sourceRound.id,
    sourceRoundStatus: input.sourceRound.status,
    completionPercentage,
    completionLabel: completionLabel(input.policy, completionPercentage),
    readinessPercentage,
    readinessBand: readinessBand(input.policy, readinessPercentage),
    factors,
    gaps: createGaps(input),
  };
}

function indexSnapshots(
  snapshots: readonly ReadinessSnapshotInput[],
): ReadonlyMap<string, ReadinessSnapshotInput> {
  const snapshotsByStableKey = new Map<string, ReadinessSnapshotInput>();
  for (const snapshot of snapshots) {
    if (snapshotsByStableKey.has(snapshot.stableKey)) {
      throw new TypeError(`Readiness source contains duplicate stable key ${snapshot.stableKey}.`);
    }
    snapshotsByStableKey.set(snapshot.stableKey, snapshot);
  }
  return snapshotsByStableKey;
}

function projectFieldFraction(
  input: ReadinessCalculatorInput,
  fields: readonly string[],
): number {
  if (fields.length === 0) {
    throw new TypeError('Readiness policy must bind at least one base-info project field.');
  }
  const projectFields: Readonly<Record<string, string | null>> = {
    name: input.project.name,
    customerContactName: input.project.customerContactName,
    customerContactEmail: input.project.customerContactEmail,
    ballOwner: input.project.ballOwner,
  };
  let presentCount = 0;
  for (const field of fields) {
    if (!(field in projectFields)) {
      throw new TypeError(`Readiness policy binds unsupported project field ${field}.`);
    }
    if (hasText(projectFields[field])) {
      presentCount += 1;
    }
  }
  return presentCount / fields.length;
}

function boundChecklistFraction(
  input: ReadinessCalculatorInput,
  snapshotsByStableKey: ReadonlyMap<string, ReadinessSnapshotInput>,
  itemIds: readonly number[],
): number {
  if (itemIds.length === 0) {
    throw new TypeError('Readiness policy must bind at least one checklist item.');
  }
  const snapshots = itemIds.map((itemId) =>
    requireBoundSnapshot(input.policy, snapshotsByStableKey, itemId),
  );
  return averageChecklistValue(
    snapshots,
    input.policy.scoring.readiness.excludedChecklistStatus,
    input.policy.scoring.readiness.checklistStatusValue,
  );
}

function ownershipFraction(
  input: ReadinessCalculatorInput,
  snapshotsByStableKey: ReadonlyMap<string, ReadinessSnapshotInput>,
): number {
  const bindings = input.policy.scoring.readiness.inputBindings;
  if (bindings.ownershipProjectFields.length === 0 || bindings.ownershipChecklistItemIds.length === 0) {
    throw new TypeError('Readiness policy must bind ownership project fields and checklist items.');
  }
  const ownershipFieldFraction = projectFieldFraction(input, bindings.ownershipProjectFields);
  const ownershipChecklistFraction = boundChecklistFraction(
    input,
    snapshotsByStableKey,
    bindings.ownershipChecklistItemIds,
  );
  if (ownershipChecklistFraction === 0 && allBoundSnapshotsAreExcluded(input, snapshotsByStableKey)) {
    return 0;
  }
  return (ownershipFieldFraction + ownershipChecklistFraction) / 2;
}

function allBoundSnapshotsAreExcluded(
  input: ReadinessCalculatorInput,
  snapshotsByStableKey: ReadonlyMap<string, ReadinessSnapshotInput>,
): boolean {
  const excludedStatus = input.policy.scoring.readiness.excludedChecklistStatus;
  return input.policy.scoring.readiness.inputBindings.ownershipChecklistItemIds.every((itemId) => {
    const snapshot = requireBoundSnapshot(input.policy, snapshotsByStableKey, itemId);
    return snapshot.checklistStatus === excludedStatus;
  });
}

function requireBoundSnapshot(
  policy: GeneralPlaybook,
  snapshotsByStableKey: ReadonlyMap<string, ReadinessSnapshotInput>,
  itemId: number,
): ReadinessSnapshotInput {
  const playbookItem = policy.items.find((item) => item.id === itemId);
  if (!playbookItem) {
    throw new TypeError(`Readiness policy binds unknown checklist item ${itemId}.`);
  }
  const stableKey = `${policy.id}-${String(playbookItem.id).padStart(3, '0')}`;
  const snapshot = snapshotsByStableKey.get(stableKey);
  if (!snapshot) {
    throw new TypeError(`Readiness source is missing bound checklist item ${stableKey}.`);
  }
  return snapshot;
}

function averageChecklistValue(
  snapshots: readonly ReadinessSnapshotInput[],
  excludedStatus: string,
  statusValues: Readonly<Record<string, number>>,
): number {
  const values = snapshots
    .filter((snapshot) => snapshot.checklistStatus !== excludedStatus)
    .map((snapshot) => checklistValue(snapshot.checklistStatus, statusValues));
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function checklistValue(status: string, statusValues: Readonly<Record<string, number>>): number {
  const value = statusValues[status];
  if (value === undefined || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new TypeError(`Readiness source has unsupported checklist status ${status}.`);
  }
  return value;
}

function followUpResolutionFraction(input: ReadinessCalculatorInput): number {
  if (input.followUps.length === 0) {
    return 1;
  }
  const resolvedStatuses = input.policy.scoring.readiness.resolvedFollowUpStatuses;
  const resolvedCount = input.followUps.filter((followUp) =>
    resolvedStatuses.includes(followUp.status),
  ).length;
  return resolvedCount / input.followUps.length;
}

function toFactor(id: FactorId, weight: number, fraction: number): ReadinessFactor {
  if (!Number.isFinite(weight) || weight < 0 || weight > 1) {
    throw new TypeError(`Readiness policy factor ${id} has an invalid weight.`);
  }
  return {
    id,
    weight,
    percentage: toPercentage(fraction),
    label: factorCopy[id].label,
    helpText: factorCopy[id].helpText,
  };
}

function toPercentage(fraction: number): number {
  if (!Number.isFinite(fraction) || fraction < 0 || fraction > 1) {
    throw new TypeError('Readiness factor fraction is outside the supported range.');
  }
  return Math.round(fraction * 100);
}

function completionLabel(policy: GeneralPlaybook, completionPercentage: number): string {
  requirePolicyLabel(policy.statuses.completion, 0, 'complete completion');
  requirePolicyLabel(policy.statuses.completion, 1, 'in-progress completion');
  requirePolicyLabel(
    policy.statuses.completion,
    2,
    'clarification completion',
  );
  if (completionPercentage === 0) {
    return 'Clarification required';
  }
  if (completionPercentage === 100) {
    return 'Complete';
  }
  return 'In progress';
}

function readinessBand(policy: GeneralPlaybook, percentage: number): string {
  const thresholds = policy.scoring.readiness.thresholds;
  if (
    thresholds.clarificationBelow > thresholds.estimatePreparationFrom ||
    thresholds.estimatePreparationFrom > thresholds.estimateReadyFrom ||
    thresholds.estimateReadyFrom > thresholds.developmentReadyFrom
  ) {
    throw new TypeError('Readiness policy thresholds are not ordered.');
  }
  if (percentage < thresholds.clarificationBelow) {
    return 'Clarification required';
  }
  if (percentage >= thresholds.developmentReadyFrom) {
    return 'Ready for development';
  }
  if (percentage >= thresholds.estimateReadyFrom) {
    return 'Ready for estimation';
  }
  if (percentage >= thresholds.estimatePreparationFrom) {
    return 'Ready for estimation preparation';
  }
  return 'Clarification required';
}

function createGaps(input: ReadinessCalculatorInput): readonly ReadinessGap[] {
  const sortableGaps: SortableGap[] = [];
  const severities = input.policy.statuses.readinessGapSeverity;
  requirePolicyLabel(severities, 0, 'critical readiness gap');
  requirePolicyLabel(severities, 1, 'important readiness gap');
  requirePolicyLabel(severities, 2, 'clarification readiness gap');
  const criticalSeverity = 'Critical';
  const importantSeverity = 'Important';
  const clarificationSeverity = 'Clarification';
  const blockedFollowUpStatus = requireBlockedFollowUpStatus(input.policy);

  if (!hasText(input.project.ballOwner)) {
    sortableGaps.push({
      gap: {
        id: 'overview-ball-owner',
        severity: importantSeverity,
        category: 'Ownership',
        message: 'The next action does not have an owner.',
        nextStep: 'Assign an owner on the Project Status page.',
        target: 'overview',
        snapshotId: null,
        followUpId: null,
      },
      severityIndex: 1,
      targetIndex: 0,
      checklistOrder: null,
      followUpDueDate: null,
      followUpCreatedAt: null,
    });
  }

  for (const snapshot of input.snapshots) {
    const gap = checklistGap(
      snapshot,
      input.policy.scoring.readiness.excludedChecklistStatus,
      input.policy.scoring.readiness.checklistStatusValue,
      criticalSeverity,
      importantSeverity,
      clarificationSeverity,
    );
    if (gap) {
      sortableGaps.push(gap);
    }
  }

  for (const followUp of input.followUps) {
    if (input.policy.scoring.readiness.resolvedFollowUpStatuses.includes(followUp.status)) {
      continue;
    }
    const isBlocked = followUp.status === blockedFollowUpStatus;
    sortableGaps.push({
      gap: {
        id: `follow-up-${followUp.id}`,
        severity: isBlocked ? criticalSeverity : importantSeverity,
        category: 'Discovery follow-up',
        message: isBlocked
          ? 'A Discovery follow-up is blocked.'
          : 'A Discovery follow-up remains unresolved.',
        nextStep: isBlocked
          ? 'Resolve the blocking Discovery follow-up.'
          : 'Complete or resolve the Discovery follow-up.',
        target: 'follow-ups',
        snapshotId: null,
        followUpId: followUp.id,
      },
      severityIndex: isBlocked ? 0 : 1,
      targetIndex: 2,
      checklistOrder: null,
      followUpDueDate: followUp.dueDate,
      followUpCreatedAt: followUp.createdAt,
    });
  }

  return sortableGaps.sort(compareGaps).map((value) => value.gap);
}

function checklistGap(
  snapshot: ReadinessSnapshotInput,
  excludedStatus: string,
  statusValues: Readonly<Record<string, number>>,
  criticalSeverity: string,
  importantSeverity: string,
  clarificationSeverity: string,
): SortableGap | null {
  if (snapshot.checklistStatus === excludedStatus) {
    return null;
  }
  const value = checklistValue(snapshot.checklistStatus, statusValues);
  if (value === 1) {
    return null;
  }
  const missing = value === 0;
  const critical = missing && snapshot.blocking;
  const important = critical || (missing && snapshot.required) || (!missing && (snapshot.required || snapshot.blocking));
  const severityIndex = critical ? 0 : important ? 1 : 2;
  const severity =
    severityIndex === 0
      ? criticalSeverity
      : severityIndex === 1
        ? importantSeverity
        : clarificationSeverity;
  return {
    gap: {
      id: `checklist-${snapshot.stableKey}`,
      severity,
      category: 'Readiness checklist',
      message: missing
        ? 'The checklist item does not yet have enough supporting information.'
        : 'The checklist item is only partially complete.',
      nextStep: 'Open the question and complete or clarify the supporting information.',
      target: 'checklist',
      snapshotId: snapshot.id,
      followUpId: null,
    },
    severityIndex,
    targetIndex: 1,
    checklistOrder: snapshot.order,
    followUpDueDate: null,
    followUpCreatedAt: null,
  };
}

function compareGaps(left: SortableGap, right: SortableGap): number {
  if (left.severityIndex !== right.severityIndex) {
    return left.severityIndex - right.severityIndex;
  }
  if (left.targetIndex !== right.targetIndex) {
    return left.targetIndex - right.targetIndex;
  }
  if (left.checklistOrder !== null && right.checklistOrder !== null) {
    if (left.checklistOrder !== right.checklistOrder) {
      return left.checklistOrder - right.checklistOrder;
    }
  }
  if (left.followUpDueDate !== null && right.followUpDueDate !== null) {
    const dueDateComparison = compareText(left.followUpDueDate, right.followUpDueDate);
    if (dueDateComparison !== 0) {
      return dueDateComparison;
    }
    const createdAtComparison = compareText(
      requireText(left.followUpCreatedAt, 'follow-up createdAt'),
      requireText(right.followUpCreatedAt, 'follow-up createdAt'),
    );
    if (createdAtComparison !== 0) {
      return createdAtComparison;
    }
  }
  return compareText(left.gap.id, right.gap.id);
}

function requireBlockedFollowUpStatus(policy: GeneralPlaybook): string {
  const blockedStatus = policy.statuses.followUp.find((status) => status === 'Blokkolt');
  if (!blockedStatus) {
    throw new TypeError('Readiness policy does not define a blocked follow-up status.');
  }
  return blockedStatus;
}

function requirePolicyLabel(values: readonly string[], index: number, semantic: string): string {
  const value = values[index];
  if (!value) {
    throw new TypeError(`Readiness policy is missing ${semantic} label.`);
  }
  return value;
}

function compareText(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function requireText(value: string | null, field: string): string {
  if (value === null) {
    throw new TypeError(`Readiness ${field} is missing.`);
  }
  return value;
}

function hasText(value: string | null): boolean {
  return value !== null && value.trim().length > 0;
}
