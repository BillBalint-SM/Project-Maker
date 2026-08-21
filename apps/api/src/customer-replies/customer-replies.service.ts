import { randomUUID } from 'node:crypto';

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CustomerCorrespondenceCommand,
  CustomerCorrespondenceStatus,
  CustomerCorrespondenceView,
  CustomerInboundMessageClassification,
  CustomerReplySenderClassification,
  CustomerReplySummary,
  ProjectCustomerCorrespondenceWork,
} from '@project-maker/contracts';
import { DataSource, type EntityManager } from 'typeorm';

interface CorrespondenceRow {
  id: string;
  predecessor_id: string | null;
  status: CustomerCorrespondenceStatus;
  unread_message_count: number;
  processing_version: number;
  source_type: 'INTERVIEW_HANDOFF' | 'CUSTOMER_FOLLOW_UP_PING' | 'CUSTOMER_RESPONSE_REQUEST';
  source_id: string;
  handoff_round_id: string | null;
  handoff_version: number | null;
  handoff_state: 'DRAFT' | 'SENDING' | 'SENT' | 'FAILED' | 'UNKNOWN' | null;
  ping_state: 'SENDING' | 'SENT' | 'FAILED' | 'UNKNOWN' | null;
  response_state: 'OPEN' | 'SUBMITTED' | 'REVOKED' | null;
  response_delivery_state: 'SENDING' | 'SENT' | 'FAILED' | 'UNKNOWN' | null;
  source_follow_up_id: string | null;
  source_follow_up_version: number | null;
  unknown_delivery_receipt_evidence: boolean;
}

interface MessageRow {
  id: string;
  provider_message_reference: string;
  internet_message_id: string | null;
  received_at: Date;
  sender_address: string | null;
  sender_classification: CustomerReplySenderClassification;
  recipient_addresses: string[];
  subject: string | null;
  text_content: string;
  visible_text: string;
  quoted_text: string | null;
  attachment_count: number;
  attachments: Array<{ name: string; contentType: string; size: number }>;
  correlation_evidence: 'TOKENIZED_REPLY_TO' | 'MANUAL_TRIAGE';
  correspondence_id: string;
  classification: CustomerInboundMessageClassification | null;
}

const linkedTriageJoin = `LEFT JOIN "customer_mail_triage" triage
  ON triage."message_id" = message."id" AND triage."state" = 'LINKED'`;
const effectiveCorrespondenceId = 'COALESCE(triage."correspondence_id", message."correspondence_id")';
const effectiveProjectId = 'COALESCE(triage."project_id", message."project_id")';

@Injectable()
export class CustomerRepliesService {
  constructor(private readonly dataSource: DataSource) {}

  async summary(): Promise<CustomerReplySummary> {
    const projects = await this.dataSource.query(
      `SELECT "project_id", SUM("unread_message_count")::integer AS "new_reply_count"
       FROM "customer_correspondences"
       GROUP BY "project_id"
       HAVING SUM("unread_message_count") > 0
       ORDER BY "project_id"`,
    ) as Array<{ project_id: string; new_reply_count: number }>;
    return {
      newReplyCount: projects.reduce((sum, project) => sum + project.new_reply_count, 0),
      projectCount: projects.length,
      projects: projects.map((project) => ({
        projectId: project.project_id,
        newReplyCount: project.new_reply_count,
      })),
    };
  }

