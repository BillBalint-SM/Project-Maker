import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import type {
  CustomerMailboxSyncState,
  CustomerMailboxSyncStatus,
  ProjectPreparationStatus,
  ProjectWorkspace,
} from '@project-maker/contracts';
import { forkJoin, map, of, switchMap } from 'rxjs';

import { ProjectApiService } from './project-api.service';
import { CustomerMailboxSyncApiService } from './customer-mailbox-sync-api.service';
import { CustomerRepliesApiService } from './customer-replies-api.service';
import { projectStatusLabel } from './project-status-label';

@Component({
  selector: 'app-project-list-page',
  imports: [
    ButtonModule,
    CardModule,
    DatePipe,
    MessageModule,
    ProgressSpinnerModule,
    RouterLink,
    TagModule,
  ],
  templateUrl: './project-list.page.html',
  styleUrl: './project-list.page.scss',
})
export class ProjectListPage implements OnInit {
  private readonly api = inject(ProjectApiService);
  private readonly mailboxApi = inject(CustomerMailboxSyncApiService);
  private readonly repliesApi = inject(CustomerRepliesApiService);

  readonly projects = signal<readonly PortfolioProject[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly statusLabel = projectStatusLabel;
  readonly mailboxStatus = signal<CustomerMailboxSyncStatus | null>(null);
  readonly mailboxLoading = signal(true);
  readonly mailboxRefreshing = signal(false);
  readonly mailboxError = signal<string | null>(null);
  readonly projectReplyCounts = signal<ReadonlyMap<string, number>>(new Map());

  projectRoute(entry: PortfolioProject): readonly string[] {
    if (this.replyCount(entry.project.id) > 0) {
      return ['/projects', entry.project.id, 'customer-correspondences'];
    }
    return entry.preparationStatus?.state === 'SCHEMA_REQUIRED'
      ? ['/projects', entry.project.id, 'interview']
      : ['/projects', entry.project.id, 'status'];
  }

  portfolioStatusLabel(entry: PortfolioProject): string {
    return entry.preparationStatus?.state === 'SCHEMA_REQUIRED'
      ? entry.preparationStatus.label
      : this.statusLabel(entry.project.status);
  }

  ngOnInit(): void {
    this.loadProjects();
    this.loadMailboxStatus();
    this.loadReplySummary();
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
        this.loadReplySummary();
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

  replyCount(projectId: string): number {
    return this.projectReplyCounts().get(projectId) ?? 0;
  }

  private loadReplySummary(): void {
    this.repliesApi.summary().subscribe({
      next: (summary) => this.projectReplyCounts.set(
        new Map(summary.projects.map((project) => [project.projectId, project.newReplyCount])),
      ),
      error: () => undefined,
    });
  }

  loadProjects(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.listProjects().pipe(
      switchMap((projects) => {
        if (projects.length === 0) {
          return of([] as readonly PortfolioProject[]);
        }
        return forkJoin(
          projects.map((project) =>
            project.status === 'ARCHIVED'
              ? of({ project, preparationStatus: null })
              : this.api.loadPreparationStatus(project.id).pipe(
                  map((preparationStatus) => ({ project, preparationStatus })),
                ),
          ),
        );
      }),
    ).subscribe({
      next: (projects) => {
        this.projects.set(projects);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

}

interface PortfolioProject {
  readonly project: ProjectWorkspace;
  readonly preparationStatus: ProjectPreparationStatus | null;
}
