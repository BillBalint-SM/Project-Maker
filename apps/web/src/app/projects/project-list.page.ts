import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import type {
  CustomerMailboxSyncState,
  CustomerMailboxSyncStatus,
  FormalDecisionOutcome,
  PortfolioPage,
  PortfolioQuery,
  PortfolioRow,
  PortfolioSort,
  ProjectHealth,
} from '@project-maker/contracts';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';

import { AuthApiService } from '../auth/auth-api.service';
import { CustomerMailboxSyncApiService } from './customer-mailbox-sync-api.service';
import { DecisionPortfolioApiService } from './decision-portfolio-api.service';
import { projectActionFragment, projectActionRoute } from './project-action-route';
import { projectStatusLabel } from './project-status-label';
import { projectWorkProgressLabel } from './project-work-progress-label';

interface SavedPortfolioView {
  readonly name: string;
  readonly query: PortfolioQuery;
}

@Component({
  selector: 'app-project-list-page',
  imports: [
    ButtonModule,
    CardModule,
    DatePipe,
    MessageModule,
    ProgressSpinnerModule,
    ReactiveFormsModule,
    RouterLink,
    TagModule,
  ],
  templateUrl: './project-list.page.html',
  styleUrl: './project-list.page.scss',
})
export class ProjectListPage implements OnInit {
  private readonly portfolioApi = inject(DecisionPortfolioApiService);
  private readonly mailboxApi = inject(CustomerMailboxSyncApiService);
  private readonly auth = inject(AuthApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly portfolio = signal<PortfolioPage | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly statusLabel = projectStatusLabel;
  readonly projectContextQueryParams = { returnTo: '/' } as const;
  readonly mailboxStatus = signal<CustomerMailboxSyncStatus | null>(null);
  readonly mailboxLoading = signal(true);
  readonly mailboxRefreshing = signal(false);
  readonly mailboxError = signal<string | null>(null);
  readonly savedViews = signal<readonly SavedPortfolioView[]>([]);
  readonly viewFeedback = signal<string | null>(null);
  readonly filterForm = new FormGroup({
    search: new FormControl('', { nonNullable: true }),
    health: new FormControl<ProjectHealth | ''>('', { nonNullable: true }),
    decision: new FormControl<FormalDecisionOutcome | ''>('', { nonNullable: true }),
    archiveScope: new FormControl<'ACTIVE' | 'ARCHIVED' | 'ALL'>('ACTIVE', { nonNullable: true }),
    sort: new FormControl<PortfolioSort>('RECENTLY_UPDATED', { nonNullable: true }),
  });
  readonly viewName = new FormControl('', { nonNullable: true });
  readonly healthOptions = [
    { value: 'ON_TRACK' as const, label: 'Terv szerint' },
    { value: 'AT_RISK' as const, label: 'Kockázatos' },
    { value: 'BLOCKED' as const, label: 'Blokkolt' },
  ];
  readonly decisionOptions = [
    { value: 'GO' as const, label: 'Mehet' },
    { value: 'CONDITIONAL_GO' as const, label: 'Feltételesen mehet' },
    { value: 'NO_GO' as const, label: 'Nem mehet' },
  ];
  readonly sortOptions = [
    { value: 'RECENTLY_UPDATED' as const, label: 'Legutóbb frissített' },
    { value: 'NAME' as const, label: 'Név' },
    { value: 'DUE_DATE' as const, label: 'Határidő' },
    { value: 'READINESS_DESC' as const, label: 'Felkészültség' },
    { value: 'DECISION_SCORE_DESC' as const, label: 'Döntési pontszám' },
  ];
  readonly progressLabel = projectWorkProgressLabel;
  readonly actionFragment = projectActionFragment;

  ngOnInit(): void {
    this.loadSavedViews();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const query = queryFromParams(params);
      this.filterForm.reset({
        search: query.search ?? '',
        health: query.health ?? '',
        decision: query.decision ?? '',
        archiveScope: query.archiveScope ?? 'ACTIVE',
        sort: query.sort ?? 'RECENTLY_UPDATED',
      });
      this.loadProjects(query);
    });
    this.loadMailboxStatus();
  }

  projectRoute(entry: PortfolioRow): readonly string[] {
    return entry.workState
      ? projectActionRoute(entry.project.id, entry.workState.primaryAction.target)
      : ['/projects', entry.project.id, 'status'];
  }

  portfolioStatusLabel(entry: PortfolioRow): string {
    return entry.latestStatus
      ? this.healthLabel(entry.latestStatus.health)
      : entry.workState?.preparationStatus.label ?? this.statusLabel(entry.project.status);
  }

  healthLabel(health: ProjectHealth): string {
    return this.healthOptions.find((option) => option.value === health)?.label ?? health;
  }

  decisionLabel(outcome: FormalDecisionOutcome): string {
    return this.decisionOptions.find((option) => option.value === outcome)?.label ?? outcome;
  }

  applyFilters(): void {
    void this.navigate(this.queryFromForm(), 1);
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '', health: '', decision: '', archiveScope: 'ACTIVE', sort: 'RECENTLY_UPDATED',
    });
    void this.navigate(this.queryFromForm(), 1);
  }

  goToPage(page: number): void {
    if (page < 1 || page > (this.portfolio()?.pageCount ?? 1)) return;
    void this.navigate(this.queryFromForm(), page);
  }

  saveCurrentView(): void {
    const name = this.viewName.value.trim();
    if (!name) return;
    const next = [
      ...this.savedViews().filter((view) => view.name.toLocaleLowerCase('hu') !== name.toLocaleLowerCase('hu')),
      { name, query: this.queryFromForm() },
    ].sort((left, right) => left.name.localeCompare(right.name, 'hu'));
    if (!this.writeSavedViews(next)) return;
    this.savedViews.set(next);
    this.viewName.setValue('');
    this.viewFeedback.set(`A(z) „${name}” nézet elmentve ebben a böngészőben.`);
  }

  applySavedView(event: Event): void {
    const name = (event.target as HTMLSelectElement).value;
    const view = this.savedViews().find((candidate) => candidate.name === name);
    if (view) void this.navigate(view.query, 1);
    (event.target as HTMLSelectElement).value = '';
  }

  deleteSavedView(name: string): void {
    const next = this.savedViews().filter((view) => view.name !== name);
    if (this.writeSavedViews(next)) this.savedViews.set(next);
  }

  loadMailboxStatus(): void {
    this.mailboxLoading.set(true);
    this.mailboxError.set(null);
    this.mailboxApi.status().subscribe({
      next: (status) => {
        this.mailboxStatus.set(status);
        this.mailboxLoading.set(false);
      },
      error: (error: Error) => {
        this.mailboxError.set(error.message);
        this.mailboxLoading.set(false);
      },
    });
  }

  refreshMailbox(): void {
    if (this.mailboxRefreshing()) return;
    this.mailboxRefreshing.set(true);
    this.mailboxError.set(null);
    this.mailboxApi.refresh().subscribe({
      next: (status) => {
        this.mailboxStatus.set(status);
        this.mailboxRefreshing.set(false);
        this.loadProjects(queryFromParams(this.route.snapshot.queryParamMap));
      },
      error: (error: Error) => {
        this.mailboxError.set(error.message);
        this.mailboxRefreshing.set(false);
      },
    });
  }

  mailboxStateLabel(state: CustomerMailboxSyncState): string {
    const labels: Record<CustomerMailboxSyncState, string> = {
      NOT_CONFIGURED: 'Postafiók nincs konfigurálva',
      INITIALIZING: 'Postafiók kapcsolódása folyamatban',
      CURRENT: 'Postafiók naprakész',
      DELAYED: 'Postafiók-szinkron késik',
      UNAVAILABLE: 'Postafiók átmenetileg nem érhető el',
      CONFIGURATION_ERROR: 'Postafiók-beállítás javítandó',
      AUTHORIZATION_ERROR: 'Postafiók-jogosultság javítandó',
    };
    return labels[state];
  }

  loadProjects(query: PortfolioQuery = this.queryFromForm()): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.portfolioApi.portfolio({ ...query, pageSize: 20 }).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (portfolio) => {
        this.portfolio.set(portfolio);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  private queryFromForm(): PortfolioQuery {
    const value = this.filterForm.getRawValue();
    return {
      search: value.search.trim() || undefined,
      health: value.health || undefined,
      decision: value.decision || undefined,
      archiveScope: value.archiveScope,
      sort: value.sort,
    };
  }

  private navigate(query: PortfolioQuery, page: number): Promise<boolean> {
    return this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        q: query.search || null,
        health: query.health || null,
        decision: query.decision || null,
        archiveScope: query.archiveScope === 'ACTIVE' ? null : query.archiveScope,
        sort: query.sort === 'RECENTLY_UPDATED' ? null : query.sort,
        page: page > 1 ? page : null,
      },
    });
  }

  private loadSavedViews(): void {
    const key = this.savedViewsKey();
    if (!key) return;
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) ?? '[]') as unknown;
      if (Array.isArray(parsed)) {
        this.savedViews.set(parsed.filter(isSavedPortfolioView));
      }
    } catch {
      this.savedViews.set([]);
    }
  }

  private writeSavedViews(views: readonly SavedPortfolioView[]): boolean {
    const key = this.savedViewsKey();
    if (!key) return false;
    try {
      window.localStorage.setItem(key, JSON.stringify(views));
      return true;
    } catch {
      this.viewFeedback.set('A böngésző nem engedte elmenteni ezt a nézetet.');
      return false;
    }
  }

  private savedViewsKey(): string | null {
    const userId = this.auth.currentUser()?.id;
    return userId ? `project-maker:portfolio-views:${userId}` : null;
  }
}

