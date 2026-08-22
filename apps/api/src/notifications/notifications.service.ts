import { Injectable } from '@nestjs/common';
import type { InternalNotification, NotificationList } from '@project-maker/contracts';
import { DataSource } from 'typeorm';

@Injectable()
export class NotificationsService {
  constructor(private readonly dataSource: DataSource) {}

  async list(): Promise<NotificationList> {
    const due = await this.dataSource.query(`
      SELECT project."id" AS "project_id", project."name" AS "project_name", project."due_date" AS "due_at"
      FROM "projects" project
      WHERE project."status" <> 'ARCHIVED' AND project."due_date" IS NOT NULL
        AND project."due_date" < (
          date_trunc('day', CURRENT_TIMESTAMP AT TIME ZONE 'Europe/Budapest') + interval '8 days'
        ) AT TIME ZONE 'Europe/Budapest'
    `) as Array<{ project_id: string; project_name: string; due_at: Date }>;
    const replies = await this.dataSource.query(`
      SELECT project."id" AS "project_id", project."name" AS "project_name",
             MIN(correspondence."created_at") AS "attention_at"
      FROM "customer_correspondences" correspondence
      JOIN "projects" project ON project."id" = correspondence."project_id"
      WHERE project."status" <> 'ARCHIVED' AND correspondence."unread_message_count" > 0
      GROUP BY project."id", project."name"
    `) as Array<{ project_id: string; project_name: string; attention_at: Date }>;
    const responses = await this.dataSource.query(`
      SELECT request."id" AS "source_id", project."id" AS "project_id", project."name" AS "project_name",
             submission."submitted_at" AS "attention_at"
      FROM "customer_response_submissions" submission
      JOIN "customer_response_requests" request ON request."id" = submission."request_id"
      JOIN "projects" project ON project."id" = request."project_id"
      WHERE project."status" <> 'ARCHIVED' AND submission."reviewed_at" IS NULL
    `) as Array<{ source_id: string; project_id: string; project_name: string; attention_at: Date }>;
    const failures = await this.dataSource.query(`
      SELECT * FROM (
        SELECT handoff."id" AS "source_id", 'INTERVIEW_HANDOFF' AS "source_type",
               project."id" AS "project_id", project."name" AS "project_name", handoff."attempted_at" AS "attention_at"
        FROM "interview_customer_handoffs" handoff
        JOIN "projects" project ON project."id" = handoff."project_id"
        WHERE project."status" <> 'ARCHIVED' AND handoff."state" IN ('FAILED', 'UNKNOWN')
        UNION ALL
        SELECT attempt."id", 'CUSTOMER_FOLLOW_UP_PING', project."id", project."name", attempt."attempted_at"
        FROM "customer_follow_up_delivery_attempts" attempt
        JOIN "projects" project ON project."id" = attempt."project_id"
        WHERE project."status" <> 'ARCHIVED' AND attempt."state" IN ('FAILED', 'UNKNOWN')
        UNION ALL
        SELECT request."id", 'CUSTOMER_RESPONSE_REQUEST', project."id", project."name", request."attempted_at"
        FROM "customer_response_requests" request
        JOIN "projects" project ON project."id" = request."project_id"
        WHERE project."status" <> 'ARCHIVED' AND request."delivery_state" IN ('FAILED', 'UNKNOWN')
      ) failed
    `) as Array<{
      source_id: string; source_type: string; project_id: string; project_name: string; attention_at: Date;
    }>;

    const now = Date.now();
    const items: InternalNotification[] = [
      ...due.map((row): InternalNotification => {
        const overdue = new Date(row.due_at).getTime() < now;
        return {
          key: `${overdue ? 'PROJECT_OVERDUE' : 'PROJECT_DUE'}:${row.project_id}`,
          kind: overdue ? 'PROJECT_OVERDUE' : 'PROJECT_DUE',
          severity: overdue ? 'CRITICAL' : 'UPCOMING',
          projectId: row.project_id,
          projectName: row.project_name,
          reason: overdue ? 'The next action is overdue.' : 'The next action is due within seven days.',
          attentionAt: new Date(row.due_at).toISOString(),
          actionUrl: `/projects/${row.project_id}/status`,
        };
      }),
      ...replies.map((row) => ({
        key: `CUSTOMER_REPLY:${row.project_id}`,
        kind: 'CUSTOMER_REPLY' as const,
        severity: 'ACTION_REQUIRED' as const,
        projectId: row.project_id,
        projectName: row.project_name,
        reason: 'A new Customer reply requires processing.',
        attentionAt: new Date(row.attention_at).toISOString(),
        actionUrl: `/projects/${row.project_id}/customer-correspondences`,
      })),
      ...responses.map((row) => ({
        key: `CUSTOMER_RESPONSE:${row.source_id}`,
        kind: 'CUSTOMER_RESPONSE' as const,
        severity: 'ACTION_REQUIRED' as const,
        projectId: row.project_id,
        projectName: row.project_name,
        reason: 'A new Customer clarification has been received and requires review.',
        attentionAt: new Date(row.attention_at).toISOString(),
        actionUrl: `/projects/${row.project_id}/customer-correspondences`,
      })),
      ...failures.map((row) => ({
        key: `CUSTOMER_DELIVERY_FAILURE:${row.source_type}:${row.source_id}`,
        kind: 'CUSTOMER_DELIVERY_FAILURE' as const,
        severity: 'CRITICAL' as const,
        projectId: row.project_id,
        projectName: row.project_name,
        reason: 'A Customer delivery failed or has an uncertain outcome.',
        attentionAt: new Date(row.attention_at).toISOString(),
        actionUrl: `/projects/${row.project_id}/customer-correspondences`,
      })),
    ];
    items.sort((left, right) =>
      severityRank(left.severity) - severityRank(right.severity) ||
      Date.parse(left.attentionAt) - Date.parse(right.attentionAt) ||
      left.key.localeCompare(right.key),
    );
    return { items: items.slice(0, 25), totalCount: items.length, limit: 25 };
  }
}

function severityRank(severity: InternalNotification['severity']): number {
  return severity === 'CRITICAL' ? 0 : severity === 'ACTION_REQUIRED' ? 1 : 2;
}
