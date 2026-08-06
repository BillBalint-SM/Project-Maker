import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { AuditEventPage, AuditEventRecord } from '@project-maker/contracts';
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

  private async assertProjectExists(projectId: string): Promise<void> {
    const project = await this.projectRepository.findOne({ where: { id: projectId } });
    if (!project) {
      throw new NotFoundException(`Project ${projectId} was not found.`);
    }
  }
}

function toAuditEventRecord(event: AuditEvent): AuditEventRecord {
  return {
    projectId: event.projectId,
    eventType: event.eventType,
    payload: event.payload,
    createdAt: event.createdAt.toISOString(),
  };
}