function queryFromParams(params: import('@angular/router').ParamMap): PortfolioQuery {
  const health = known(params.get('health'), ['ON_TRACK', 'AT_RISK', 'BLOCKED'] as const);
  const decision = known(params.get('decision'), ['GO', 'CONDITIONAL_GO', 'NO_GO'] as const);
  const archiveScope = known(params.get('archiveScope'), ['ACTIVE', 'ARCHIVED', 'ALL'] as const);
  const sort = known(params.get('sort'), [
    'RECENTLY_UPDATED', 'NAME', 'DUE_DATE', 'READINESS_DESC', 'DECISION_SCORE_DESC',
  ] as const);
  const page = Number(params.get('page'));
  return {
    search: params.get('q')?.trim() || undefined,
    health,
    decision,
    archiveScope: archiveScope ?? 'ACTIVE',
    sort: sort ?? 'RECENTLY_UPDATED',
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

function known<const Value extends string>(value: string | null, values: readonly Value[]): Value | undefined {
  return value && values.includes(value as Value) ? value as Value : undefined;
}

function isSavedPortfolioView(value: unknown): value is SavedPortfolioView {
  return typeof value === 'object' && value !== null &&
    typeof (value as { name?: unknown }).name === 'string' &&
    typeof (value as { query?: unknown }).query === 'object' &&
    (value as { query?: unknown }).query !== null;
}
