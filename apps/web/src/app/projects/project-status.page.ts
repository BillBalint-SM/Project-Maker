import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import type {
  ProjectActivityFeed,
  ProjectWorkState,
  ProjectWorkspace,
} from '@project-maker/contracts';

import { ProjectApiService } from './project-api.service';
import { projectActionFragment, projectActionRoute } from './project-action-route';
import { projectWorkProgressLabel } from './project-work-progress-label';

@Component({
  selector: 'app-project-status-page',
  imports: [
    ButtonModule,
    CardModule,
    DatePipe,
    MessageModule,
    ProgressSpinnerModule,
    RouterLink,
  ],
  templateUrl: './project-status.page.html',
  styleUrl: './project-status.page.scss',
})
export class ProjectStatusPage implements OnInit {
  private readonly api = inject(ProjectApiService);
  private readonly route = inject(ActivatedRoute);

  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly workState = signal<ProjectWorkState | null>(null);
  readonly customerMetadataLoading = signal(true);
  readonly customerMetadataError = signal<string | null>(null);
  readonly customerMetadata = signal<ProjectWorkspace | null>(null);
  readonly activityLoading = signal(true);
  readonly activityError = signal<string | null>(null);
  readonly activity = signal<ProjectActivityFeed | null>(null);
  readonly primaryActionRoute = computed(() => {
    const workState = this.workState();
    if (!workState) {
      return null;
    }
    return projectActionRoute(this.projectId, workState.primaryAction.target);
  });

  readonly progressLabel = projectWorkProgressLabel;
  readonly actionFragment = projectActionFragment;

  ngOnInit(): void {
    this.loadStatus();
    this.loadCustomerMetadata();
    this.loadActivity();
  }

  loadStatus(): void {
    if (!this.projectId) {
      this.loadError.set('A projekt azonosítója hiányzik az útvonalból.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.loadError.set(null);
    this.workState.set(null);
    this.api.loadWorkState(this.projectId).subscribe({
      next: (workState) => {
        this.workState.set(workState);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  loadCustomerMetadata(): void {
    if (!this.projectId) {
      this.customerMetadataError.set('A projekt azonosítója hiányzik az útvonalból.');
      this.customerMetadataLoading.set(false);
      return;
    }

    this.customerMetadataLoading.set(true);
    this.customerMetadataError.set(null);
    this.customerMetadata.set(null);
    this.api.loadProjectWorkspace(this.projectId).subscribe({
      next: (project) => {
        this.customerMetadata.set(project);
        this.customerMetadataLoading.set(false);
      },
      error: (error: Error) => {
        this.customerMetadataError.set(error.message);
        this.customerMetadataLoading.set(false);
      },
    });
  }

  loadActivity(): void {
    if (!this.projectId) {
      this.activityError.set('A projekt azonosítója hiányzik az útvonalból.');
      this.activityLoading.set(false);
      return;
    }

    this.activityLoading.set(true);
    this.activityError.set(null);
    this.activity.set(null);
    this.api.loadProjectActivity(this.projectId).subscribe({
      next: (activity) => {
        this.activity.set(activity);
        this.activityLoading.set(false);
      },
      error: (error: Error) => {
        this.activityError.set(error.message);
        this.activityLoading.set(false);
      },
    });
  }
}
