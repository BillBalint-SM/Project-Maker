import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import type {
  ProjectActivityFeed,
  ProjectPreparationActionTarget,
  ProjectPreparationStatus,
  ProjectWorkspace,
} from '@project-maker/contracts';

import { ProjectApiService } from './project-api.service';

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
  readonly preparationStatus = signal<ProjectPreparationStatus | null>(null);
  readonly coordinationLoading = signal(true);
  readonly coordinationError = signal<string | null>(null);
  readonly project = signal<ProjectWorkspace | null>(null);
  readonly activityLoading = signal(true);
  readonly activityError = signal<string | null>(null);
  readonly activity = signal<ProjectActivityFeed | null>(null);
  readonly primaryActionRoute = computed(() => {
    const preparationStatus = this.preparationStatus();
    if (!preparationStatus) {
      return null;
    }
    return actionRoute(this.projectId, preparationStatus.primaryAction.target);
  });

  ngOnInit(): void {
    this.loadStatus();
    this.loadCoordination();
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
    this.preparationStatus.set(null);
    this.api.loadPreparationStatus(this.projectId).subscribe({
      next: (preparationStatus) => {
        this.preparationStatus.set(preparationStatus);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  loadCoordination(): void {
    if (!this.projectId) {
      this.coordinationError.set('A projekt azonosítója hiányzik az útvonalból.');
      this.coordinationLoading.set(false);
      return;
    }

    this.coordinationLoading.set(true);
    this.coordinationError.set(null);
    this.project.set(null);
    this.api.loadProjectWorkspace(this.projectId).subscribe({
      next: (project) => {
        this.project.set(project);
        this.coordinationLoading.set(false);
      },
      error: (error: Error) => {
        this.coordinationError.set(error.message);
        this.coordinationLoading.set(false);
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

function actionRoute(
  projectId: string,
  target: ProjectPreparationActionTarget,
): readonly string[] {
  switch (target) {
    case 'INTERVIEW':
      return ['/projects', projectId, 'interview'];
    case 'READINESS':
      return ['/projects', projectId, 'readiness'];
    case 'DECISION_REVIEW':
      return ['/projects', projectId, 'decision-review'];
  }
}
