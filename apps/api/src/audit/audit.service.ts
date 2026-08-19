import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  AuditEventPage,
  AuditEventRecord,
  ProjectActivityFeed,
  ProjectActivityItem,
} from '@project-maker/contracts';
import { In, Repository } from 'typeorm';

import { Project } from '../projects/project.entity';
import { AuditEvent } from './audit-event.entity';
import {
  defaultAuditEventLimit,
  ListAuditEventsDto,
} from './dto/list-audit-events.dto';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditEvent)
    private readonly auditEventRepository: Repository<AuditEvent>,
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
  ) {}

  async listProjectEvents(
    projectId: string,
    query: ListAuditEventsDto,
  ): Promise<AuditEventPage> {
    await this.assertProjectExists(projectId);

    const limit = query.limit === undefined ? defaultAuditEventLimit : query.limit;
    const offset = query.offset === undefined ? 0 : query.offset;
    const [events, total] = await this.auditEventRepository.findAndCount({
      where: { projectId },
      order: { createdAt: 'DESC', id: 'DESC' },
      skip: offset,
      take: limit,
    });
    const records = events.map(toAuditEventRecord);
    const hasMore = offset + records.length < total;

    return {
      projectId,
      events: records,
      limit,
      offset,
      total,
      hasMore,
      nextOffset: hasMore ? offset + records.length : null,
    };
  }

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

function toAuditEventRecord(event: AuditEvent): AuditEventRecord {
  return {
    projectId: event.projectId,
    eventType: event.eventType,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  };
}

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
  PROJECT_ARCHIVED: 'A projekt archiválva lett.',
  PROJECT_RESTORED: 'A projekt visszaállítva lett.',
  PROJECT_DECISION_INPUTS_UPDATED: 'A döntési értékelés frissítve lett.',
  DISCOVERY_FOLLOW_UP_CREATED: 'Új tisztázandó tétel jött létre.',
  DISCOVERY_FOLLOW_UP_RESOLVED: 'Egy tisztázandó tétel lezárva lett.',
  DISCOVERY_FOLLOW_UP_UPDATED: 'Egy tisztázandó tétel frissítve lett.',
  DISCOVERY_FOLLOW_UP_SOURCE_LINK_CHANGED:
    'Egy tisztázandó tétel forráshivatkozása frissítve lett.',
  INTERVIEW_ROUND_CREATED: 'Új felmérési kör indult.',
  ROUND_ANSWER_CLEARED: 'Egy felmérési válasz törölve lett.',
  ROUND_ANSWER_SAVED: 'Egy felmérési válasz mentve lett.',
  INTERVIEW_ROUND_COMPLETED: 'Egy felmérési kör lezárult.',
  INTERVIEW_ROUND_ENDED: 'A felmérési kör lezárult; az összefoglaló szerkeszthető.',
  INTERVIEW_HANDOFF_REVISION_STARTED: 'A felmérési összefoglaló új verziója szerkesztés alatt.',
  INTERVIEW_HANDOFF_SENT: 'A felmérési összefoglaló egy verziója elküldve az ügyfélnek.',
  INTERVIEW_HANDOFF_FAILED: 'A felmérési összefoglaló küldése sikertelen; újrapróbálható.',
  INTERVIEW_HANDOFF_UNKNOWN: 'A felmérési összefoglaló küldési eredménye ellenőrzést igényel.',
  ROUND_QUESTION_ASSESSMENT_SAVED: 'Egy kérdés értékelése frissítve lett.',
  ROUND_QUESTION_ASSESSMENT_RESET: 'Egy kérdés értékelése visszaállítva lett.',
  MARKDOWN_REVISION_CREATED: 'Új specifikációverzió készült.',
  PROJECT_QUESTION_SCHEMA_PUBLISHED: 'A projekt kérdéssémája elfogadva lett.',
  FOLLOW_UP_SETTINGS_UPDATED: 'Az automatikus ügyfél-emlékeztető beállításai frissítve lettek.',
  FOLLOW_UP_PING_FAILED: 'Az ügyfél-emlékeztető küldése nem sikerült.',
  FOLLOW_UP_PING_SENT: 'Ügyfél-emlékeztető elküldve.',
  CUSTOMER_FOLLOW_UP_DRAFT_UPDATED: 'Az ügyfél-emlékeztető piszkozata frissítve lett.',
  CUSTOMER_FOLLOW_UP_PING_SENT: 'Az ügyfél-emlékeztető elküldve az ügyfélnek.',
  CUSTOMER_FOLLOW_UP_PING_FAILED: 'Az ügyfél-emlékeztető küldése sikertelen; újrapróbálható.',
  CUSTOMER_FOLLOW_UP_PING_UNKNOWN: 'Az ügyfél-emlékeztető küldési eredménye bizonytalan; kézi ellenőrzés szükséges.',
  CUSTOMER_REVIEW_EMAIL_FAILED: 'A felmérési összefoglaló e-mail küldése nem sikerült.',
  CUSTOMER_REVIEW_EMAIL_SENT: 'A felmérési összefoglaló e-mail elküldve.',
  CUSTOMER_CORRESPONDENCE_REVIEWED: 'Az ügyféllevelezés új üzenetei át lettek nézve.',
  CUSTOMER_CORRESPONDENCE_STATUS_CHANGED: 'Az ügyféllevelezés feldolgozási állapota megváltozott.',
  CUSTOMER_INBOUND_MESSAGE_CLASSIFIED: 'Egy ügyfélválasz kézi besorolást kapott.',
} as const;

type ProjectActivityEventType = keyof typeof projectActivitySummaries;

const projectActivityEventTypes = Object.keys(
  projectActivitySummaries,
) as ProjectActivityEventType[];
