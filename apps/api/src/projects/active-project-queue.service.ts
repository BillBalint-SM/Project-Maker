import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type {
  ActiveProjectQueueCursorErrorCode,
  ActiveProjectQueueItem,
  ActiveProjectQueuePage,
  ActiveProjectQueueQuery,
  ActiveProjectUrgency,
} from '@project-maker/contracts';
import { Repository } from 'typeorm';

import { ProjectPreparationStatusService } from '../project-preparation/project-preparation-status.service';
import { ActiveProjectQueueCursorCodec } from './active-project-queue-cursor';
import { Project } from './project.entity';
import { toNextActionOwner } from './projects.service';

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
  CUSTOMER_REPLY: 'Új ügyfélválasz',
  OVERDUE: 'Lejárt a következő lépés',
  DUE_SOON: 'Hamarosan lejár',
  IN_PROGRESS: 'Folyamatban',
};

interface ReplyAggregate {
  readonly project_id: string;
  readonly new_reply_count: string;
}

interface QueueCandidate {
  readonly project: Project;
  readonly urgency: ActiveProjectUrgency;
  readonly newReplyCount: number;
}

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
    private readonly preparationStatusService: ProjectPreparationStatusService,
    private readonly cursorCodec: ActiveProjectQueueCursorCodec,
    @Inject(activeProjectQueueClockToken)
    private readonly clock: ActiveProjectQueueClock,
  ) {}

  async getPage(query: ActiveProjectQueueQuery = {}): Promise<ActiveProjectQueuePage> {
    const retrievedAt = this.clock.now();
    const [projects, replyAggregates] = await Promise.all([
      this.projectRepository
        .createQueryBuilder('project')
        .where('project.status <> :archived', { archived: 'ARCHIVED' })
        .getMany(),
      this.projectRepository.manager.query<ReplyAggregate[]>(
        `SELECT project_id,
                COUNT(*) FILTER (WHERE status = 'Új válasz') AS new_reply_count
           FROM customer_correspondences
          GROUP BY project_id`,
      ),
    ]);
    const repliesByProjectId = new Map(
      replyAggregates.map((aggregate) => [aggregate.project_id, aggregate]),
    );
    const statusesByProjectId = await this.preparationStatusService.getStatuses(projects);
    const searchedCandidates = projects
      .map((project): QueueCandidate => {
        const aggregate = repliesByProjectId.get(project.id);
        const newReplyCount = Number(aggregate?.new_reply_count ?? 0);
        return {
          project,
          urgency: classifyActiveProjectUrgency(project.dueAt, newReplyCount > 0, retrievedAt),
          newReplyCount,
        };
      })
      .filter(({ project }) => matchesSearch(project.name, query.search))
      .filter(({ project }) => {
        const states = query.preparationStates ?? [];
        return states.length === 0 || states.includes(requiredStatus(statusesByProjectId, project.id).state);
      });
    const groupCounts = {
      CUSTOMER_REPLY: 0,
      OVERDUE: 0,
      DUE_SOON: 0,
      IN_PROGRESS: 0,
    } satisfies Record<ActiveProjectUrgency, number>;
    for (const candidate of searchedCandidates) {
      groupCounts[candidate.urgency] += 1;
    }

    const candidates = searchedCandidates
      .filter(({ urgency }) => {
        const urgencies = query.urgencies ?? [];
        return urgencies.length === 0 || urgencies.includes(urgency);
      })
      .sort(compareCandidates);
    const cursor = query.cursor ? decodeCursor(query.cursor, this.cursorCodec) : null;
    if (cursor && cursor.filter !== cursorFilter(query)) {
      throw new ActiveProjectQueueCursorError('MISMATCHED_CURSOR');
    }
    const anchorIndex = cursor
      ? candidates.findIndex((candidate) => matchesAnchor(candidate, cursor.anchor))
      : -1;
    if (cursor && anchorIndex < 0) {
      throw new ActiveProjectQueueCursorError('OBSOLETE_CURSOR');
    }
    const startIndex = cursor
      ? cursor.direction === 'NEXT'
        ? anchorIndex + 1
        : Math.max(0, anchorIndex - pageSize)
      : 0;
    const pageCandidates = candidates.slice(
      startIndex,
      cursor?.direction === 'PREVIOUS' ? anchorIndex : startIndex + pageSize,
    );

    const items = pageCandidates.map(({ project, urgency, newReplyCount }): ActiveProjectQueueItem => {
      const preparationStatus = requiredStatus(statusesByProjectId, project.id);
      return {
        projectId: project.id,
        projectName: project.name,
        urgency,
        urgencyLabel: urgencyLabels[urgency],
        preparationStatus,
        nextAction: project.nextAction,
        nextActionOwner: toNextActionOwner(project),
        dueAt: project.dueAt?.toISOString() ?? null,
        newReplyCount,
        primaryAction:
          urgency === 'CUSTOMER_REPLY'
            ? { target: 'CUSTOMER_CORRESPONDENCE', label: 'Ügyféllevelezés megnyitása' }
            : preparationStatus.primaryAction,
      };
    });

    return {
      items,
      totalCount: candidates.length,
      groupCounts,
      retrievedAt: retrievedAt.toISOString(),
      previousCursor:
        startIndex > 0 && pageCandidates[0]
          ? this.cursorCodec.seal(createCursor('PREVIOUS', query, pageCandidates[0]))
          : null,
      nextCursor:
        startIndex + pageCandidates.length < candidates.length && pageCandidates.at(-1)
          ? this.cursorCodec.seal(createCursor('NEXT', query, pageCandidates.at(-1)!))
          : null,
    };
  }
}

function createCursor(
  direction: QueueCursor['direction'],
  query: ActiveProjectQueueQuery,
  candidate: QueueCandidate,
): QueueCursor {
  return {
    version: 1,
    direction,
    filter: cursorFilter(query),
    anchor: {
      urgency: candidate.urgency,
      dueAt: candidate.project.dueAt?.toISOString() ?? null,
      projectName: normalizeProjectName(candidate.project.name),
      projectId: candidate.project.id,
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

function matchesAnchor(
  candidate: QueueCandidate,
  anchor: QueueCursor['anchor'],
): boolean {
  return candidate.urgency === anchor.urgency
    && (candidate.project.dueAt?.toISOString() ?? null) === anchor.dueAt
    && normalizeProjectName(candidate.project.name) === anchor.projectName
    && candidate.project.id === anchor.projectId;
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

function compareCandidates(left: QueueCandidate, right: QueueCandidate): number {
  return compareActiveProjectQueueOrder(
    {
      urgency: left.urgency,
      dueAt: left.project.dueAt,
      projectName: left.project.name,
      projectId: left.project.id,
    },
    {
      urgency: right.urgency,
      dueAt: right.project.dueAt,
      projectName: right.project.name,
      projectId: right.project.id,
    },
  );
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

function matchesSearch(projectName: string, search: string | undefined): boolean {
  const normalizedSearch = normalizeProjectName(search?.trim() ?? '');
  return normalizedSearch.length === 0 || normalizeProjectName(projectName).includes(normalizedSearch);
}

function requiredStatus(
  statuses: ReadonlyMap<string, import('@project-maker/contracts').ProjectPreparationStatus>,
  projectId: string,
): import('@project-maker/contracts').ProjectPreparationStatus {
  const status = statuses.get(projectId);
  if (!status) throw new TypeError(`Missing preparation status for Project ${projectId}.`);
  return status;
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
