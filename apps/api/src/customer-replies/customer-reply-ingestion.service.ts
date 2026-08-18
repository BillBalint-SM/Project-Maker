import { Injectable } from '@nestjs/common';
import type { CustomerMailboxChange } from '@project-maker/contracts';
import { createHash, randomUUID } from 'node:crypto';
import type { EntityManager } from 'typeorm';

interface CorrelationRow {
  correspondence_id: string;
  project_id: string;
  customer_contact_email: string;
}

@Injectable()
export class CustomerReplyIngestionService {
  async ingest(
    manager: EntityManager,
    mailboxAddress: string,
    changes: readonly CustomerMailboxChange[],
    observedAt: Date,
  ): Promise<void> {
    for (const change of changes) {
      if (change.changeType !== 'UPSERTED') continue;
      await retainMailboxChange(manager, mailboxAddress, change, observedAt);
      await retainInboundMessage(manager, mailboxAddress, change, observedAt);
    }
  }
}

async function retainMailboxChange(
  manager: EntityManager,
  mailboxAddress: string,
  change: CustomerMailboxChange,
  observedAt: Date,
): Promise<void> {
  await manager.query(
    `INSERT INTO "customer_mailbox_change_inbox" (
       "mailbox_address", "message_reference", "internet_message_id", "in_reply_to",
       "sender_address", "recipient_addresses", "subject", "text_content", "received_at",
       "attachment_count", "attachments", "observed_at"
     ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10, $11::jsonb, $12)
     ON CONFLICT ("mailbox_address", "message_reference") DO NOTHING`,
    [
      mailboxAddress,
      change.messageReference,
      change.internetMessageId,
      change.inReplyTo,
      change.senderAddress,
      JSON.stringify(change.recipientAddresses),
      change.subject,
      change.textContent,
      change.receivedAt,
      change.attachmentCount,
      JSON.stringify(change.attachments),
      observedAt,
    ],
  );
}

async function retainInboundMessage(
  manager: EntityManager,
  mailboxAddress: string,
  change: CustomerMailboxChange,
  observedAt: Date,
): Promise<void> {
  const correlation = await correlate(manager, mailboxAddress, change.recipientAddresses);
  const text = normalizeText(change.textContent);
  const { visibleText, quotedText } = splitQuotedHistory(text);
  const senderClassification = correlation && change.senderAddress?.toLowerCase() === correlation.customer_contact_email.toLowerCase()
    ? 'CUSTOMER_CONTACT'
    : 'UNRECOGNIZED';
  const inserted = await manager.query(
    `INSERT INTO "customer_inbound_messages" (
       "id", "mailbox_address", "provider_message_reference", "internet_message_id",
       "correspondence_id", "project_id", "correlation_state", "correlation_evidence",
       "sender_address", "sender_classification", "recipient_addresses", "subject",
       "text_content", "visible_text", "quoted_text", "received_at",
       "attachment_count", "attachments"
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12,
       $13, $14, $15, $16, $17, $18::jsonb
     )
     ON CONFLICT ("mailbox_address", "provider_message_reference") DO NOTHING
     RETURNING "id"`,
    [
      randomUUID(),
      mailboxAddress,
      change.messageReference,
      change.internetMessageId,
      correlation?.correspondence_id ?? null,
      correlation?.project_id ?? null,
      correlation ? 'MATCHED' : 'UNMATCHED',
      correlation ? 'TOKENIZED_REPLY_TO' : 'NO_VALID_REPLY_TOKEN',
      change.senderAddress,
      senderClassification,
      JSON.stringify(change.recipientAddresses),
      change.subject,
      text,
      visibleText,
      quotedText,
      parseReceivedAt(change.receivedAt, observedAt),
      change.attachmentCount,
      JSON.stringify(change.attachments),
    ],
  ) as Array<{ id: string }>;
  if (inserted.length === 0 || !correlation) return;
  await manager.query(
    `UPDATE "customer_correspondences"
          SET "status" = 'Új válasz',
              "unread_message_count" = "unread_message_count" + 1,
              "processing_version" = "processing_version" + 1
     WHERE "id" = $1`,
    [correlation.correspondence_id],
  );
}

async function correlate(
  manager: EntityManager,
  mailboxAddress: string,
  recipientAddresses: readonly string[],
): Promise<CorrelationRow | null> {
  const tokenDigests = recipientAddresses
    .map((address) => replyToken(address, mailboxAddress))
    .filter((token): token is string => token !== null)
    .map((token) => createHash('sha256').update(token).digest('hex'));
  if (tokenDigests.length === 0) return null;
  const matches = await manager.query(
    `SELECT correspondence."id" AS "correspondence_id",
            correspondence."project_id" AS "project_id",
            project."customer_contact_email"
     FROM "customer_outbound_communications" outbound
     JOIN "customer_correspondences" correspondence
       ON correspondence."outbound_communication_id" = outbound."id"
     JOIN "projects" project ON project."id" = correspondence."project_id"
     WHERE outbound."reply_token_hash" = ANY($1::varchar[])`,
    [tokenDigests],
  ) as CorrelationRow[];
  return matches.length === 1 ? matches[0] ?? null : null;
}

function replyToken(recipientAddress: string, mailboxAddress: string): string | null {
  const mailboxSeparator = mailboxAddress.lastIndexOf('@');
  const recipientSeparator = recipientAddress.lastIndexOf('@');
  if (mailboxSeparator <= 0 || recipientSeparator <= 0) return null;
  const mailboxLocal = mailboxAddress.slice(0, mailboxSeparator).toLowerCase();
  const mailboxDomain = mailboxAddress.slice(mailboxSeparator + 1).toLowerCase();
  const recipientLocal = recipientAddress.slice(0, recipientSeparator);
  const recipientDomain = recipientAddress.slice(recipientSeparator + 1).toLowerCase();
  const prefix = `${mailboxLocal}+`;
  if (!recipientLocal.toLowerCase().startsWith(prefix) || recipientDomain !== mailboxDomain) return null;
  const token = recipientLocal.slice(prefix.length);
  return /^(?:[A-Za-z0-9_-]{43}|[a-f0-9]{48})$/.test(token) ? token : null;
}

function normalizeText(value: string | null): string {
  return value?.replace(/\r\n?/g, '\n').trim() ?? '';
}

function splitQuotedHistory(text: string): { visibleText: string; quotedText: string | null } {
  const match = /^(On .+ wrote:|From:|Feladó:)$/imu.exec(text);
  if (!match || match.index === undefined) return { visibleText: text, quotedText: null };
  return {
    visibleText: text.slice(0, match.index).trim(),
    quotedText: text.slice(match.index).trim(),
  };
}

function parseReceivedAt(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}
