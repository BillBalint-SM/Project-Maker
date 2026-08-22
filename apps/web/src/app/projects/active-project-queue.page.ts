import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, ParamMap, Router, RouterLink } from '@angular/router';
import type {
  ActiveProjectQueueQuery,
  ActiveProjectQueueItem,
  ActiveProjectQueuePage,
  ActiveProjectUrgency,
  ProjectPreparationState,
} from '@project-maker/contracts';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import { catchError, debounce, distinctUntilChanged, EMPTY, filter, map, merge, of, Subject, switchMap, tap, timer } from 'rxjs';

import {
  ActiveProjectQueueApiService,
  ActiveProjectQueueCursorRequestError,
} from './active-project-queue-api.service';
import { projectActionFragment, projectActionRoute } from './project-action-route';
import { projectWorkProgressLabel } from './project-work-progress-label';

const urgencyOrder: readonly ActiveProjectUrgency[] = [
  'CUSTOMER_REPLY',
  'OVERDUE',
  'DUE_SOON',
  'IN_PROGRESS',
];
const preparationOrder: readonly ProjectPreparationState[] = [
  'SCHEMA_REQUIRED',
  'INTAKE_IN_PROGRESS',
  'CLARIFICATION_REQUIRED',
  'DECISION_REVIEW_REQUIRED',
  'ESTIMATE_PREPARABLE',
  'ESTIMATE_READY',
];

const urgencyOptions = [
  ['CUSTOMER_REPLY', 'New Customer reply'],
  ['OVERDUE', 'Overdue'],
  ['DUE_SOON', 'Due soon'],
  ['IN_PROGRESS', 'In progress'],
] as const satisfies readonly (readonly [ActiveProjectUrgency, string])[];
const preparationOptions = [
  ['SCHEMA_REQUIRED', 'Question schema required'],
  ['INTAKE_IN_PROGRESS', 'Initial Intake in progress'],
  ['CLARIFICATION_REQUIRED', 'Clarification required'],
  ['DECISION_REVIEW_REQUIRED', 'Decision Review required'],
  ['ESTIMATE_PREPARABLE', 'Ready for estimate preparation'],
  ['ESTIMATE_READY', 'Ready for estimation'],
] as const satisfies readonly (readonly [ProjectPreparationState, string])[];

interface QueueGroup {
  readonly urgency: ActiveProjectUrgency;
  readonly label: string;
  readonly items: readonly ActiveProjectQueueItem[];
}

type QueueLoadKind = 'ROUTE' | 'REFRESH' | 'RETRY';

interface QueueLoadRequest {
  readonly query: ActiveProjectQueueQuery;
  readonly kind: QueueLoadKind;
}

