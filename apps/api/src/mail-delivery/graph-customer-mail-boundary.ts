import type {
  CustomerMailErrorCode,
  CustomerMailboxChange,
  CustomerMailboxChangePage,
  MailSubmissionResult,
  OutboundCustomerMessage,
} from '@project-maker/contracts';

import {
  CustomerMailBoundaryError,
  type CustomerMailboxChanges,
  type CustomerOutboundMail,
} from './customer-mail-boundary';

export { CustomerMailBoundaryError } from './customer-mail-boundary';

export interface GraphOutboundMessage {
  readonly toRecipients: readonly { readonly emailAddress: { readonly address: string } }[];
  readonly subject: string;
  readonly body: { readonly contentType: 'Text' | 'HTML'; readonly content: string };
}

export interface GraphMailboxMessage {
  readonly id: string;
  readonly '@removed'?: unknown;
  readonly internetMessageId?: string | null;
  readonly internetMessageHeaders?: readonly { readonly name: string; readonly value: string }[];
  readonly from?: { readonly emailAddress?: { readonly address?: string | null } | null } | null;
  readonly subject?: string | null;
  readonly body?: { readonly content?: string | null } | null;
  readonly receivedDateTime?: string | null;
}

export interface GraphMailboxPage {
  readonly value: readonly GraphMailboxMessage[];
  readonly nextCheckpoint: string | null;
  readonly completedCheckpoint: string | null;
}

export type GraphMailClientErrorCode =
  | 'CONFIGURATION'
  | 'AUTHENTICATION'
  | 'REJECTED'
  | 'THROTTLED'
  | 'INVALID_CURSOR'
  | 'TEMPORARY'
  | 'UNKNOWN_OUTCOME';

export class GraphMailClientError extends Error {
  constructor(readonly code: GraphMailClientErrorCode, providerDetail?: string) {
    super(providerDetail ?? 'Graph mail operation failed.');
    this.name = 'GraphMailClientError';
  }
}

export interface GraphMailClient {
  submit(message: GraphOutboundMessage): Promise<
    | { readonly accepted: true; readonly id: string | null }
    | { readonly accepted: false }
  >;
  readMailboxPage(checkpoint: string | null): Promise<GraphMailboxPage>;
}

export class GraphCustomerMailBoundary implements CustomerOutboundMail, CustomerMailboxChanges {
  constructor(private readonly client: GraphMailClient) {}

  isConfigured(): boolean {
    return true;
  }

  async submit(message: OutboundCustomerMessage): Promise<MailSubmissionResult> {
    const outbound = toGraphMessage(message);
    try {
      const accepted = await this.client.submit(outbound);
      return accepted.accepted
        ? Object.freeze({ acceptance: 'ACCEPTED', messageReference: accepted.id })
        : Object.freeze({ acceptance: 'REJECTED', messageReference: null });
    } catch (error) {
      throw normalizeGraphError(error);
    }
  }

  async readChanges(checkpoint: string | null): Promise<CustomerMailboxChangePage> {
    try {
      const page = await this.client.readMailboxPage(checkpoint);
      return Object.freeze({
        changes: Object.freeze(page.value.map(normalizeMailboxChange)),
        nextPageCursor: page.nextCheckpoint,
        checkpointCursor: page.completedCheckpoint,
      });
    } catch (error) {
      throw normalizeGraphError(error);
    }
  }
}

function toGraphMessage(message: OutboundCustomerMessage): GraphOutboundMessage {
  return Object.freeze({
    toRecipients: Object.freeze([Object.freeze({ emailAddress: Object.freeze({ address: message.recipientAddress }) })]),
    subject: message.subject,
    body: Object.freeze({
      contentType: message.htmlContent ? 'HTML' : 'Text',
      content: message.htmlContent ?? message.textContent,
    }),
  });
}

function normalizeMailboxChange(message: GraphMailboxMessage): CustomerMailboxChange {
  const inReplyTo = message.internetMessageHeaders?.find(
    ({ name }) => name.toLowerCase() === 'in-reply-to',
  )?.value ?? null;
  return Object.freeze({
    changeType: message['@removed'] === undefined ? 'UPSERTED' : 'DELETED',
    messageReference: message.id,
    internetMessageId: message.internetMessageId ?? null,
    inReplyTo,
    senderAddress: message.from?.emailAddress?.address ?? null,
    subject: message.subject ?? null,
    textContent: message.body?.content ?? null,
    receivedAt: message.receivedDateTime ?? null,
  });
}

function normalizeGraphError(error: unknown): CustomerMailBoundaryError {
  if (!(error instanceof GraphMailClientError)) {
    return new CustomerMailBoundaryError('TEMPORARY_FAILURE');
  }
  const codes: Record<GraphMailClientErrorCode, CustomerMailErrorCode> = {
    CONFIGURATION: 'CONFIGURATION_ERROR',
    AUTHENTICATION: 'AUTHENTICATION_ERROR',
    REJECTED: 'SUBMISSION_REJECTED',
    THROTTLED: 'THROTTLED',
    INVALID_CURSOR: 'INVALID_CURSOR',
    TEMPORARY: 'TEMPORARY_FAILURE',
    UNKNOWN_OUTCOME: 'OUTCOME_UNKNOWN',
  };
  return new CustomerMailBoundaryError(codes[error.code]);
}
