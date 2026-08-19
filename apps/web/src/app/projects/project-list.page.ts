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
  ProjectPortfolioEntry,
} from '@project-maker/contracts';

import { ProjectApiService } from './project-api.service';
import { CustomerMailboxSyncApiService } from './customer-mailbox-sync-api.service';
import { projectActionFragment, projectActionRoute } from './project-action-route';
import { projectStatusLabel } from './project-status-label';
import { projectWorkProgressLabel } from './project-work-progress-label';

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

  readonly projects = signal<readonly ProjectPortfolioEntry[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly statusLabel = projectStatusLabel;
  readonly projectContextQueryParams = { returnTo: '/' } as const;
  readonly mailboxStatus = signal<CustomerMailboxSyncStatus | null>(null);
  readonly mailboxLoading = signal(true);
  readonly mailboxRefreshing = signal(false);
  readonly mailboxError = signal<string | null>(null);

  projectRoute(entry: ProjectPortfolioEntry): readonly string[] {
    return entry.workState
      ? projectActionRoute(entry.project.id, entry.workState.primaryAction.target)
      : ['/projects', entry.project.id, 'status'];
  }

  portfolioStatusLabel(entry: ProjectPortfolioEntry): string {
    return entry.workState
      ? entry.workState.preparationStatus.label
      : this.statusLabel(entry.project.status);
  }

  readonly progressLabel = projectWorkProgressLabel;
  readonly actionFragment = projectActionFragment;

  ngOnInit(): void {
    this.loadProjects();
    this.loadMailboxStatus();
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
        this.loadProjects();
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

  loadProjects(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.loadPortfolio().subscribe({
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
