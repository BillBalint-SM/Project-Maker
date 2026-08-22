import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  ActiveProjectQueueAction,
  ActiveProjectQueueCursorErrorCode,
  ActiveProjectQueueItem,
  ActiveProjectQueuePage,
  ActiveProjectQueueQuery,
  ActiveProjectUrgency,
  ProjectPortfolioEntry,
  ProjectWorkState,
} from '@project-maker/contracts';
import { Repository } from 'typeorm';

import { toProjectPreparationStatus } from '../project-preparation/project-preparation-status-value';
import { ActiveProjectQueueCursorCodec } from './active-project-queue-cursor';
import { Project } from './project.entity';
import {
  ProjectWorkStateReadModel,
  type ProjectWorkStateReadRow,
} from './project-work-state-read-model';
import { toWorkspace } from './projects.service';

export const activeProjectQueueClockToken = 'ACTIVE_PROJECT_QUEUE_CLOCK';

export interface ActiveProjectQueueClock {
  now(): Date;
}

const pageSize = 10;
const urgencyOrder: Readonly<Record<ActiveProjectUrgency, number>> = {
  CUSTOMER_REPLY: 0,
  OVERDUE: 1,
  DUE_SOON: 2,
  IN_PROGRESS: 3,
};
const urgencyLabels: Readonly<Record<ActiveProjectUrgency, string>> = {
  CUSTOMER_REPLY: 'New Customer reply',
  OVERDUE: 'Next action overdue',
  DUE_SOON: 'Due soon',
  IN_PROGRESS: 'In progress',
};
const coordinationAction: ActiveProjectQueueAction = {
  target: 'PROJECT_COORDINATION',
  label: 'Manage next action',
};

interface QueueCursor {
  readonly version: 1;
  readonly direction: 'NEXT' | 'PREVIOUS';
  readonly filter: string;
  readonly anchor: {
    readonly urgency: ActiveProjectUrgency;
    readonly dueAt: string | null;
    readonly projectName: string;
    readonly projectId: string;
  };
}

export class ActiveProjectQueueCursorError extends Error {
  constructor(readonly code: ActiveProjectQueueCursorErrorCode) {
    super(code);
  }
}

@Injectable()
export class ActiveProjectQueueService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepository: Repository<Project>,
    private readonly cursorCodec: ActiveProjectQueueCursorCodec,
    private readonly readModel: ProjectWorkStateReadModel,
    @Inject(activeProjectQueueClockToken)
    private readonly clock: ActiveProjectQueueClock,
  ) {}

  async getWorkState(projectId: string): Promise<ActiveProjectQueueItem> {
    const workState = (await this.getProjectedWorkStates([projectId], true)).get(projectId);
    if (!workState) throw new NotFoundException('Project not found.');
    return workState;
  }

  async getPortfolio(): Promise<readonly ProjectPortfolioEntry[]> {
    const projects = await this.projectRepository.find({
      order: { updatedAt: 'DESC', id: 'ASC' },
    });
    const activeProjects = projects.filter((project) => project.status !== 'ARCHIVED');
    const workStates = await this.getProjectedWorkStates(
      activeProjects.map((project) => project.id),
      false,
    );
    return projects.map((project) => ({
      project: toWorkspace(project),
      workState: project.status === 'ARCHIVED'
        ? null
        : workStates.get(project.id) ?? null,
    }));
  }

  private async getProjectedWorkStates(
    projectIds: readonly string[],
    includeArchived: boolean,
  ): Promise<ReadonlyMap<string, ProjectWorkState>> {
    const retrievedAt = this.clock.now();
    const rows = await this.readModel.getWorkStates({
      projectIds,
      includeArchived,
      now: retrievedAt,
      dueSoonUntil: endOfSeventhBudapestDay(retrievedAt),
    });
    return new Map(rows.map((row) => [row.projectId, toProjectWorkState(row)]));
  }

  async getPage(query: ActiveProjectQueueQuery = {}): Promise<ActiveProjectQueuePage> {
    const retrievedAt = this.clock.now();
    const cursor = query.cursor ? decodeCursor(query.cursor, this.cursorCodec) : null;
    if (cursor && cursor.filter !== cursorFilter(query)) {
      throw new ActiveProjectQueueCursorError('MISMATCHED_CURSOR');
    }
    const readPage = await this.readModel.getPage({
      query,
      cursor,
      now: retrievedAt,
      dueSoonUntil: endOfSeventhBudapestDay(retrievedAt),
    });
    if (cursor && !readPage.anchorExists) {
      throw new ActiveProjectQueueCursorError('OBSOLETE_CURSOR');
    }
    const hasMoreInDirection = readPage.rows.length > pageSize;
    const selectedRows = readPage.rows.slice(0, pageSize);
    const pageRows = cursor?.direction === 'PREVIOUS'
      ? [...selectedRows].reverse()
      : selectedRows;
    const items = pageRows.map(toProjectWorkState);
    const hasPrevious = cursor
      ? cursor.direction === 'NEXT' || hasMoreInDirection
      : false;
    const hasNext = cursor
      ? cursor.direction === 'PREVIOUS' || hasMoreInDirection
      : hasMoreInDirection;

    return {
      items,
      totalCount: readPage.totalCount,
      groupCounts: readPage.groupCounts,
      retrievedAt: retrievedAt.toISOString(),
      previousCursor:
        hasPrevious && items[0]
          ? this.cursorCodec.seal(createCursor('PREVIOUS', query, items[0]))
          : null,
      nextCursor:
        hasNext && items.at(-1)
          ? this.cursorCodec.seal(createCursor('NEXT', query, items.at(-1)!))
          : null,
    };
  }

}

