import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CustomerMailboxAttachmentMetadata,
  CustomerMailboxChange,
  CustomerMailboxChangePage,
  CustomerMailboxCheckpoint,
} from '@project-maker/contracts';

import {
  createMailGatewayConfiguration,
  type MailGatewayConfiguration,
} from '../config/mail-gateway.config';
import {
  CustomerMailBoundaryError,
  type CustomerMailboxChanges,
} from './customer-mail-boundary';
import {
  MailGatewayCheckpointCodec,
  type MailGatewayCheckpointState,
} from './mail-gateway-checkpoint';

export const imapMailboxClientFactoryToken = 'IMAP_MAILBOX_CLIENT_FACTORY';

export interface ImapMailboxSearch {
  readonly fromUid: number;
  readonly toUid: number;
  readonly since: string | null;
}

export interface ImapMailboxRecord {
  readonly uid: number;
  readonly internetMessageId: string | null;
  readonly inReplyTo: string | null;
  readonly senderAddress: string | null;
  readonly recipientAddresses: readonly string[];
  readonly subject: string | null;
  readonly textContent: string | null;
  readonly receivedAt: string | null;
  readonly contentType: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly attachments: readonly CustomerMailboxAttachmentMetadata[];
}

export interface ImapMailboxClient {
  open(folder: string): Promise<{
    readonly uidValidity: string;
    readonly uidNext: number;
  }>;
  search(search: ImapMailboxSearch): Promise<readonly number[]>;
  fetch(uids: readonly number[]): Promise<readonly ImapMailboxRecord[]>;
  close(): Promise<void>;
}

export interface ImapMailboxClientFactory {
  create(configuration: MailGatewayConfiguration): ImapMailboxClient;
}

const pageSize = 25;
const maximumUid = 4_294_967_295;

@Injectable()
export class ImapCustomerMailboxChanges implements CustomerMailboxChanges {
  private readonly configuration: MailGatewayConfiguration | null;
  private readonly checkpointCodec: MailGatewayCheckpointCodec | null;

  constructor(
    config: ConfigService,
    @Inject(imapMailboxClientFactoryToken)
    private readonly clientFactory: ImapMailboxClientFactory,
  ) {
    this.configuration = createMailGatewayConfiguration(config);
    this.checkpointCodec = this.configuration ? new MailGatewayCheckpointCodec() : null;
  }

  isConfigured(): boolean {
    return this.configuration !== null && this.checkpointCodec !== null;
  }

  async readChanges(
    checkpoint: CustomerMailboxCheckpoint | null,
    recoverySince: string | null = null,
  ): Promise<CustomerMailboxChangePage> {
    const configuration = this.configuration;
    const checkpointCodec = this.checkpointCodec;
    if (!configuration || !checkpointCodec) {
      throw new CustomerMailBoundaryError('CONFIGURATION_ERROR');
    }
    requireRecoveryTimestamp(recoverySince);
    const client = this.clientFactory.create(configuration);
    try {
      const mailbox = await client.open(configuration.imap.folder);
      requireMailboxState(mailbox);
      if (!checkpoint && recoverySince === null) {
        return completedPage(checkpointCodec, {
          uidValidity: mailbox.uidValidity,
          nextUid: mailbox.uidNext,
          upperUid: null,
          recoverySince: null,
        });
      }

      const decoded = checkpoint
        ? checkpointCodec.decode(checkpoint.value)
        : {
            uidValidity: mailbox.uidValidity,
            nextUid: 1,
            upperUid: mailbox.uidNext - 1,
            recoverySince,
          };
      if (decoded.uidValidity !== mailbox.uidValidity) {
        throw new CustomerMailBoundaryError('INVALID_CURSOR');
      }
      const upperUid = decoded.upperUid ?? mailbox.uidNext - 1;
      if (upperUid < decoded.nextUid) {
        return completedPage(checkpointCodec, {
          uidValidity: decoded.uidValidity,
          nextUid: decoded.nextUid,
          upperUid: null,
          recoverySince: null,
        });
      }

      const matchingUids = normalizedUids(await client.search({
        fromUid: decoded.nextUid,
        toUid: upperUid,
        since: decoded.recoverySince,
      }), decoded.nextUid, upperUid);
      const pageUids = matchingUids.slice(0, pageSize);
      if (pageUids.length === 0) {
        return completedPage(checkpointCodec, {
          uidValidity: decoded.uidValidity,
          nextUid: upperUid + 1,
          upperUid: null,
          recoverySince: null,
        });
      }
      const records = [...await client.fetch(pageUids)]
        .filter(({ uid }) => pageUids.includes(uid))
        .sort((left, right) => left.uid - right.uid);
      const changes = Object.freeze(records.map((record) =>
        normalizeRecord(record, decoded.uidValidity),
      ));
      if (matchingUids.length > pageSize) {
        return Object.freeze({
          changes,
          nextPageCheckpoint: checkpointValue(checkpointCodec, {
            uidValidity: decoded.uidValidity,
            nextUid: pageUids[pageUids.length - 1]! + 1,
            upperUid,
            recoverySince: decoded.recoverySince,
          }),
          completedCheckpoint: null,
        });
      }
      return Object.freeze({
        changes,
        nextPageCheckpoint: null,
        completedCheckpoint: checkpointValue(checkpointCodec, {
          uidValidity: decoded.uidValidity,
          nextUid: upperUid + 1,
          upperUid: null,
          recoverySince: null,
        }),
      });
    } catch (error) {
      throw normalizeImapFailure(error);
    } finally {
      await client.close().catch(() => undefined);
    }
  }
}

