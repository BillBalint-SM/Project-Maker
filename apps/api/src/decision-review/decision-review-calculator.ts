import type {
  AvailableProjectDecisionReview,
  DecisionClarificationReason,
  DecisionReviewDimension,
  DecisionReviewInputKey,
  DecisionReviewInputs,
  GeneralPlaybook,
  ProjectReadiness,
} from '@project-maker/contracts';

const decisionInputFields = [
  'businessValue',
  'strategicAlignment',
  'urgency',
  'confidence',
  'complexity',
  'risk',
] as const satisfies readonly DecisionReviewInputKey[];

type CompleteDecisionReviewInputs = {
  readonly [Field in DecisionReviewInputKey]: number;
};

export function calculateDecisionReview(
  projectId: string,
  inputs: CompleteDecisionReviewInputs,
  editable: boolean,
  readiness: Extract<ProjectReadiness, { readonly available: true }>,
  policy: GeneralPlaybook,
): AvailableProjectDecisionReview {
  const dimensions = toDimensions(policy);
  const decisionScore = calculateScore(inputs, readiness.readinessPercentage, dimensions, policy);
  const estimateBlockingGapCount = countEstimateBlockingGaps(readiness, policy);
  const hasCriticalGap = readiness.gaps.some(
    (gap) => gap.severity === requirePolicyLabel(policy.statuses.readinessGapSeverity, 0, 'critical gap'),
  );
  const clarificationReasons = deriveClarificationReasons(
    decisionScore,
    readiness.readinessPercentage,
    hasCriticalGap,
    estimateBlockingGapCount,
    policy,
  );

  return {
    projectId,
    inputs,
    dimensions,
    ratingScale: {
      minimum: policy.scoring.decision.scale.minimum,
      maximum: policy.scoring.decision.scale.maximum,
    },
    editable,
    available: true,
    decisionScore,
    decisionScoreLabel: decisionScoreLabel(decisionScore, policy),
    recommendation: recommendation(
      decisionScore,
      readiness.readinessPercentage,
      estimateBlockingGapCount,
      clarificationReasons,
      policy,
    ),
    readinessPercentage: readiness.readinessPercentage,
    hasCriticalGap,
    estimateBlockingGapCount,
    clarificationReasons,
    clarificationMessages: clarificationMessages(clarificationReasons, policy),
  };
}

export function hasCompleteDecisionReviewInputs(
  inputs: DecisionReviewInputs,
): inputs is CompleteDecisionReviewInputs {
  return decisionInputFields.every((field) => inputs[field] !== null);
}

export function decisionReviewDimensions(policy: GeneralPlaybook): readonly DecisionReviewDimension[] {
  return toDimensions(policy);
}

function calculateScore(
  inputs: CompleteDecisionReviewInputs,
  readinessPercentage: number,
  dimensions: readonly DecisionReviewDimension[],
  policy: GeneralPlaybook,
): number {
  const readinessWeight = policy.scoring.decision.weights.readiness;
  if (!Number.isFinite(readinessPercentage) || readinessPercentage < 0 || readinessPercentage > 100) {
    throw new TypeError('Readiness percentage is outside the supported range.');
  }
  if (!Number.isFinite(readinessWeight) || readinessWeight < 0 || readinessWeight > 1) {
    throw new TypeError('Decision policy has an invalid readiness weight.');
  }

  const ratingScore = dimensions.reduce(
    (total, dimension) =>
      total + normalizedRating(inputs[dimension.id], dimension.inverted, policy) * dimension.weight,
    0,
  );
  return Math.round(ratingScore + readinessPercentage * readinessWeight);
}

function normalizedRating(rating: number, inverted: boolean, policy: GeneralPlaybook): number {
  const scale = policy.scoring.decision.scale;
  if (!Number.isInteger(rating) || rating < scale.minimum || rating > scale.maximum) {
    throw new TypeError('Decision input rating is outside the policy scale.');
  }
  if (scale.minimum > scale.maximum || scale.percentageStep <= 0) {
    throw new TypeError('Decision policy scale is invalid.');
  }
  const normalized = inverted
    ? (scale.maximum - rating + 1) * scale.percentageStep
    : (rating - scale.minimum + 1) * scale.percentageStep;
  if (normalized < 0 || normalized > 100) {
    throw new TypeError('Decision policy scale does not resolve to percentages.');
  }
  return normalized;
}

function toDimensions(policy: GeneralPlaybook): readonly DecisionReviewDimension[] {
  const invertedDimensions = new Set(policy.scoring.decision.scale.invertedDimensions);
  return decisionInputFields.map((id) => {
    const weight = policy.scoring.decision.weights[id];
    if (!Number.isFinite(weight) || weight < 0 || weight > 1) {
      throw new TypeError(`Decision policy has an invalid ${id} weight.`);
    }
    return { id, weight, inverted: invertedDimensions.has(id) };
  });
}

