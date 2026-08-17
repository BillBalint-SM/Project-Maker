export const handoffVersionStatuses = [
  'DRAFT',
  'SENDING',
  'SENT',
  'FAILED',
  'UNKNOWN',
] as const;

export type HandoffVersionStatus = (typeof handoffVersionStatuses)[number];

export interface InterviewCustomerHandoffSummary {
  readonly id: string;
  readonly projectId: string;
  readonly roundId: string;
  readonly version: number;
  readonly state: HandoffVersionStatus;
  readonly modificationSummary: string | null;
  readonly supersedesHandoffId: string | null;
  readonly recipientName: string | null;
  readonly recipientEmail: string | null;
  readonly createdAt: string;
  readonly attemptedAt: string | null;
  readonly sentAt: string | null;
}

export interface InterviewCustomerHandoffDetail extends InterviewCustomerHandoffSummary {
  readonly internalOwnerName: string | null;
  readonly subject: string | null;
  readonly htmlContent: string | null;
  readonly textContent: string | null;
  readonly sourceContentVersion: number | null;
  readonly failureCode: string | null;
}

export interface InterviewCustomerHandoffPreview {
  readonly handoffId: string;
  readonly version: number;
  readonly recipientName: string;
  readonly recipientEmail: string;
  readonly subject: string;
  readonly htmlContent: string;
  readonly textContent: string;
  readonly sourceContentVersion: number;
  readonly previewDigest: string;
}

export interface UpdateInterviewCustomerHandoffDraftInput {
  readonly modificationSummary: string | null;
}

export interface SendInterviewCustomerHandoffInput {
  readonly sourceContentVersion: number;
  readonly previewDigest: string;
}

export interface RetryInterviewCustomerHandoffInput {
  readonly acknowledgeDuplicateRisk?: boolean;
}
