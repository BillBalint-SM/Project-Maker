import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import type { ProjectStatus } from '@project-maker/contracts';
import { ButtonModule } from 'primeng/button';

import { DiscoveryFollowUpsComponent } from './discovery-follow-ups/discovery-follow-ups.component';
import { ProjectApiService } from './project-api.service';
import { ReadinessReviewComponent } from './readiness-review/readiness-review.component';

@Component({
  selector: 'app-readiness-page',
  imports: [ButtonModule, DiscoveryFollowUpsComponent, ReadinessReviewComponent],
  templateUrl: './readiness.page.html',
  styleUrl: './readiness.page.scss',
})
export class ReadinessPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ProjectApiService);

  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  readonly reviewFollowUpId = this.route.snapshot.queryParamMap.get('reviewFollowUpId');
  readonly reviewFollowUpVersion = this.route.snapshot.queryParamMap.get('reviewFollowUpVersion');
  readonly reviewCorrespondenceId = this.route.snapshot.queryParamMap.get('reviewCorrespondenceId');
  readonly projectStatus = signal<ProjectStatus | null>(null);
  readonly projectStatusLoading = signal(true);
  readonly projectStatusError = signal<string | null>(null);
  readonly readinessRefreshKey = signal(0);

  ngOnInit(): void {
    this.loadProjectStatus();
  }

  loadProjectStatus(): void {
    this.projectStatusLoading.set(true);
    this.projectStatusError.set(null);
    this.api.loadProjectWorkspace(this.projectId).subscribe({
      next: (project) => {
        this.projectStatus.set(project.status);
        this.projectStatusLoading.set(false);
      },
      error: (error: Error) => {
        this.projectStatusError.set(error.message);
        this.projectStatusLoading.set(false);
      },
    });
  }

  refreshReadiness(): void {
    this.readinessRefreshKey.update((value) => value + 1);
  }
}
