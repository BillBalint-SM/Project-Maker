import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CustomerMailTriageCommand,
  CustomerMailTriageCommandResult,
  CustomerMailTriageTargetView,
  CustomerMailTriageView,
  MailSystemEventView,
  UnmatchedCustomerMessageView,
} from '@project-maker/contracts';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';

interface UnmatchedMessageRow {
  kind: UnmatchedCustomerMessageView['kind'];
  id: string;
  provider_message_reference: string;
  received_at: Date;
  sender_address: string | null;
  subject: string | null;
  visible_text: string;
  quoted_text: string | null;
  attachment_count: number;
  attachments: UnmatchedCustomerMessageView['attachments'];
  version: number;
}

interface MailSystemEventRow {
  id: string;
  provider_message_reference: string;
  type: MailSystemEventView['type'];
  occurred_at: Date;
  project_id: string | null;
  correspondence_id: string | null;
}

interface TriageTargetRow {
  project_id: string;
  project_name: string;
  correspondence_id: string;
  created_at: Date;
}

@Injectable()
export class CustomerMailTriageService {
  constructor(private readonly dataSource: DataSource) {}

  async view(): Promise<CustomerMailTriageView> {
    const messages = await this.dataSource.query(
      `SELECT "id", "provider_message_reference", "received_at", "sender_address",
              "subject", "visible_text", "quoted_text", "attachment_count", "attachments",
              triage."kind", triage."version"
       FROM "customer_inbound_messages" message
       JOIN "customer_mail_triage" triage ON triage."message_id" = message."id"
       WHERE triage."state" = 'OPEN'
       ORDER BY "received_at", "provider_message_reference"`,
    ) as UnmatchedMessageRow[];
    const events = await this.dataSource.query(
      `SELECT "id", "provider_message_reference", "type", "occurred_at",
              "project_id", "correspondence_id"
       FROM "customer_mail_system_events"
       ORDER BY "occurred_at" DESC, "provider_message_reference"`,
    ) as MailSystemEventRow[];
    const targets = await this.dataSource.query(
      `SELECT project."id" AS "project_id", project."name" AS "project_name",
              correspondence."id" AS "correspondence_id", correspondence."created_at"
       FROM "customer_correspondences" correspondence
       JOIN "projects" project ON project."id" = correspondence."project_id"
       WHERE project."status" <> 'ARCHIVED'
       ORDER BY project."name", correspondence."created_at" DESC`,
    ) as TriageTargetRow[];
    return {
      unmatchedMessages: messages.map(toUnmatchedMessage),
      mailSystemEvents: events.map((event) => ({
        id: event.id,
        providerMessageReference: event.provider_message_reference,
        type: event.type,
        occurredAt: event.occurred_at.toISOString(),
        projectId: event.project_id,
        correspondenceId: event.correspondence_id,
      })),
      eligibleCorrespondences: targets.map(toTriageTarget),
    };
  }