  async forProject(projectId: string): Promise<ProjectCustomerCorrespondenceWork> {
    const project = await this.dataSource.query(
      'SELECT "id", "status" FROM "projects" WHERE "id" = $1',
      [projectId],
    ) as Array<{ id: string; status: string }>;
    if (project.length === 0) throw new NotFoundException('Project not found.');
    const correspondences = await this.dataSource.query(
      `SELECT correspondence."id", correspondence."predecessor_id", correspondence."status",
              correspondence."unread_message_count", correspondence."processing_version",
              correspondence."source_follow_up_id", correspondence."source_follow_up_version",
              outbound."source_type", outbound."source_id",
              handoff."round_id" AS "handoff_round_id", handoff."version" AS "handoff_version",
              handoff."state" AS "handoff_state", ping."state" AS "ping_state",
              response_request."state" AS "response_state",
              response_request."delivery_state" AS "response_delivery_state",
              (
                EXISTS (
                  SELECT 1 FROM "customer_outbound_attempts" attempt
                  WHERE attempt."outbound_communication_id" = correspondence."outbound_communication_id"
                    AND attempt."result" = 'UNKNOWN'
                )
                AND EXISTS (
                  SELECT 1 FROM "customer_inbound_messages" message
                  ${linkedTriageJoin}
                  WHERE ${effectiveCorrespondenceId} = correspondence."id"
                )
              ) AS "unknown_delivery_receipt_evidence"
       FROM "customer_correspondences" correspondence
       JOIN "customer_outbound_communications" outbound
         ON outbound."id" = correspondence."outbound_communication_id"
       LEFT JOIN "interview_customer_handoffs" handoff
         ON outbound."source_type" = 'INTERVIEW_HANDOFF' AND handoff."id" = outbound."source_id"
       LEFT JOIN "customer_follow_up_delivery_attempts" ping
         ON outbound."source_type" = 'CUSTOMER_FOLLOW_UP_PING' AND ping."id" = outbound."source_id"
       LEFT JOIN "customer_response_requests" response_request
         ON outbound."source_type" = 'CUSTOMER_RESPONSE_REQUEST' AND response_request."id" = outbound."source_id"
       WHERE correspondence."project_id" = $1
       ORDER BY correspondence."created_at", correspondence."id"`,
      [projectId],
    ) as CorrespondenceRow[];
    const messages = await this.dataSource.query(
      `SELECT "id", "provider_message_reference", "internet_message_id", "received_at",
              "sender_address", "sender_classification", "recipient_addresses", "subject",
              "text_content", "visible_text", "quoted_text", "attachment_count", "attachments",
              CASE WHEN triage."state" = 'LINKED' THEN 'MANUAL_TRIAGE'
                   ELSE "correlation_evidence" END AS "correlation_evidence",
              COALESCE(triage."correspondence_id", message."correspondence_id") AS "correspondence_id",
              processing."classification"
       FROM "customer_inbound_messages" message
       LEFT JOIN "customer_inbound_message_processing" processing ON processing."message_id" = message."id"
       ${linkedTriageJoin}
       WHERE ${effectiveProjectId} = $1
       ORDER BY "received_at", "provider_message_reference"`,
      [projectId],
    ) as MessageRow[];
    return {
      newReplyCount: correspondences.reduce((sum, row) => sum + row.unread_message_count, 0),
      projectArchived: project[0]?.status === 'ARCHIVED',
      correspondences: correspondences.map((row) => toCorrespondence(
        row,
        messages.filter((message) => message.correspondence_id === row.id).map(toMessage),
      )),
    };
  }