function countEstimateBlockingGaps(
  readiness: Extract<ProjectReadiness, { readonly available: true }>,
  policy: GeneralPlaybook,
): number {
  const requiredStableKeys = new Set(
    policy.items
      .filter((item) => item.requiredForEstimate)
      .map((item) => `${policy.id}-${String(item.id).padStart(3, '0')}`),
  );
  return readiness.gaps.filter(
    (gap) =>
      gap.id.startsWith('checklist-') && requiredStableKeys.has(gap.id.slice('checklist-'.length)),
  ).length;
}

function deriveClarificationReasons(
  decisionScore: number,
  readinessPercentage: number,
  hasCriticalGap: boolean,
  estimateBlockingGapCount: number,
  policy: GeneralPlaybook,
): readonly DecisionClarificationReason[] {
  const rules = policy.scoring.decision.clarificationRules;
  const reasons: DecisionClarificationReason[] = [];
  if (rules.criticalGap && hasCriticalGap) {
    reasons.push('CRITICAL_GAP');
  }
  if (readinessPercentage < rules.readinessBelow) {
    reasons.push('READINESS_BELOW_CLARIFICATION_THRESHOLD');
  }
  if (estimateBlockingGapCount > rules.estimateBlockingGapsAbove) {
    reasons.push('TOO_MANY_ESTIMATE_BLOCKING_GAPS');
  }
  if (reasons.length > 0) {
    return reasons;
  }
  if (readinessPercentage < policy.scoring.decision.conditionalEstimateRules.readinessAtLeast) {
    return ['READINESS_BELOW_ESTIMATE_PREPARATION_THRESHOLD'];
  }
  if (decisionScore < policy.scoring.decision.conditionalEstimateRules.decisionScoreAtLeast) {
    return ['DECISION_SCORE_BELOW_ESTIMATE_PREPARATION_THRESHOLD'];
  }
  return [];
}

function recommendation(
  decisionScore: number,
  readinessPercentage: number,
  estimateBlockingGapCount: number,
  clarificationReasons: readonly DecisionClarificationReason[],
  policy: GeneralPlaybook,
): AvailableProjectDecisionReview['recommendation'] {
  if (clarificationReasons.length > 0) {
    return 'CLARIFICATION_REQUIRED';
  }
  const readyRules = policy.scoring.decision.estimateReadyRules;
  if (
    decisionScore >= readyRules.decisionScoreAtLeast &&
    readinessPercentage >= readyRules.readinessAtLeast &&
    estimateBlockingGapCount === readyRules.estimateBlockingGaps
  ) {
    return 'ESTIMATE_READY';
  }
  const preparationRules = policy.scoring.decision.conditionalEstimateRules;
  if (
    decisionScore >= preparationRules.decisionScoreAtLeast &&
    readinessPercentage >= preparationRules.readinessAtLeast
  ) {
    return 'ESTIMATE_PREPARATION_POSSIBLE';
  }
  return 'CLARIFICATION_REQUIRED';
}

function clarificationMessages(
  reasons: readonly DecisionClarificationReason[],
  policy: GeneralPlaybook,
): readonly string[] {
  const clarificationRules = policy.scoring.decision.clarificationRules;
  const preparationRules = policy.scoring.decision.conditionalEstimateRules;
  return reasons.map((reason) => {
    switch (reason) {
      case 'CRITICAL_GAP':
        return 'Kritikus felkészültségi hiány maradt.';
      case 'READINESS_BELOW_CLARIFICATION_THRESHOLD':
        return `A felkészültség ${clarificationRules.readinessBelow}% alatt van.`;
      case 'TOO_MANY_ESTIMATE_BLOCKING_GAPS':
        return `Több mint ${clarificationRules.estimateBlockingGapsAbove} becslést blokkoló hiány maradt.`;
      case 'DECISION_SCORE_BELOW_ESTIMATE_PREPARATION_THRESHOLD':
        return `A döntési pontszám még nem éri el a ${preparationRules.decisionScoreAtLeast}-ös becslés-előkészítési küszöböt.`;
      case 'READINESS_BELOW_ESTIMATE_PREPARATION_THRESHOLD':
        return `A felkészültség még nem éri el a ${preparationRules.readinessAtLeast}%-os becslés-előkészítési küszöböt.`;
    }
  });
}

function decisionScoreLabel(decisionScore: number, policy: GeneralPlaybook): string {
  const thresholds = policy.scoring.decision.thresholds;
  if (thresholds.medium > thresholds.high) {
    throw new TypeError('Decision policy score thresholds are not ordered.');
  }
  if (decisionScore >= thresholds.high) {
    return requirePolicyLabel(policy.statuses.decisionScoreLabel, 0, 'high Decision Score');
  }
  if (decisionScore >= thresholds.medium) {
    return requirePolicyLabel(policy.statuses.decisionScoreLabel, 1, 'medium Decision Score');
  }
  return requirePolicyLabel(policy.statuses.decisionScoreLabel, 2, 'low Decision Score');
}

function requirePolicyLabel(values: readonly string[], index: number, meaning: string): string {
  const value = values[index];
  if (!value) {
    throw new TypeError(`Decision policy is missing ${meaning} label.`);
  }
  return value;
}