function primaryActionFor(
  urgency: ActiveProjectUrgency,
  preparationAction: ActiveProjectQueueAction,
): ActiveProjectQueueAction {
  if (urgency === 'CUSTOMER_REPLY') {
    return { target: 'CUSTOMER_CORRESPONDENCE', label: 'Open Customer correspondence' };
  }
  if (urgency === 'OVERDUE' || urgency === 'DUE_SOON') {
    return coordinationAction;
  }
  return preparationAction;
}

function toProjectWorkState(row: ProjectWorkStateReadRow): ProjectWorkState {
  const preparationStatus = toProjectPreparationStatus(row.projectId, row.preparationState);
  const displayName = row.nextActionOwnerRole === 'INTERNAL_OWNER'
    ? row.internalOwnerName
    : row.nextActionOwnerRole === 'CUSTOMER_CONTACT'
      ? row.customerContactName
      : null;
  return {
    projectId: row.projectId,
    projectName: row.projectName,
    urgency: row.urgency,
    urgencyLabel: urgencyLabels[row.urgency],
    preparationStatus,
    nextAction: row.nextAction,
    nextActionOwner: {
      role: row.nextActionOwnerRole,
      displayName,
      complete: row.nextActionOwnerRole !== null && displayName !== null,
    },
    dueAt: row.dueAt,
    newReplyCount: row.newReplyCount,
    progress: row.preparationState === 'INTAKE_IN_PROGRESS'
      ? {
          kind: 'INTERVIEW_ANSWERS',
          answeredQuestions: row.answeredQuestions,
          totalQuestions: row.totalQuestions,
        }
      : row.preparationState === 'SCHEMA_REQUIRED'
        ? undefined
        : {
            kind: 'DECISION_INPUTS',
            completedInputs: row.completedDecisionInputs,
            totalInputs: 6,
          },
    primaryAction: primaryActionFor(row.urgency, preparationStatus.primaryAction),
  };
}

function createCursor(
  direction: QueueCursor['direction'],
  query: ActiveProjectQueueQuery,
  item: ActiveProjectQueueItem,
): QueueCursor {
  return {
    version: 1,
    direction,
    filter: cursorFilter(query),
    anchor: {
      urgency: item.urgency,
      dueAt: item.dueAt,
      projectName: normalizeProjectName(item.projectName),
      projectId: item.projectId,
    },
  };
}

