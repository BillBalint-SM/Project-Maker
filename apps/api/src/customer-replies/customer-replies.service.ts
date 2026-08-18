import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  CustomerCorrespondenceStatus,
  CustomerReplySenderClassification,
  CustomerReplySummary,
  ProjectCustomerCorrespondenceWork,
} from '@project-maker/contracts';
import { DataSource } from 'typeorm';

interface CorrespondenceRow {
  id: string;
  status: CustomerCorrespondenceStatus;
  unread_message_count: number;
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
  correlation_evidence: 'TOKENIZED_REPLY_TO';
  correspondence_id: string;
}

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
      'SELECT "id" FROM "projects" WHERE "id" = $1',
      [projectId],
    ) as Array<{ id: string }>;
    if (project.length === 0) throw new NotFoundException('Project not found.');
    const correspondences = await this.dataSource.query(
      `SELECT "id", "status", "unread_message_count"
       FROM "customer_correspondences"
       WHERE "project_id" = $1
       ORDER BY "created_at", "id"`,
      [projectId],
    ) as CorrespondenceRow[];
    const messages = await this.dataSource.query(
      `SELECT "id", "provider_message_reference", "internet_message_id", "received_at",
              "sender_address", "sender_classification", "recipient_addresses", "subject",
              "text_content", "visible_text", "quoted_text", "attachment_count", "attachments",
              "correlation_evidence", "correspondence_id"
       FROM "customer_inbound_messages"
       WHERE "project_id" = $1
       ORDER BY "received_at", "provider_message_reference"`,
      [projectId],
    ) as MessageRow[];
    return {
      newReplyCount: correspondences.reduce((sum, row) => sum + row.unread_message_count, 0),
      correspondences: correspondences.map((row) => ({
        id: row.id,
        status: row.status,
        unreadMessageCount: row.unread_message_count,
        messages: messages.filter((message) => message.correspondence_id === row.id).map(toMessage),
      })),
    };
  }
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
  };
}