function completedPage(
  codec: MailGatewayCheckpointCodec,
  state: MailGatewayCheckpointState,
): CustomerMailboxChangePage {
  return Object.freeze({
    changes: Object.freeze([]),
    nextPageCheckpoint: null,
    completedCheckpoint: checkpointValue(codec, state),
  });
}

function checkpointValue(
  codec: MailGatewayCheckpointCodec,
  state: MailGatewayCheckpointState,
): CustomerMailboxCheckpoint {
  return Object.freeze({ value: codec.encode(state) });
}

function normalizedUids(
  values: readonly number[],
  minimum: number,
  maximum: number,
): number[] {
  return [...new Set(values)]
    .filter((value) => Number.isInteger(value) && value >= minimum && value <= maximum)
    .sort((left, right) => left - right);
}

function normalizeRecord(
  record: ImapMailboxRecord,
  uidValidity: string,
): CustomerMailboxChange {
  const attachments = record.attachments.slice(0, 20).map((attachment) => Object.freeze({
    name: bounded(attachment.name, 255, 'Névtelen melléklet'),
    contentType: bounded(attachment.contentType, 255, 'application/octet-stream'),
    size: Number.isSafeInteger(attachment.size) && attachment.size >= 0
      ? attachment.size
      : 0,
  }));
  return Object.freeze({
    changeType: 'UPSERTED',
    automationKind: automationKind(record.contentType, record.headers),
    messageReference: `${uidValidity}:${record.uid}`,
    internetMessageId: record.internetMessageId,
    inReplyTo: record.inReplyTo,
    senderAddress: record.senderAddress,
    recipientAddresses: Object.freeze(uniqueAddresses(record.recipientAddresses)),
    subject: record.subject,
    textContent: record.textContent,
    receivedAt: record.receivedAt,
    attachmentCount: record.attachments.length,
    attachments: Object.freeze(attachments),
  });
}

function automationKind(
  contentType: string,
  headers: Readonly<Record<string, string>>,
): CustomerMailboxChange['automationKind'] {
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([name, value]) => [name.toLowerCase(), value.toLowerCase()]),
  );
  const normalizedContentType = contentType.toLowerCase();
  if (
    normalizedContentType.includes('delivery-status')
    || normalizedContentType.includes('report-type=delivery-status')
    || normalizedHeaders['x-failed-recipients'] !== undefined
  ) return 'DELIVERY_REPORT';
  const autoSubmitted = normalizedHeaders['auto-submitted']?.trim();
  if (
    autoSubmitted === 'auto-replied'
    || normalizedHeaders['x-autoreply'] !== undefined
    || normalizedHeaders['x-autorespond'] !== undefined
  ) return 'OUT_OF_OFFICE';
  if (autoSubmitted && autoSubmitted !== 'no') return 'UNKNOWN_AUTOMATION';
  return 'HUMAN';
}

function uniqueAddresses(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of values) {
    const address = raw.trim();
    const normalized = address.toLowerCase();
    if (!address || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(address);
  }
  return result;
}

function bounded(value: string, maximumLength: number, fallback: string): string {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized.slice(0, maximumLength) : fallback;
}

function requireMailboxState(value: { uidValidity: string; uidNext: number }): void {
  const validity = Number(value.uidValidity);
  if (
    !/^[1-9]\d{0,9}$/.test(value.uidValidity)
    || !Number.isSafeInteger(validity)
    || validity > maximumUid
    || !Number.isSafeInteger(value.uidNext)
    || value.uidNext < 1
    || value.uidNext > maximumUid + 1
  ) throw new CustomerMailBoundaryError('TEMPORARY_FAILURE');
}

function requireRecoveryTimestamp(value: string | null): void {
  if (value === null) return;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    throw new CustomerMailBoundaryError('INVALID_CURSOR');
  }
}

function normalizeImapFailure(error: unknown): CustomerMailBoundaryError {
  if (error instanceof CustomerMailBoundaryError) return error;
  if (
    typeof error === 'object'
    && error !== null
    && 'authenticationFailed' in error
    && error.authenticationFailed === true
  ) return new CustomerMailBoundaryError('AUTHENTICATION_ERROR');
  return new CustomerMailBoundaryError('TEMPORARY_FAILURE');
}
