import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  ProjectActivityFeed,
  ProjectActivityItem,
} from '@project-maker/contracts';
import { In, Repository } from 'typeorm';

import { Project } from '../projects/project.entity';
import { AuditEvent } from './audit-event.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditEvent)
    private readonly auditEventRepository: Repository<AuditEvent>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async listRecentProjectActivity(projectId: string): Promise<ProjectActivityFeed> {
    await this.assertProjectExists(projectId);

    const events = await this.auditEventRepository.find({
      where: { projectId, eventType: In(projectActivityEventTypes) },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: recentActivityLimit,
    });

    return {
      projectId,
      events: events.map(toProjectActivityItem),
    };
  }

  private async assertProjectExists(projectId: string): Promise<void> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} was not found.`);
    }
  }
}

const recentActivityLimit = 5;

function toProjectActivityItem(event: AuditEvent): ProjectActivityItem {
  const summary = projectActivitySummaries[
    event.eventType as ProjectActivityEventType
  ];
  if (!summary) {
    throw new InternalServerErrorException(
      'Project activity allow-list is inconsistent.',
    );
  }
  return {
    occurredAt: event.createdAt.toISOString(),
    summary,
  };
}

const projectActivitySummaries = {
  PROJECT_ARCHIVED: 'Project archived.',
  PROJECT_RESTORED: 'Project restored.',
  PROJECT_DECISION_INPUTS_UPDATED: 'Decision Review updated.',
  DISCOVERY_FOLLOW_UP_CREATED: 'Discovery follow-up created.',
  DISCOVERY_FOLLOW_UP_RESOLVED: 'Discovery follow-up resolved.',
  DISCOVERY_FOLLOW_UP_UPDATED: 'Discovery follow-up updated.',
  DISCOVERY_FOLLOW_UP_SOURCE_LINK_CHANGED:
    'Discovery follow-up source link updated.',
  INTERVIEW_ROUND_CREATED: 'Interview round started.',
  ROUND_ANSWER_CLEARED: 'Interview answer cleared.',
  ROUND_ANSWER_SAVED: 'Interview answer saved.',
  INTERVIEW_ROUND_COMPLETED: 'Interview round completed.',
  INTERVIEW_ROUND_ENDED: 'Interview round ended; the summary is now editable.',
  INTERVIEW_HANDOFF_REVISION_STARTED: 'A new interview summary version is being drafted.',
  INTERVIEW_HANDOFF_SENT: 'An interview summary version was sent to the Customer.',
  INTERVIEW_HANDOFF_FAILED: 'Interview summary delivery failed and can be retried.',
  INTERVIEW_HANDOFF_UNKNOWN: 'Interview summary delivery outcome requires review.',
  ROUND_QUESTION_ASSESSMENT_SAVED: 'Question assessment updated.',
  ROUND_QUESTION_ASSESSMENT_RESET: 'Question assessment reset.',
  MARKDOWN_REVISION_CREATED: 'Specification version created.',
  PROJECT_QUESTION_SCHEMA_PUBLISHED: 'Project question schema accepted.',
  FOLLOW_UP_SETTINGS_UPDATED: 'Automatic Customer reminder settings updated.',
  FOLLOW_UP_PING_FAILED: 'Customer reminder delivery failed.',
  FOLLOW_UP_PING_SENT: 'Customer reminder sent.',
  CUSTOMER_FOLLOW_UP_DRAFT_UPDATED: 'Customer reminder draft updated.',
  CUSTOMER_FOLLOW_UP_PING_SENT: 'Customer reminder sent to the Customer.',
  CUSTOMER_FOLLOW_UP_PING_FAILED: 'Customer reminder delivery failed and can be retried.',
  CUSTOMER_FOLLOW_UP_PING_UNKNOWN: 'Customer reminder delivery outcome is uncertain; manual review is required.',
  CUSTOMER_REVIEW_EMAIL_FAILED: 'Interview summary email delivery failed.',
  CUSTOMER_REVIEW_EMAIL_SENT: 'Interview summary email sent.',
  CUSTOMER_CORRESPONDENCE_REVIEWED: 'New Customer correspondence messages reviewed.',
  CUSTOMER_CORRESPONDENCE_STATUS_CHANGED: 'Customer correspondence processing status changed.',
  CUSTOMER_INBOUND_MESSAGE_CLASSIFIED: 'Customer reply classified manually.',
} as const;

type ProjectActivityEventType = keyof typeof projectActivitySummaries;

const projectActivityEventTypes = Object.keys(
  projectActivitySummaries,
) as ProjectActivityEventType[];