@Component({
  selector: 'app-active-project-queue-page',
  imports: [ButtonModule, DatePipe, ProgressSpinnerModule, ReactiveFormsModule, RouterLink, TagModule],
  templateUrl: './active-project-queue.page.html',
  styleUrl: './active-project-queue.page.scss',
})
export class ActiveProjectQueuePageComponent implements OnInit {
  private readonly api = inject(ActiveProjectQueueApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly requestedLoads = new Subject<QueueLoadRequest>();
  private preserveRecoveryNoticeForNextPage = false;
  private nextRouteLoadKind: QueueLoadKind | null = null;
  private failedRequest: QueueLoadRequest | null = null;

  readonly search = new FormControl('', { nonNullable: true });
  readonly selectedUrgencies = signal<readonly ActiveProjectUrgency[]>([]);
  readonly selectedPreparationStates = signal<readonly ProjectPreparationState[]>([]);
  readonly urgencyOptions = urgencyOptions;
  readonly preparationOptions = preparationOptions;
  readonly progressLabel = projectWorkProgressLabel;
  readonly actionFragment = projectActionFragment;

  readonly page = signal<ActiveProjectQueuePage | null>(null);
  readonly activeQuery = signal<ActiveProjectQueueQuery>({});
  readonly loading = signal(true);
  readonly updating = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly updateError = signal<string | null>(null);
  readonly stale = signal(false);
  readonly liveStatus = signal<string | null>(null);
  readonly cursorRecoveryNotice = signal<string | null>(null);
  readonly hasActiveFilters = computed(() => {
    const query = this.activeQuery();
    return Boolean(
      query.search || query.urgencies?.length || query.preparationStates?.length,
    );
  });
  readonly groups = computed<readonly QueueGroup[]>(() => {
    const items = this.page()?.items ?? [];
    return urgencyOrder.flatMap((urgency) => {
      const groupItems = items.filter((item) => item.urgency === urgency);
      return groupItems.length === 0
        ? []
        : [{ urgency, label: groupItems[0].urgencyLabel, items: groupItems }];
    });
  });

  ngOnInit(): void {
    const routeQuery = this.route.queryParamMap.pipe(
      map(parseQueueQuery),
      distinctUntilChanged((left, right) => JSON.stringify(left) === JSON.stringify(right)),
      tap((query) => {
        this.activeQuery.set(query);
        this.search.setValue(query.search ?? '', { emitEvent: false });
        this.selectedUrgencies.set(query.urgencies ?? []);
        this.selectedPreparationStates.set(query.preparationStates ?? []);
      }),
    );
    const routeLoads = routeQuery.pipe(map((query): QueueLoadRequest => {
      const kind = this.nextRouteLoadKind ?? 'ROUTE';
      this.nextRouteLoadKind = null;
      return { query, kind };
    }));

    merge(routeLoads, this.requestedLoads).pipe(
      tap((request) => {
        const hasPage = this.page() !== null;
        this.loading.set(!hasPage);
        this.updating.set(hasPage);
        this.loadError.set(null);
        if (request.kind !== 'RETRY') {
          this.failedRequest = null;
          this.stale.set(false);
          this.updateError.set(null);
        }
      }),
      switchMap((request) => this.api.getPage(request.query).pipe(
        map((page) => ({ request, page, error: null })),
        catchError((error: unknown) => {
          if (error instanceof ActiveProjectQueueCursorRequestError) {
            this.cursorRecoveryNotice.set(
              'The previous page is no longer available. Showing the first page.',
            );
            this.preserveRecoveryNoticeForNextPage = true;
            void this.navigateToFirstPage(request.query);
            return EMPTY;
          }
          const message = error instanceof Error ? error.message : 'Unknown loading error.';
          return of({ request, page: null, error: message });
        }),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ request, page, error }) => {
      if (page) {
        if (this.preserveRecoveryNoticeForNextPage) {
          this.preserveRecoveryNoticeForNextPage = false;
        } else {
          this.cursorRecoveryNotice.set(null);
        }
        this.page.set(page);
        this.failedRequest = null;
        this.stale.set(false);
        this.updateError.set(null);
        if (request.kind === 'REFRESH') {
          this.liveStatus.set('The list has been refreshed.');
        } else if (request.kind === 'RETRY') {
          this.liveStatus.set('The list is available again.');
        }
      } else if (error) {
        this.failedRequest = request;
        if (this.page()) {
          this.stale.set(true);
          this.updateError.set(error);
          this.liveStatus.set('The list could not be refreshed. Previously loaded data remains visible.');
        } else {
          this.loadError.set(error);
        }
      }
      this.loading.set(false);
      this.updating.set(false);
    });

    this.search.valueChanges.pipe(
      map((value) => value.trim()),
      debounce((value) => timer(value ? 300 : 0)),
      distinctUntilChanged(),
      filter((value) => value !== (this.activeQuery().search ?? '')),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => void this.updateUrl());
  }

  refresh(): void {
    const query = { ...this.activeQuery(), cursor: undefined };
    this.liveStatus.set(null);
    if (this.activeQuery().cursor) {
      this.nextRouteLoadKind = 'REFRESH';
      void this.navigateToFirstPage(query);
      return;
    }
    this.requestedLoads.next({ query, kind: 'REFRESH' });
  }

  retry(): void {
    if (!this.failedRequest) return;
    this.liveStatus.set(null);
    this.requestedLoads.next({ query: this.failedRequest.query, kind: 'RETRY' });
  }

  clearFilters(): void {
    this.search.setValue('', { emitEvent: false });
    this.selectedUrgencies.set([]);
    this.selectedPreparationStates.set([]);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { q: null, urgency: null, preparation: null, cursor: null },
      replaceUrl: true,
    });
  }

  toggleUrgency(urgency: ActiveProjectUrgency): void {
    this.selectedUrgencies.update((values) => toggle(values, urgency, urgencyOrder));
    void this.updateUrl();
  }

  togglePreparationState(state: ProjectPreparationState): void {
    this.selectedPreparationStates.update((values) => toggle(values, state, preparationOrder));
    void this.updateUrl();
  }

  navigateToCursor(cursor: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queueQueryParams(this.activeQuery(), cursor),
      replaceUrl: false,
    });
  }

  private updateUrl(): Promise<boolean> {
    const search = this.search.value.trim();
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: search || null,
        urgency: this.selectedUrgencies().length ? this.selectedUrgencies() : null,
        preparation: this.selectedPreparationStates().length ? this.selectedPreparationStates() : null,
      },
      replaceUrl: true,
    });
  }

  private navigateToFirstPage(query: ActiveProjectQueueQuery): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: queueQueryParams(query, null),
      replaceUrl: true,
    });
  }

  projectRoute(projectId: string): readonly string[] {
    return ['/projects', projectId, 'status'];
  }

  actionRoute(item: ActiveProjectQueueItem): readonly string[] {
    return projectActionRoute(item.projectId, item.primaryAction.target);
  }

  projectContextQueryParams(): { readonly returnTo: string } {
    return { returnTo: this.router.url };
  }
}

function parseQueueQuery(params: ParamMap): ActiveProjectQueueQuery {
  const search = params.get('q')?.trim() || undefined;
  return {
    search,
    urgencies: knownValues(params.getAll('urgency'), urgencyOrder),
    preparationStates: knownValues(params.getAll('preparation'), preparationOrder),
    cursor: params.get('cursor') || undefined,
  };
}

function queueQueryParams(query: ActiveProjectQueueQuery, cursor: string | null) {
  return {
    q: query.search || null,
    urgency: query.urgencies?.length ? query.urgencies : null,
    preparation: query.preparationStates?.length ? query.preparationStates : null,
    cursor,
  };
}

function knownValues<const Value extends string>(values: readonly string[], allowed: readonly Value[]): Value[] {
  const allowedValues = new Set<string>(allowed);
  return [...new Set(values.filter((value): value is Value => allowedValues.has(value)))];
}

function toggle<const Value extends string>(
  values: readonly Value[], value: Value, order: readonly Value[],
): Value[] {
  const selected = new Set(values);
  if (selected.has(value)) selected.delete(value); else selected.add(value);
  return order.filter((candidate) => selected.has(candidate));
}
