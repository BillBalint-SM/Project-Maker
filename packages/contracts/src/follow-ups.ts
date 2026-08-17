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

export type SendFollowUpPingInput = Record<string, never>;
