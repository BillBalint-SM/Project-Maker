import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import type {
  ProjectActivityFeed,
  ProjectWorkspace,
} from '@project-maker/contracts';

import { ProjectContextState } from './project-context/project-context.state';
import { ProjectApiService } from './project-api.service';

@Component({
  selector: 'app-project-status-page',
  imports: [
    ButtonModule,
    CardModule,
    DatePipe,
    RouterLink,
  ],
  templateUrl: './project-status.page.html',
  styleUrl: './project-status.page.scss',
})
export class ProjectStatusPage implements OnInit {
  private readonly api = inject(ProjectApiService);
  private readonly route = inject(ActivatedRoute);
  readonly projectContext = inject(ProjectContextState);

  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  readonly customerMetadataLoading = signal(true);
  readonly customerMetadataError = signal<string | null>(null);
  readonly customerMetadata = signal<ProjectWorkspace | null>(null);
  readonly activityLoading = signal(true);
  readonly activityError = signal<string | null>(null);
  readonly activity = signal<ProjectActivityFeed | null>(null);

  ngOnInit(): void {
    this.loadCustomerMetadata();
    this.loadActivity();
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
