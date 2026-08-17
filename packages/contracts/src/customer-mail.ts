export const mailSystemAcceptanceStates = ['ACCEPTED', 'REJECTED'] as const;
export type MailSystemAcceptanceState = (typeof mailSystemAcceptanceStates)[number];

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
  readonly subject: string | null;
  readonly textContent: string | null;
  readonly receivedAt: string | null;
}

export interface CustomerMailboxChangePage {
  readonly changes: readonly CustomerMailboxChange[];
  readonly nextPageCheckpoint: CustomerMailboxCheckpoint | null;
  readonly completedCheckpoint: CustomerMailboxCheckpoint | null;
}

export interface CustomerMailboxCheckpoint {
  readonly value: string;
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
