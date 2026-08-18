export const mailSystemAcceptanceStates = ['ACCEPTED', 'REJECTED'] as const;
export type MailSystemAcceptanceState = (typeof mailSystemAcceptanceStates)[number];

export const exactPteCustomerSenderAddressPattern = /^[^@\s]+@pte\.hu$/i;

export const mailboxChangeTypes = ['UPSERTED', 'DELETED'] as const;
export type MailboxChangeType = (typeof mailboxChangeTypes)[number];

export const customerCorrespondenceStatuses = [
  'Válaszra vár',
  'Új válasz',
  'Feldolgozás alatt',
  'Lezárva',
] as const;
export type CustomerCorrespondenceStatus = (typeof customerCorrespondenceStatuses)[number];

export const customerMailErrorCodes = [
  'CONFIGURATION_ERROR',
  'AUTHENTICATION_ERROR',
  'SUBMISSION_REJECTED',
  'THROTTLED',
  'INVALID_CURSOR',
  'TEMPORARY_FAILURE',
  'OUTCOME_UNKNOWN',
] as const;
export type CustomerMailErrorCode = (typeof customerMailErrorCodes)[number];

export interface OutboundCustomerMessage {
  readonly senderAddress?: string;
  readonly senderName?: string;
  readonly recipientAddress: string;
  readonly replyToAddress?: string;
  readonly subject: string;
  readonly textContent: string;
  readonly htmlContent?: string;
}

export interface MailSubmissionResult {
  readonly acceptance: MailSystemAcceptanceState;
  readonly messageReference: string | null;
}

export interface CustomerMailboxChange {
  readonly changeType: MailboxChangeType;
  readonly messageReference: string;
  readonly internetMessageId: string | null;
  readonly inReplyTo: string | null;
  readonly senderAddress: string | null;
  readonly recipientAddresses: readonly string[];
  readonly subject: string | null;
  readonly textContent: string | null;
  readonly receivedAt: string | null;
  readonly attachmentCount: number;
  readonly attachments: readonly CustomerMailboxAttachmentMetadata[];
}

export interface CustomerMailboxAttachmentMetadata {
  readonly name: string;
  readonly contentType: string;
  readonly size: number;
}

export type CustomerReplySenderClassification = 'CUSTOMER_CONTACT' | 'UNRECOGNIZED';

export const customerInboundMessageClassifications = [
  'Elfogadva',
  'Módosítást kér',
  'Kérdés vagy válasz',
  'Egyéb',
] as const;
export type CustomerInboundMessageClassification =
  (typeof customerInboundMessageClassifications)[number];

export interface CustomerInboundMessageView {
  readonly id: string;
  readonly providerMessageReference: string;
  readonly internetMessageId: string | null;
  readonly receivedAt: string;
  readonly senderAddress: string | null;
  readonly senderClassification: CustomerReplySenderClassification;
  readonly recipientAddresses: readonly string[];
  readonly subject: string | null;
  readonly textContent: string;
  readonly visibleText: string;
  readonly quotedText: string | null;
  readonly attachmentCount: number;
  readonly attachments: readonly CustomerMailboxAttachmentMetadata[];
  readonly correlationEvidence: 'TOKENIZED_REPLY_TO';
  readonly classification: CustomerInboundMessageClassification | null;
}

export interface CustomerCorrespondenceView {
  readonly id: string;
  readonly status: CustomerCorrespondenceStatus;
  readonly unreadMessageCount: number;
  readonly processingVersion: number;
  readonly messages: readonly CustomerInboundMessageView[];
}

export type CustomerCorrespondenceCommand =
  | { readonly command: 'MARK_REVIEWED'; readonly expectedVersion: number }
  | {
      readonly command: 'SET_STATUS';
      readonly expectedVersion: number;
      readonly status: CustomerCorrespondenceStatus;
    }
  | {
      readonly command: 'CLASSIFY_MESSAGE';
      readonly expectedVersion: number;
      readonly messageId: string;
      readonly classification: CustomerInboundMessageClassification;
      readonly closeCorrespondence?: boolean;
    };

export interface ProjectCustomerCorrespondenceWork {
  readonly newReplyCount: number;
  readonly correspondences: readonly CustomerCorrespondenceView[];
}

export interface CustomerReplySummary {
  readonly newReplyCount: number;
  readonly projectCount: number;
  readonly projects: readonly { readonly projectId: string; readonly newReplyCount: number }[];
}

export interface CustomerMailboxChangePage {
  readonly changes: readonly CustomerMailboxChange[];
  readonly nextPageCheckpoint: CustomerMailboxCheckpoint | null;
  readonly completedCheckpoint: CustomerMailboxCheckpoint | null;
}

export interface CustomerMailboxCheckpoint {
  readonly value: string;
}

export const customerMailboxSyncStates = [
  'NOT_CONFIGURED',
  'INITIALIZING',
  'CURRENT',
  'DELAYED',
  'UNAVAILABLE',
  'CONFIGURATION_ERROR',
  'AUTHORIZATION_ERROR',
] as const;
export type CustomerMailboxSyncState = (typeof customerMailboxSyncStates)[number];

export interface CustomerMailboxSyncStatus {
  readonly mailboxAddress: string | null;
  readonly state: CustomerMailboxSyncState;
  readonly baselineEstablished: boolean;
  readonly lastSuccessfulSyncAt: string | null;
  readonly refreshInProgress: boolean;
}

export function parseMailSystemAcceptanceState(value: unknown): MailSystemAcceptanceState {
  return parseClosedValue(value, mailSystemAcceptanceStates, 'mail-system acceptance state');
}

export function parseMailboxChangeType(value: unknown): MailboxChangeType {
  return parseClosedValue(value, mailboxChangeTypes, 'mailbox change type');
}

export function parseCustomerCorrespondenceStatus(value: unknown): CustomerCorrespondenceStatus {
  return parseClosedValue(value, customerCorrespondenceStatuses, 'customer correspondence status');
}

export function parseCustomerMailErrorCode(value: unknown): CustomerMailErrorCode {
  return parseClosedValue(value, customerMailErrorCodes, 'customer mail error code');
}

export function parseCustomerMailboxSyncState(value: unknown): CustomerMailboxSyncState {
  return parseClosedValue(value, customerMailboxSyncStates, 'customer mailbox sync state');
}

function parseClosedValue<const T extends readonly string[]>(
  value: unknown,
  values: T,
  label: string,
): T[number] {
  if (typeof value !== 'string' || !values.includes(value)) {
    throw new TypeError(`Unknown ${label}.`);
  }
  return value as T[number];
}
