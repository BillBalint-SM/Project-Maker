import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import type { ProjectPreparationActionTarget, ProjectPreparationStatus } from '@project-maker/contracts';

import { ProjectApiService } from './project-api.service';

@Component({
  selector: 'app-project-status-page',
  imports: [ButtonModule, CardModule, MessageModule, ProgressSpinnerModule, RouterLink],
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
  readonly primaryActionRoute = computed(() => {
    const preparationStatus = this.preparationStatus();
    if (!preparationStatus) {
      return null;
    }
    return actionRoute(this.projectId, preparationStatus.primaryAction.target);
  });

  ngOnInit(): void {
    this.loadStatus();
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
