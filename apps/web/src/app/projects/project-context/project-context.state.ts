import { inject, Injectable, signal } from '@angular/core';
import type { ProjectWorkState } from '@project-maker/contracts';

import { ProjectApiService } from '../project-api.service';

@Injectable()
export class ProjectContextState {
  private readonly api = inject(ProjectApiService);
  private projectId = '';
  private requestVersion = 0;

  readonly workState = signal<ProjectWorkState | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);

  load(projectId: string): void {
    this.projectId = projectId;
    this.request(projectId, true);
  }

  reload(): void {
    this.request(this.projectId, false);
  }

  private request(projectId: string, clearCurrentState: boolean): void {
    const requestVersion = ++this.requestVersion;
    this.loading.set(true);
    this.loadError.set(null);
    if (clearCurrentState) {
      this.workState.set(null);
    }

    if (!projectId) {
      this.loadError.set('The project identifier is missing from the route.');
      this.loading.set(false);
      return;
    }

    this.api.loadWorkState(projectId).subscribe({
      next: (workState) => {
        if (this.projectId !== projectId || this.requestVersion !== requestVersion) return;
        this.workState.set(workState);
        this.loading.set(false);
      },
      error: (error: Error) => {
        if (this.projectId !== projectId || this.requestVersion !== requestVersion) return;
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }
}
