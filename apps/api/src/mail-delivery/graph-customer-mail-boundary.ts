import type {
  CustomerMailErrorCode,
  CustomerMailboxCheckpoint,
  CustomerMailboxChange,
  CustomerMailboxChangePage,
  MailSubmissionResult,
  OutboundCustomerMessage,
} from '@project-maker/contracts';
import { Inject, Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  CustomerMailBoundaryError,
  type CustomerMailboxChanges,
  type CustomerOutboundMail,
} from './customer-mail-boundary';

export { CustomerMailBoundaryError } from './customer-mail-boundary';

export interface GraphOutboundMessage {
  readonly senderAddress: string;
  readonly from: {
    readonly emailAddress: { readonly name: string; readonly address: string };
  };
  readonly toRecipients: readonly { readonly emailAddress: { readonly address: string } }[];
  readonly replyTo: readonly { readonly emailAddress: { readonly address: string } }[];
  readonly subject: string;
  readonly body: { readonly contentType: 'Text' | 'HTML'; readonly content: string };
  readonly saveToSentItems: true;
}

export interface GraphMailboxMessage {
  readonly id: string;
  readonly '@removed'?: unknown;
  readonly internetMessageId?: string | null;
  readonly internetMessageHeaders?: readonly { readonly name: string; readonly value: string }[];
  readonly from?: { readonly emailAddress?: { readonly address?: string | null } | null } | null;
  readonly toRecipients?: readonly GraphMailboxRecipient[] | null;
  readonly ccRecipients?: readonly GraphMailboxRecipient[] | null;
  readonly bccRecipients?: readonly GraphMailboxRecipient[] | null;
  readonly subject?: string | null;
  readonly body?: {
    readonly contentType?: 'text' | 'html' | null;
    readonly content?: string | null;
  } | null;
  readonly receivedDateTime?: string | null;
  readonly attachments?: readonly {
    readonly name?: string | null;
    readonly contentType?: string | null;
    readonly size?: number | null;
  }[] | null;
}

interface GraphMailboxRecipient {
  readonly emailAddress?: { readonly address?: string | null } | null;
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
  isConfigured(): boolean;
  submit(message: GraphOutboundMessage): Promise<
    | { readonly accepted: true; readonly id: string | null }
    | { readonly accepted: false }
  >;
  readMailboxPage(checkpoint: string | null): Promise<GraphMailboxPage>;
}

export const graphMailClientToken = 'GRAPH_MAIL_CLIENT';

@Injectable()
export class GraphCustomerMailBoundary implements CustomerOutboundMail, CustomerMailboxChanges {
  constructor(@Inject(graphMailClientToken) private readonly client: GraphMailClient, @Optional() private readonly config?: ConfigService) {}

  isConfigured(): boolean {
    return this.client.isConfigured();
  }

  async submit(message: OutboundCustomerMessage): Promise<MailSubmissionResult> {
    if (!this.isConfigured()) {
      throw new CustomerMailBoundaryError('CONFIGURATION_ERROR');
    }
    const outbound = toGraphMessage(message, this.config?.get<string>('CUSTOMER_MAILBOX_ADDRESS')?.trim());
    try {
      const accepted = await this.client.submit(outbound);
      return accepted.accepted
        ? Object.freeze({ acceptance: 'ACCEPTED', messageReference: accepted.id })
        : Object.freeze({ acceptance: 'REJECTED', messageReference: null });
    } catch (error) {
      throw normalizeGraphError(error);
    }
  }

  async readChanges(checkpoint: CustomerMailboxCheckpoint | null): Promise<CustomerMailboxChangePage> {
    if (!this.isConfigured()) {
      throw new CustomerMailBoundaryError('CONFIGURATION_ERROR');
    }
    try {
      const page = await this.client.readMailboxPage(checkpoint?.value ?? null);
      return Object.freeze({
        changes: Object.freeze(page.value.map(normalizeMailboxChange)),
        nextPageCheckpoint: toCheckpoint(page.nextCheckpoint),
        completedCheckpoint: toCheckpoint(page.completedCheckpoint),
      });
    } catch (error) {
      throw normalizeGraphError(error);
    }
  }
}

function toCheckpoint(value: string | null): CustomerMailboxCheckpoint | null {
  return value === null ? null : Object.freeze({ value });
}

