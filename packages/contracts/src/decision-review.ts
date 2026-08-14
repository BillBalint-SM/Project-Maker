export interface DecisionReviewInputs {
  readonly businessValue: number | null;
  readonly strategicAlignment: number | null;
  readonly urgency: number | null;
  readonly confidence: number | null;
  readonly complexity: number | null;
  readonly risk: number | null;
}

export type UpdateDecisionReviewInput = DecisionReviewInputs;

export const decisionReviewInputKeys = [
  'businessValue',
  'strategicAlignment',
  'urgency',
  'confidence',
  'complexity',
  'risk',
] as const;

export type DecisionReviewInputKey = (typeof decisionReviewInputKeys)[number];

export interface DecisionReviewDimension {
  readonly id: DecisionReviewInputKey;
  readonly weight: number;
  readonly inverted: boolean;
}

export interface DecisionReviewRatingScale {
  readonly minimum: number;
  readonly maximum: number;
}

export type DecisionRecommendation =
  | 'CLARIFICATION_REQUIRED'
  | 'ESTIMATE_PREPARATION_POSSIBLE'
  | 'ESTIMATE_READY';

export type DecisionClarificationReason =
  | 'CRITICAL_GAP'
  | 'READINESS_BELOW_CLARIFICATION_THRESHOLD'
  | 'TOO_MANY_ESTIMATE_BLOCKING_GAPS'
  | 'DECISION_SCORE_BELOW_ESTIMATE_PREPARATION_THRESHOLD'
  | 'READINESS_BELOW_ESTIMATE_PREPARATION_THRESHOLD';

export type DecisionReviewUnavailableReason =
  | 'INCOMPLETE_INPUT'
  | 'NO_INITIAL_INTAKE'
  | 'UNSUPPORTED_SCHEMA';

interface ProjectDecisionReviewBase {
  readonly projectId: string;
  readonly inputs: DecisionReviewInputs;
  readonly dimensions: readonly DecisionReviewDimension[];
  readonly ratingScale: DecisionReviewRatingScale;
  readonly editable: boolean;
}

export interface UnavailableProjectDecisionReview extends ProjectDecisionReviewBase {
  readonly available: false;
  readonly unavailableReasons: readonly DecisionReviewUnavailableReason[];
}

export interface AvailableProjectDecisionReview extends ProjectDecisionReviewBase {
  readonly available: true;
  readonly decisionScore: number;
  readonly decisionScoreLabel: string;
  readonly recommendation: DecisionRecommendation;
  readonly readinessPercentage: number;
  readonly hasCriticalGap: boolean;
  readonly estimateBlockingGapCount: number;
  readonly clarificationReasons: readonly DecisionClarificationReason[];
  readonly clarificationMessages: readonly string[];
}

export type ProjectDecisionReview =
  | UnavailableProjectDecisionReview
  | AvailableProjectDecisionReview;