  async command(
    projectId: string,
    correspondenceId: string,
    input: CustomerCorrespondenceCommand,
  ): Promise<CustomerCorrespondenceView> {
    await this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT correspondence."id", correspondence."status", correspondence."unread_message_count",
                correspondence."processing_version", project."status" AS "project_status"
         FROM "customer_correspondences" correspondence
         JOIN "projects" project ON project."id" = correspondence."project_id"
         WHERE correspondence."id" = $1 AND correspondence."project_id" = $2
         FOR UPDATE OF correspondence`,
        [correspondenceId, projectId],
      ) as Array<CorrespondenceRow & { project_status: string }>;
      const current = rows[0];
      if (!current) throw new NotFoundException('Customer correspondence not found.');
      if (current.project_status === 'ARCHIVED') {
        throw new ConflictException('Archived projects cannot process Customer correspondence.');
      }
      if (input.command === 'MARK_REVIEWED' && current.unread_message_count === 0) return;
      if (current.processing_version !== input.expectedVersion) {
        throw new ConflictException('Customer correspondence has changed.');
      }
      if (input.command === 'MARK_REVIEWED') {
        await updateCorrespondence(manager, correspondenceId, current.status, 0);
        await audit(manager, projectId, 'CUSTOMER_CORRESPONDENCE_REVIEWED', { correspondenceId });
        return;
      }
      if (input.command === 'SET_STATUS') {
        requireStatusTransition(current.status, input.status);
        if (current.status === input.status) return;
        if (input.status === 'Lezárva') {
          await requireEveryInboundMessageClassified(manager, correspondenceId);
        }
        await updateCorrespondence(manager, correspondenceId, input.status, current.unread_message_count);
        await audit(manager, projectId, 'CUSTOMER_CORRESPONDENCE_STATUS_CHANGED', {
          correspondenceId,
          status: input.status,
        });
        return;
      }
      const message = await manager.query(
        `SELECT message."id" FROM "customer_inbound_messages" message
         ${linkedTriageJoin}
         WHERE message."id" = $1
           AND ${effectiveCorrespondenceId} = $2
           AND ${effectiveProjectId} = $3`,
        [input.messageId, correspondenceId, projectId],
      ) as Array<{ id: string }>;
      if (!message[0]) throw new NotFoundException('Customer inbound message not found.');
      if (input.closeCorrespondence && input.classification !== 'Elfogadva') {
        throw new BadRequestException('Only an accepted reply may close the correspondence while classifying.');
      }
      await manager.query(
        `INSERT INTO "customer_inbound_message_processing" ("message_id", "classification")
         VALUES ($1, $2)
         ON CONFLICT ("message_id") DO UPDATE
         SET "classification" = EXCLUDED."classification", "updated_at" = CURRENT_TIMESTAMP`,
        [input.messageId, input.classification],
      );
      if (input.closeCorrespondence) {
        await requireEveryInboundMessageClassified(manager, correspondenceId);
      }
      const nextStatus = input.closeCorrespondence ? 'Lezárva' : current.status;
      await updateCorrespondence(manager, correspondenceId, nextStatus, current.unread_message_count);
      await audit(manager, projectId, 'CUSTOMER_INBOUND_MESSAGE_CLASSIFIED', {
        correspondenceId,
        messageId: input.messageId,
        classification: input.classification,
        correspondenceClosed: String(Boolean(input.closeCorrespondence)),
      });
    });
    const view = await this.forProject(projectId);
    const correspondence = view.correspondences.find((item) => item.id === correspondenceId);
    if (!correspondence) throw new NotFoundException('Customer correspondence not found.');
    return correspondence;
  }
}

async function requireEveryInboundMessageClassified(
  manager: EntityManager,
  correspondenceId: string,
): Promise<void> {
  const rows = await manager.query(
    `SELECT COUNT(*)::integer AS "count"
     FROM "customer_inbound_messages" message
     LEFT JOIN "customer_inbound_message_processing" processing ON processing."message_id" = message."id"
     ${linkedTriageJoin}
     WHERE ${effectiveCorrespondenceId} = $1
       AND processing."message_id" IS NULL`,
    [correspondenceId],
  ) as Array<{ count: number }>;
  if ((rows[0]?.count ?? 0) > 0) {
    throw new ConflictException('Every Customer reply must be classified before closing the correspondence.');
  }
}

async function updateCorrespondence(
  manager: EntityManager,
  correspondenceId: string,
  status: CustomerCorrespondenceStatus,
  unreadMessageCount: number,
): Promise<void> {
  await manager.query(
    `UPDATE "customer_correspondences"
     SET "status" = $2, "unread_message_count" = $3,
         "processing_version" = "processing_version" + 1
     WHERE "id" = $1`,
    [correspondenceId, status, unreadMessageCount],
  );
}

function requireStatusTransition(
  current: CustomerCorrespondenceStatus,
  next: CustomerCorrespondenceStatus,
): void {
  if (next === current) return;
  const allowed: Readonly<Record<CustomerCorrespondenceStatus, readonly CustomerCorrespondenceStatus[]>> = {
    'Válaszra vár': ['Lezárva'],
    'Új válasz': ['Feldolgozás alatt', 'Lezárva'],
    'Feldolgozás alatt': ['Lezárva'],
    'Lezárva': ['Feldolgozás alatt'],
  };
  if (!allowed[current].includes(next)) {
    throw new ConflictException('Invalid Customer correspondence status transition.');
  }
}

async function audit(
  manager: EntityManager,
  projectId: string,
  eventType: string,
  payload: Readonly<Record<string, string>>,
): Promise<void> {
  await manager.query(
    `INSERT INTO "audit_events" ("id", "project_id", "event_type", "payload")
     VALUES ($1, $2, $3, $4::jsonb)`,
    [randomUUID(), projectId, eventType, JSON.stringify(payload)],
  );
}

function toMessage(row: MessageRow) {
  return {
    id: row.id,
    providerMessageReference: row.provider_message_reference,
    internetMessageId: row.internet_message_id,
    receivedAt: row.received_at.toISOString(),
    senderAddress: row.sender_address,
    senderClassification: row.sender_classification,
    recipientAddresses: row.recipient_addresses,
    subject: row.subject,
    textContent: row.text_content,
    visibleText: row.visible_text,
    quotedText: row.quoted_text,
    attachmentCount: row.attachment_count,
    attachments: row.attachments,
    correlationEvidence: row.correlation_evidence,
    classification: row.classification,
  };
}

function toCorrespondence(
  row: CorrespondenceRow,
  messages: ReturnType<typeof toMessage>[],
): CustomerCorrespondenceView {
  if (row.source_type === 'INTERVIEW_HANDOFF') {
    if (!row.handoff_round_id || row.handoff_version === null || row.handoff_state === null) {
      throw new ConflictException('Customer correspondence handoff source is incomplete.');
    }
    return {
      id: row.id,
      predecessorId: row.predecessor_id,
      status: row.status,
      unreadMessageCount: row.unread_message_count,
      processingVersion: row.processing_version,
      source: {
        type: row.source_type,
        roundId: row.handoff_round_id,
        handoffId: row.source_id,
        version: row.handoff_version,
        state: row.handoff_state,
      },
      unknownDeliveryReceiptEvidence: row.unknown_delivery_receipt_evidence,
      messages,
    };
  }
  if (row.source_type === 'CUSTOMER_RESPONSE_REQUEST') {
    if (row.response_state === null || row.response_delivery_state === null) {
      throw new ConflictException('Customer correspondence response-request source is incomplete.');
    }
    return {
      id: row.id,
      predecessorId: row.predecessor_id,
      status: row.status,
      unreadMessageCount: row.unread_message_count,
      processingVersion: row.processing_version,
      source: {
        type: row.source_type,
        requestId: row.source_id,
        state: row.response_state,
        deliveryState: row.response_delivery_state,
      },
      unknownDeliveryReceiptEvidence: row.unknown_delivery_receipt_evidence,
      messages,
    };
  }
  if (row.ping_state === null) {
    throw new ConflictException('Customer correspondence ping source is incomplete.');
  }
  return {
    id: row.id,
    predecessorId: row.predecessor_id,
    status: row.status,
    unreadMessageCount: row.unread_message_count,
    processingVersion: row.processing_version,
    source: {
      type: row.source_type,
      attemptId: row.source_id,
      state: row.ping_state,
      followUpId: row.source_follow_up_id,
      followUpVersion: row.source_follow_up_version,
    },
    unknownDeliveryReceiptEvidence: row.unknown_delivery_receipt_evidence,
    messages,
  };
}
