import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type {
  AuditEventPage,
  CreateProjectInput,
  ProjectCockpit,
  ProjectActivityFeed,
  ProjectPreparationStatus,
  ProjectWorkspace,
  UpdateProjectBasicsInput,
} from '@project-maker/contracts';

import {
  UpdateProjectWorkspaceInput,
} from './project-api.models';
import type { CockpitView } from './project-api.models';

@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly http = inject(HttpClient);

  loadAuditEvents(projectId: string, offset: number): Observable<AuditEventPage> {
    const params = new HttpParams()
      .set('offset', String(offset))
      .set('limit', '10');
    return this.http
      .get<AuditEventPage>(
        `/api/projects/${encodeURIComponent(projectId)}/audit-events`,
        { params },
      )
      .pipe(catchError((error: unknown) => this.fail(error, 'load audit history')));
  }

  listProjects(): Observable<readonly ProjectWorkspace[]> {
    return this.http
      .get<readonly ProjectWorkspace[]>('/api/projects')
      .pipe(catchError((error: unknown) => this.fail(error, 'load projects')));
  }

  createProject(input: CreateProjectInput): Observable<ProjectWorkspace> {
    return this.http
      .post<ProjectWorkspace>('/api/projects', input)
      .pipe(catchError((error: unknown) => this.fail(error, 'create the project')));
  }

  updateProjectBasics(
    projectId: string,
    input: UpdateProjectBasicsInput,
  ): Observable<ProjectWorkspace> {
    return this.http
      .patch<ProjectWorkspace>(
        `/api/projects/${encodeURIComponent(projectId)}/basics`,
        input,
      )
      .pipe(catchError((error: unknown) => this.fail(error, 'save the project basics')));
  }

  loadCockpit(projectId: string): Observable<CockpitView> {
    const encodedProjectId = encodeURIComponent(projectId);
    return forkJoin({
      cockpit: this.http.get<ProjectCockpit>(
        `/api/projects/${encodedProjectId}/cockpit`,
      ),
      projects: this.http.get<readonly ProjectWorkspace[]>('/api/projects'),
    }).pipe(
      map(({ cockpit, projects }) => {
        const project = projects.find((candidate) => candidate.id === projectId);
        if (!project) {
          throw new Error(
            'The cockpit loaded, but its project is missing from the project list. Refresh the page; if the problem continues, check the API data.',
          );
        }
        return { cockpit, project };
      }),
      catchError((error: unknown) => this.fail(error, 'load the project cockpit')),
    );
  }

  loadPreparationStatus(projectId: string): Observable<ProjectPreparationStatus> {
    return this.http
      .get<ProjectPreparationStatus>(
        `/api/projects/${encodeURIComponent(projectId)}/preparation-status`,
      )
      .pipe(
        catchError((error: unknown) =>
          this.fail(error, 'load the project preparation status'),
        ),
      );
  }

  loadProjectActivity(projectId: string): Observable<ProjectActivityFeed> {
    return this.http
      .get<ProjectActivityFeed>(`/api/projects/${encodeURIComponent(projectId)}/activity`)
      .pipe(catchError((error: unknown) => this.fail(error, 'load recent project activity')));
  }

  loadProjectWorkspace(projectId: string): Observable<ProjectWorkspace> {
    return this.listProjects().pipe(
      map((projects) => {
        const project = projects.find((candidate) => candidate.id === projectId);
        if (!project) {
          throw new Error('A projekt nem található. Térj vissza a projektlistához, és ellenőrizd újra.');
        }
        return project;
      }),
      catchError((error: unknown) => this.fail(error, 'load the project coordination details')),
    );
  }

  updateWorkspace(
    projectId: string,
    input: UpdateProjectWorkspaceInput,
  ): Observable<ProjectWorkspace> {
    return this.http
      .patch<ProjectWorkspace>(
        `/api/projects/${encodeURIComponent(projectId)}/workspace`,
        input,
      )
      .pipe(catchError((error: unknown) => this.fail(error, 'save the workspace')));
  }

  deleteProject(projectId: string): Observable<void> {
    return this.http
      .delete<void>(`/api/projects/${encodeURIComponent(projectId)}`)
      .pipe(catchError((error: unknown) => this.fail(error, 'delete the project')));
  }

  archiveProject(projectId: string): Observable<ProjectWorkspace> {
    return this.http
      .post<ProjectWorkspace>(
        `/api/projects/${encodeURIComponent(projectId)}/archive`,
        {},
      )
      .pipe(catchError((error: unknown) => this.fail(error, 'archive the project')));
  }

  restoreProject(projectId: string): Observable<ProjectWorkspace> {
    return this.http
      .post<ProjectWorkspace>(
        `/api/projects/${encodeURIComponent(projectId)}/restore`,
        {},
      )
      .pipe(catchError((error: unknown) => this.fail(error, 'restore the project')));
  }

  private fail(error: unknown, action: string): Observable<never> {
    const mapped = toActionableError(error, action);
    if (mapped.diagnostics) {
      console.error('Project API request failed.', mapped.diagnostics);
    }
    return throwError(() => new Error(mapped.userMessage));
  }
}

interface ActionableError {
  readonly userMessage: string;
  readonly diagnostics: { readonly action: string; readonly status: number; readonly statusText: string } | null;
}

function toActionableError(error: unknown, action: string): ActionableError {
  if (!(error instanceof HttpErrorResponse)) {
    if (error instanceof Error) {
      return { userMessage: error.message, diagnostics: null };
    }
    return {
      userMessage: `Could not ${action}. Refresh the page and try again.`,
      diagnostics: null,
    };
  }

  if (error.status === 0) {
    return {
      userMessage: `Could not ${action} because the API is unreachable. Check that the server is running, then try again.`,
      diagnostics: { action, status: error.status, statusText: error.statusText },
    };
  }

  const nextStep = projectErrorNextStep(error.status, action);
  return {
    userMessage: `Could not ${action} (HTTP ${error.status}). ${nextStep}`,
    diagnostics: { action, status: error.status, statusText: error.statusText },
  };
}

function projectErrorNextStep(status: number, action: string): string {
  if (status === 409) {
    if (action === 'delete the project') {
      return 'The project now has persisted activity and cannot be deleted. Archive it instead.';
    }
    return 'Refresh the project to see its latest lifecycle state.';
  }

  if (status === 503) {
    return 'Review the entered values and try again.';
  }

  if (status === 404) {
    return 'Return to the project list and confirm that the project still exists.';
  }

  return 'Review the entered values and try again.';
}