  async command(
    messageId: string,
    input: CustomerMailTriageCommand,
  ): Promise<CustomerMailTriageCommandResult> {
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT triage."message_id", triage."state", triage."version",
                triage."project_id", triage."correspondence_id"
         FROM "customer_mail_triage" triage
         WHERE triage."message_id" = $1
         FOR UPDATE OF triage`,
        [messageId],
      ) as Array<{
        message_id: string;
        state: 'OPEN' | 'LINKED' | 'DISMISSED';
        version: number;
        project_id: string | null;
        correspondence_id: string | null;
      }>;
      const current = rows[0];
      if (!current) throw new NotFoundException('Unmatched Customer message not found.');
      if (
        input.command === 'LINK' &&
        current.state === 'LINKED' &&
        current.correspondence_id === input.correspondenceId
      ) {
        return toCommandResult(current);
      }
      if (input.command === 'DISMISS' && current.state === 'DISMISSED') {
        return toCommandResult(current);
      }
      if (current.state !== 'OPEN') {
        throw new ConflictException('Unmatched Customer message has already been triaged.');
      }
      if (current.version !== input.expectedVersion) {
        throw new ConflictException('Unmatched Customer message has changed.');
      }
      if (input.command === 'DISMISS') {
        const updated = await resolveTriage(
          manager,
          current.message_id,
          current.version,
          'DISMISSED',
          null,
          null,
        );
        await recordAction(manager, current.message_id, 'DISMISS', null, null);
        return toCommandResult(updated);
      }
      const targets = await manager.query(
        `SELECT correspondence."id", correspondence."project_id"
         FROM "customer_correspondences" correspondence
         JOIN "projects" project ON project."id" = correspondence."project_id"
         WHERE correspondence."id" = $1 AND project."status" <> 'ARCHIVED'`,
        [input.correspondenceId],
      ) as Array<{ id: string; project_id: string }>;
      const target = targets[0];
      if (!target) throw new NotFoundException('Customer correspondence not found.');
      const updated = await resolveTriage(
        manager,
        current.message_id,
        current.version,
        'LINKED',
        target.project_id,
        target.id,
      );
      await manager.query(
        `UPDATE "customer_correspondences"
         SET "status" = 'Új válasz',
             "unread_message_count" = "unread_message_count" + 1,
             "processing_version" = "processing_version" + 1
         WHERE "id" = $1`,
        [target.id],
      );
      await recordAction(manager, current.message_id, 'LINK', target.project_id, target.id);
      await manager.query(
        `INSERT INTO "audit_events" ("id", "project_id", "event_type", "payload")
         VALUES ($1, $2, 'CUSTOMER_UNMATCHED_MESSAGE_LINKED', $3::jsonb)`,
        [
          randomUUID(),
          target.project_id,
          JSON.stringify({ messageId: current.message_id, correspondenceId: target.id }),
        ],
      );
      return toCommandResult(updated);
    });
  }
}

function toTriageTarget(row: TriageTargetRow): CustomerMailTriageTargetView {
  return {
    projectId: row.project_id,
    projectName: row.project_name,
    correspondenceId: row.correspondence_id,
    createdAt: row.created_at.toISOString(),
  };
}

async function resolveTriage(
  manager: import('typeorm').EntityManager,
  messageId: string,
  currentVersion: number,
  state: 'LINKED' | 'DISMISSED',
  projectId: string | null,
  correspondenceId: string | null,
) {
  await manager.query(
    `UPDATE "customer_mail_triage"
     SET "state" = $2, "version" = "version" + 1, "project_id" = $3,
         "correspondence_id" = $4, "resolved_at" = CURRENT_TIMESTAMP,
         "updated_at" = CURRENT_TIMESTAMP
     WHERE "message_id" = $1`,
    [messageId, state, projectId, correspondenceId],
  );
  return {
    message_id: messageId,
    state,
    version: currentVersion + 1,
    project_id: projectId,
    correspondence_id: correspondenceId,
  };
}

async function recordAction(
  manager: import('typeorm').EntityManager,
  messageId: string,
  command: 'LINK' | 'DISMISS',
  projectId: string | null,
  correspondenceId: string | null,
): Promise<void> {
  await manager.query(
    `INSERT INTO "customer_mail_triage_actions"
       ("id", "message_id", "command", "project_id", "correspondence_id")
     VALUES ($1, $2, $3, $4, $5)`,
    [randomUUID(), messageId, command, projectId, correspondenceId],
  );
}

function toCommandResult(row: {
  message_id: string;
  state: 'OPEN' | 'LINKED' | 'DISMISSED';
  version: number;
  project_id: string | null;
  correspondence_id: string | null;
}): CustomerMailTriageCommandResult {
  if (row.state === 'OPEN') throw new Error('Open triage cannot be returned as a command result.');
  return {
    messageId: row.message_id,
    state: row.state,
    version: row.version,
    projectId: row.project_id,
    correspondenceId: row.correspondence_id,
  };
}

function toUnmatchedMessage(row: UnmatchedMessageRow): UnmatchedCustomerMessageView {
  return {
    kind: row.kind,
    id: row.id,
    providerMessageReference: row.provider_message_reference,
    receivedAt: row.received_at.toISOString(),
    senderAddress: row.sender_address,
    subject: row.subject,
    visibleText: row.visible_text,
    quotedText: row.quoted_text,
    attachmentCount: row.attachment_count,
    attachments: row.attachments,
    version: row.version,
  };
}
