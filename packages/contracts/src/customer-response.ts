export const customerResponsePromptSourceKinds = [
  'ROUND_PROMPT',
  'DISCOVERY_FOLLOW_UP',
] as const;
export type CustomerResponsePromptSourceKind = (typeof customerResponsePromptSourceKinds)[number];

export interface CustomerResponseEligiblePrompt {
  readonly sourceKind: CustomerResponsePromptSourceKind;
  readonly sourceId: string;
  readonly sourceVersion: number | null;
  readonly topic: string;
  readonly text: string;
}

export interface CustomerResponsePromptSelection {
  readonly sourceKind: CustomerResponsePromptSourceKind;
  readonly sourceId: string;
}

export interface PreviewCustomerResponseRequestInput {
  readonly prompts: readonly CustomerResponsePromptSelection[];
}

export interface CustomerResponseRequestPreview {
  readonly previewToken: string;
  readonly recipientName: string;
  readonly recipientEmail: string;
  readonly senderName: string;
  readonly senderAddress: string;
  readonly subject: string;
  readonly textContent: string;
  readonly htmlContent: string;
  readonly prompts: readonly CustomerResponseEligiblePrompt[];
  readonly expiresAt: string;
}

export interface ConfirmCustomerResponseRequestInput {
  readonly previewToken: string;
}

export type CustomerResponseRequestState = 'OPEN' | 'SUBMITTED' | 'REVOKED';
export type CustomerResponseDeliveryState = 'SENDING' | 'SENT' | 'FAILED' | 'UNKNOWN';

export interface CustomerResponsePrompt extends CustomerResponseEligiblePrompt {
  readonly id: string;
  readonly order: number;
}

export interface CustomerResponseAnswer {
  readonly id: string;
  readonly promptId: string;
  readonly order: number;
  readonly answer: string;
  readonly evidenceId: string | null;
}

export interface CustomerResponseSubmission {
  readonly id: string;
  readonly submittedAt: string;
  readonly reviewedAt: string | null;
  readonly reviewedBy: string | null;
  readonly answers: readonly CustomerResponseAnswer[];
}

export interface CustomerResponseRequest {
  readonly id: string;
  readonly projectId: string;
  readonly state: CustomerResponseRequestState;
  readonly deliveryState: CustomerResponseDeliveryState;
  readonly recipientName: string;
  readonly recipientEmail: string;
  readonly subject: string;
  readonly prompts: readonly CustomerResponsePrompt[];
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly sentAt: string | null;
  readonly createdAt: string;
  readonly failureCode: string | null;
  readonly submission: CustomerResponseSubmission | null;
}

export interface PublicCustomerResponseRequest {
  readonly requestId: string;
  readonly projectName: string;
  readonly expiresAt: string;
  readonly prompts: readonly Pick<CustomerResponsePrompt, 'id' | 'order' | 'topic' | 'text'>[];
}

export interface SubmitCustomerResponseInput {
  readonly idempotencyKey: string;
  readonly answers: readonly { readonly promptId: string; readonly answer: string }[];
}

export interface CustomerResponseSubmissionReceipt {
  readonly submissionId: string;
  readonly submittedAt: string;
}
