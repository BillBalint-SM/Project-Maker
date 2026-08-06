export const followUpDeliveryStatuses = ['NEVER', 'SENT', 'FAILED'] as const;

export type FollowUpDeliveryStatus = (typeof followUpDeliveryStatuses)[number];

export interface CustomerFollowUpState {
  readonly projectId: string;
  readonly enabled: boolean;
  readonly intervalMinutes: number;
  readonly expiresAt: string | null;
  readonly lastPingAt: string | null;
  readonly nextPingAt: string | null;
  readonly lastDeliveryStatus: FollowUpDeliveryStatus;
  /** A stable, non-sensitive error code; transport responses are never exposed. */
  readonly lastDeliveryError: string | null;
}

export interface UpdateCustomerFollowUpInput {
  readonly enabled?: boolean;
  readonly intervalMinutes?: number;
  readonly expiresAt?: string | null;
}

export interface SendFollowUpPingInput {
  readonly revisionId?: string;
}

export interface SendCustomerReviewEmailInput {
  readonly revisionId?: string;
}

export interface CustomerEmailDelivery {
  readonly projectId: string;
  readonly revisionId: string;
  readonly revisionVersion: number;
  readonly sentAt: string;
}
