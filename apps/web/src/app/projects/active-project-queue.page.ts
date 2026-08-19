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
import { catchError, combineLatest, debounce, distinctUntilChanged, map, of, startWith, Subject, switchMap, tap, timer } from 'rxjs';

import { ActiveProjectQueueApiService } from './active-project-queue-api.service';
import { projectActionRoute } from './project-action-route';

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
  ['CUSTOMER_REPLY', 'Új ügyfélválasz'],
  ['OVERDUE', 'Lejárt'],
  ['DUE_SOON', 'Hamarosan lejár'],
  ['IN_PROGRESS', 'Folyamatban'],
] as const satisfies readonly (readonly [ActiveProjectUrgency, string])[];
const preparationOptions = [
  ['SCHEMA_REQUIRED', 'Kérdésséma szükséges'],
  ['INTAKE_IN_PROGRESS', 'Felmérés folyamatban'],
  ['CLARIFICATION_REQUIRED', 'Tisztázás szükséges'],
  ['DECISION_REVIEW_REQUIRED', 'Döntési értékelés szükséges'],
  ['ESTIMATE_PREPARABLE', 'Becslés előkészíthető'],
  ['ESTIMATE_READY', 'Becslésre kész'],
] as const satisfies readonly (readonly [ProjectPreparationState, string])[];

interface QueueGroup {
  readonly urgency: ActiveProjectUrgency;
  readonly label: string;
  readonly items: readonly ActiveProjectQueueItem[];
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
  private readonly reload = new Subject<void>();

  readonly search = new FormControl('', { nonNullable: true });
  readonly selectedUrgencies = signal<readonly ActiveProjectUrgency[]>([]);
  readonly selectedPreparationStates = signal<readonly ProjectPreparationState[]>([]);
  readonly urgencyOptions = urgencyOptions;
  readonly preparationOptions = preparationOptions;

  readonly page = signal<ActiveProjectQueuePage | null>(null);
  readonly activeQuery = signal<ActiveProjectQueueQuery>({});
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
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
    combineLatest([routeQuery, this.reload.pipe(startWith(undefined))]).pipe(
      map(([query]) => query),
      tap(() => {
        this.loading.set(true);
        this.loadError.set(null);
      }),
      switchMap((query) => this.api.firstPage(query).pipe(
        map((page) => ({ page, error: null })),
        catchError((error: Error) => of({ page: null, error: error.message })),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(({ page, error }) => {
      this.page.set(page);
      this.loadError.set(error);
      this.loading.set(false);
    });

    this.search.valueChanges.pipe(
      debounce((value) => timer(value.trim() ? 300 : 0)),
      distinctUntilChanged(),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => void this.updateUrl());
  }

  load(): void {
    this.reload.next();
  }

  toggleUrgency(urgency: ActiveProjectUrgency): void {
    this.selectedUrgencies.update((values) => toggle(values, urgency, urgencyOrder));
    void this.updateUrl();
  }

  togglePreparationState(state: ProjectPreparationState): void {
    this.selectedPreparationStates.update((values) => toggle(values, state, preparationOrder));
    void this.updateUrl();
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

  projectRoute(projectId: string): readonly string[] {
    return ['/projects', projectId, 'status'];
  }

  actionRoute(item: ActiveProjectQueueItem): readonly string[] {
    return projectActionRoute(item.projectId, item.primaryAction.target);
  }
}

function parseQueueQuery(params: ParamMap): ActiveProjectQueueQuery {
  const search = params.get('q')?.trim() || undefined;
  return {
    search,
    urgencies: knownValues(params.getAll('urgency'), urgencyOrder),
    preparationStates: knownValues(params.getAll('preparation'), preparationOrder),
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
