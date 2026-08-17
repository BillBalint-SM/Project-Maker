export const followUpDeliveryStatuses = ['NEVER', 'SENT', 'FAILED'] as const;

export type FollowUpDeliveryStatus = (typeof followUpDeliveryStatuses)[number];

export interface CustomerFollowUpState {
  readonly projectId: string;
  readonly messageDraft: string | null;
  readonly referencedFollowUpId: string | null;
  readonly draftVersion: number;
  readonly enabled: boolean;
  readonly intervalMinutes: number;
  readonly expiresAt: string | null;
  readonly lastPingAt: string | null;
  readonly nextPingAt: string | null;
  readonly lastDeliveryStatus: FollowUpDeliveryStatus;
  /** A stable, non-sensitive error code; transport responses are never exposed. */
  readonly lastDeliveryError: string | null;
}

export interface UpdateCustomerFollowUpDraftInput {
  readonly messageDraft: string;
  readonly referencedFollowUpId: string | null;
  readonly expectedVersion: number;
}

export interface CustomerFollowUpReferenceOption {
  readonly id: string;
  readonly question: string;
  readonly nextStep: string;
  readonly dueDate: string;
  readonly version: number;
}

export interface PreviewCustomerFollowUpPingInput {
  readonly expectedVersion: number;
}

export interface CustomerFollowUpPingPreview {
  readonly recipientName: string;
  readonly recipientEmail: string;
  readonly subject: string;
  readonly text: string;
  readonly draftVersion: number;
  readonly referencedFollowUpVersion: number | null;
  readonly previewToken: string;
  readonly expiresAt: string;
}

export interface CustomerFollowUpPingDelivery {
  readonly attemptId: string;
  readonly state: 'SENT';
  readonly draftVersion: number;
  readonly referencedFollowUpId: string | null;
  readonly referencedFollowUpVersion: number | null;
  readonly sentAt: string;
}

export interface UpdateCustomerFollowUpInput {
  readonly enabled?: boolean;
  readonly intervalMinutes?: number;
  readonly expiresAt?: string | null;
}

export interface SendFollowUpPingInput {
  readonly previewToken: string;
}
