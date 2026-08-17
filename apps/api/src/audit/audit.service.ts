import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  AuditEventPage,
  AuditEventRecord,
  ProjectActivityFeed,
  ProjectActivityItem,
} from '@project-maker/contracts';
import { Repository } from 'typeorm';

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
      where: { projectId },
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
  return {
    occurredAt: event.createdAt.toISOString(),
    summary: projectActivitySummaries[event.eventType] ?? 'Projektaktivitás rögzítve lett.',
  };
}

const projectActivitySummaries: Readonly<Record<string, string>> = {
  PROJECT_ARCHIVED: 'A projekt archiválva lett.',
  PROJECT_RESTORED: 'A projekt visszaállítva lett.',
  PROJECT_DECISION_INPUTS_UPDATED: 'A döntési értékelés frissítve lett.',
  DISCOVERY_FOLLOW_UP_CREATED: 'Új discovery utánkövetés jött létre.',
  DISCOVERY_FOLLOW_UP_RESOLVED: 'Egy discovery utánkövetés lezárva lett.',
  DISCOVERY_FOLLOW_UP_UPDATED: 'Egy discovery utánkövetés frissítve lett.',
  DISCOVERY_FOLLOW_UP_SOURCE_LINK_CHANGED: 'Egy discovery utánkövetés forráshivatkozása frissítve lett.',
  INTERVIEW_ROUND_CREATED: 'Új interjúkör indult.',
  ROUND_ANSWER_CLEARED: 'Egy interjúválasz törölve lett.',
  ROUND_ANSWER_SAVED: 'Egy interjúválasz mentve lett.',
  INTERVIEW_ROUND_COMPLETED: 'Egy interjúkör lezárult.',
  INTERVIEW_ROUND_ENDED: 'Az interjú meetingje lezárva; az összefoglaló szerkeszthető.',
  INTERVIEW_HANDOFF_REVISION_STARTED: 'Az interjú-összefoglaló új verziója szerkesztés alatt.',
  INTERVIEW_HANDOFF_SENT: 'Az interjú-összefoglaló egy verziója elküldve az ügyfélnek.',
  INTERVIEW_HANDOFF_FAILED: 'Az interjú-összefoglaló küldése sikertelen; újrapróbálható.',
  INTERVIEW_HANDOFF_UNKNOWN: 'Az interjú-összefoglaló küldési eredménye ellenőrzést igényel.',
  ROUND_QUESTION_ASSESSMENT_SAVED: 'Egy kérdés értékelése frissítve lett.',
  ROUND_QUESTION_ASSESSMENT_RESET: 'Egy kérdés értékelése visszaállítva lett.',
  MARKDOWN_REVISION_CREATED: 'Új Markdown-terv készült.',
  PROJECT_QUESTION_SCHEMA_PUBLISHED: 'A projekt kérdéssémája elfogadva lett.',
  FOLLOW_UP_SETTINGS_UPDATED: 'Az ügyfél-utánkövetés beállításai frissítve lettek.',
  FOLLOW_UP_PING_FAILED: 'Az ügyfél-utánkövető emlékeztető küldése nem sikerült.',
  FOLLOW_UP_PING_SENT: 'Ügyfél-utánkövető emlékeztető elküldve.',
  CUSTOMER_REVIEW_EMAIL_FAILED: 'Az ügyfél-review e-mail küldése nem sikerült.',
  CUSTOMER_REVIEW_EMAIL_SENT: 'Ügyfél-review e-mail elküldve.',
};