function decodeCursor(raw: string, codec: ActiveProjectQueueCursorCodec): QueueCursor {
  try {
    const value = codec.open(raw);
    if (!isQueueCursor(value)) throw new TypeError('Invalid cursor shape.');
    return value;
  } catch {
    throw new ActiveProjectQueueCursorError('MALFORMED_CURSOR');
  }
}

function isQueueCursor(value: unknown): value is QueueCursor {
  if (!value || typeof value !== 'object') return false;
  const cursor = value as Partial<QueueCursor>;
  const anchor = cursor.anchor as Partial<QueueCursor['anchor']> | undefined;
  return cursor.version === 1
    && (cursor.direction === 'NEXT' || cursor.direction === 'PREVIOUS')
    && typeof cursor.filter === 'string'
    && Boolean(anchor)
    && typeof anchor?.urgency === 'string'
    && Object.hasOwn(urgencyOrder, anchor.urgency)
    && (anchor.dueAt === null || isIsoInstant(anchor.dueAt))
    && typeof anchor.projectName === 'string'
    && typeof anchor.projectId === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      anchor.projectId,
    );
}

function isIsoInstant(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString() === value;
}

function cursorFilter(query: ActiveProjectQueueQuery): string {
  return JSON.stringify({
    search: normalizeProjectName(query.search?.trim() ?? ''),
    urgencies: [...(query.urgencies ?? [])].sort(),
    preparationStates: [...(query.preparationStates ?? [])].sort(),
  });
}

export function classifyActiveProjectUrgency(
  dueAt: Date | null,
  hasNewReply: boolean,
  now: Date,
): ActiveProjectUrgency {
  if (hasNewReply) {
    return 'CUSTOMER_REPLY';
  }
  if (dueAt && dueAt < now) {
    return 'OVERDUE';
  }
  if (dueAt && dueAt <= endOfSeventhBudapestDay(now)) {
    return 'DUE_SOON';
  }
  return 'IN_PROGRESS';
}

export interface ActiveProjectQueueOrderValue {
  readonly urgency: ActiveProjectUrgency;
  readonly dueAt: Date | null;
  readonly projectName: string;
  readonly projectId: string;
}

export function compareActiveProjectQueueOrder(
  left: ActiveProjectQueueOrderValue,
  right: ActiveProjectQueueOrderValue,
): number {
  return (
    urgencyOrder[left.urgency] - urgencyOrder[right.urgency] ||
    compareNullableDates(left.dueAt, right.dueAt) ||
    normalizeProjectName(left.projectName).localeCompare(normalizeProjectName(right.projectName), 'hu') ||
    left.projectId.localeCompare(right.projectId)
  );
}

function compareNullableDates(left: Date | null, right: Date | null): number {
  if (left === null) return right === null ? 0 : 1;
  if (right === null) return -1;
  return left.getTime() - right.getTime();
}

function normalizeProjectName(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('hu-HU');
}

function endOfSeventhBudapestDay(now: Date): Date {
  const dateParts = zonedDateParts(now, 'Europe/Budapest');
  const target = new Date(Date.UTC(dateParts.year, dateParts.month - 1, dateParts.day + 7));
  return zonedLocalToInstant(
    {
      year: target.getUTCFullYear(),
      month: target.getUTCMonth() + 1,
      day: target.getUTCDate(),
      hour: 23,
      minute: 59,
      second: 59,
      millisecond: 999,
    },
    'Europe/Budapest',
  );
}

interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
  readonly hour: number;
  readonly minute: number;
  readonly second: number;
  readonly millisecond: number;
}

function zonedDateParts(date: Date, timeZone: string): DateParts {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: value('year'),
    month: value('month'),
    day: value('day'),
    hour: value('hour'),
    minute: value('minute'),
    second: value('second'),
    millisecond: date.getUTCMilliseconds(),
  };
}

function zonedLocalToInstant(parts: DateParts, timeZone: string): Date {
  const desiredAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
  let candidate = desiredAsUtc;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    const observed = zonedDateParts(new Date(candidate), timeZone);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second,
      observed.millisecond,
    );
    candidate += desiredAsUtc - observedAsUtc;
  }
  return new Date(candidate);
}
