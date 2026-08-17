import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TagModule } from 'primeng/tag';
import type { ProjectPreparationStatus, ProjectWorkspace } from '@project-maker/contracts';
import { forkJoin, map, of, switchMap } from 'rxjs';

import { ProjectApiService } from './project-api.service';
import { projectStatusLabel } from './project-status-label';

@Component({
  selector: 'app-project-list-page',
  imports: [
    ButtonModule,
    CardModule,
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

  readonly projects = signal<readonly PortfolioProject[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly statusLabel = projectStatusLabel;

  projectRoute(entry: PortfolioProject): readonly string[] {
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