function toGraphMessage(message: OutboundCustomerMessage, defaultMailbox?: string): GraphOutboundMessage {
  const senderAddress = message.senderAddress ?? defaultMailbox;
  const replyToAddress = message.replyToAddress ?? defaultMailbox;
  if (!senderAddress || !replyToAddress) {
    throw new CustomerMailBoundaryError('CONFIGURATION_ERROR');
  }
  return Object.freeze({
    senderAddress,
    from: Object.freeze({
      emailAddress: Object.freeze({
        name: message.senderName ?? senderAddress,
        address: senderAddress,
      }),
    }),
    toRecipients: Object.freeze([Object.freeze({ emailAddress: Object.freeze({ address: message.recipientAddress }) })]),
    replyTo: Object.freeze([Object.freeze({ emailAddress: Object.freeze({ address: replyToAddress }) })]),
    subject: message.subject,
    body: Object.freeze({
      contentType: message.htmlContent ? 'HTML' : 'Text',
      content: message.htmlContent ?? message.textContent,
    }),
    saveToSentItems: true,
  });
}

function normalizeMailboxChange(message: GraphMailboxMessage): CustomerMailboxChange {
  const inReplyTo = message.internetMessageHeaders?.find(
    ({ name }) => name.toLowerCase() === 'in-reply-to',
  )?.value ?? null;
  const recipientAddresses = uniqueAddresses([
    ...(message.toRecipients ?? []),
    ...(message.ccRecipients ?? []),
    ...(message.bccRecipients ?? []),
  ]);
  const attachmentCount = message.attachments?.length ?? 0;
  const attachments = (message.attachments ?? []).slice(0, 20).map((attachment) => ({
    name: boundedText(attachment.name, 255, 'Névtelen melléklet'),
    contentType: boundedText(attachment.contentType, 255, 'application/octet-stream'),
    size: Number.isSafeInteger(attachment.size) && (attachment.size ?? -1) >= 0
      ? attachment.size as number
      : 0,
  }));
  return Object.freeze({
    changeType: message['@removed'] === undefined ? 'UPSERTED' : 'DELETED',
    messageReference: message.id,
    internetMessageId: message.internetMessageId ?? null,
    inReplyTo,
    senderAddress: message.from?.emailAddress?.address ?? null,
    recipientAddresses: Object.freeze(recipientAddresses),
    subject: message.subject ?? null,
    textContent: normalizeBodyText(message.body),
    receivedAt: message.receivedDateTime ?? null,
    attachmentCount,
    attachments: Object.freeze(attachments.map((attachment) => Object.freeze(attachment))),
  });
}

function uniqueAddresses(recipients: readonly GraphMailboxRecipient[]): string[] {
  const seen = new Set<string>();
  const addresses: string[] = [];
  for (const recipient of recipients) {
    const address = recipient.emailAddress?.address?.trim();
    if (!address) continue;
    const normalized = address.toLowerCase();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    addresses.push(address);
  }
  return addresses;
}

function boundedText(value: string | null | undefined, maxLength: number, fallback: string): string {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : fallback;
}

function normalizeBodyText(body: GraphMailboxMessage['body']): string | null {
  if (!body?.content) return null;
  if (body.contentType === 'text') return body.content;
  if (body.contentType !== 'html') return null;
  return htmlToPlainText(body.content);
}

function htmlToPlainText(html: string): string {
  const withoutExecutableBlocks = html.replace(
    /<(script|style|template|head|svg)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
    '',
  );
  const withLineBreaks = withoutExecutableBlocks
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6])\s*>/gi, '\n');
  const withoutTags = withLineBreaks.replace(/<[^>]*>/g, '');
  return decodeHtmlEntities(withoutTags)
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[\t\f\v ]+/g, ' ').trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

function decodeHtmlEntities(value: string): string {
  const named: Readonly<Record<string, string>> = {
    amp: '&',
    apos: "'",
    gt: '>',
    lt: '<',
    nbsp: ' ',
    quot: '"',
  };
  return value.replace(/&(#(?:x[0-9a-f]+|[0-9]+)|[a-z]+);/gi, (entity, key: string) => {
    if (!key.startsWith('#')) return named[key.toLowerCase()] ?? entity;
    const hexadecimal = key[1]?.toLowerCase() === 'x';
    const codePoint = Number.parseInt(key.slice(hexadecimal ? 2 : 1), hexadecimal ? 16 : 10);
    if (!Number.isSafeInteger(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return entity;
    try {
      return String.fromCodePoint(codePoint);
    } catch {
      return entity;
    }
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
