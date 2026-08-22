import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type {
  CreateProjectInput,
  ProjectActivityFeed,
  ProjectPortfolioEntry,
  ProjectPreparationStatus,
  ProjectWorkState,
  ProjectWorkspace,
  PackagedPlaybookSummary,
  UpdateProjectPlaybookInput,
  UpdateProjectBasicsInput,
} from '@project-maker/contracts';

import {
  UpdateProjectWorkspaceInput,
} from './project-api.models';
import type { ProjectSettingsView } from './project-api.models';

@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly http = inject(HttpClient);

  listProjects(): Observable<readonly ProjectWorkspace[]> {
    return this.http
      .get<readonly ProjectWorkspace[]>('/api/projects')
      .pipe(catchError((error: unknown) => this.fail(error, 'load the projects')));
  }

  loadPortfolio(): Observable<readonly ProjectPortfolioEntry[]> {
    return this.http
      .get<readonly ProjectPortfolioEntry[]>('/api/projects/portfolio')
      .pipe(catchError((error: unknown) => this.fail(error, 'load the Project Portfolio')));
  }

  createProject(input: CreateProjectInput): Observable<ProjectWorkspace> {
    return this.http
      .post<ProjectWorkspace>('/api/projects', input)
      .pipe(catchError((error: unknown) => this.fail(error, 'create the project')));
  }

  listPlaybooks(): Observable<readonly PackagedPlaybookSummary[]> {
    return this.http
      .get<readonly PackagedPlaybookSummary[]>('/api/playbooks')
      .pipe(catchError((error: unknown) => this.fail(error, 'load the playbooks')));
  }

  updateProjectPlaybook(
    projectId: string,
    input: UpdateProjectPlaybookInput,
  ): Observable<ProjectWorkspace> {
    return this.http
      .put<ProjectWorkspace>(`/api/projects/${encodeURIComponent(projectId)}/playbook`, input)
      .pipe(catchError((error: unknown) => this.fail(error, 'save the project playbook')));
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

  loadProjectSettings(projectId: string): Observable<ProjectSettingsView> {
    return forkJoin({
      project: this.loadProjectWorkspace(projectId),
      preparationStatus: this.loadPreparationStatus(projectId),
    }).pipe(
      catchError((error: unknown) => this.fail(error, 'load Project Settings')),
    );
  }

  loadPreparationStatus(projectId: string): Observable<ProjectPreparationStatus> {
    return this.http
      .get<ProjectPreparationStatus>(
        `/api/projects/${encodeURIComponent(projectId)}/preparation-status`,
      )
      .pipe(
        catchError((error: unknown) =>
          this.fail(error, 'load the project preparation state'),
        ),
      );
  }

  loadWorkState(projectId: string): Observable<ProjectWorkState> {
    return this.http
      .get<ProjectWorkState>(`/api/projects/${encodeURIComponent(projectId)}/work-state`)
      .pipe(catchError((error: unknown) => this.fail(error, 'load the project work state')));
  }

  loadProjectActivity(projectId: string): Observable<ProjectActivityFeed> {
    return this.http
      .get<ProjectActivityFeed>(`/api/projects/${encodeURIComponent(projectId)}/activity`)
      .pipe(catchError((error: unknown) => this.fail(error, 'load the latest project activity')));
  }

  loadProjectWorkspace(projectId: string): Observable<ProjectWorkspace> {
    return this.listProjects().pipe(
      map((projects) => {
        const project = projects.find((candidate) => candidate.id === projectId);
        if (!project) {
          throw new Error('The project was not found. Return to the Project Portfolio and check again.');
        }
        return project;
      }),
      catchError((error: unknown) =>
        this.fail(error, 'load the project coordination data'),
      ),
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
      .pipe(catchError((error: unknown) => this.fail(error, 'save project coordination')));
  }

  deleteProject(projectId: string): Observable<void> {
    return this.http
      .delete<void>(`/api/projects/${encodeURIComponent(projectId)}`)
      .pipe(catchError((error: unknown) => this.fail(error, deleteProjectAction)));
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

const deleteProjectAction = 'permanently delete the project';

function toActionableError(error: unknown, action: string): ActionableError {
  if (!(error instanceof HttpErrorResponse)) {
    return {
      userMessage: `Unable to ${action}. Refresh the page and try again.`,
      diagnostics: null,
    };
  }

  if (error.status === 0) {
    return {
      userMessage: `Unable to ${action} because the service is unavailable. Check the network connection and try again.`,
      diagnostics: { action, status: error.status, statusText: error.statusText },
    };
  }

  const nextStep = projectErrorNextStep(error.status, action);
  return {
    userMessage: `Unable to ${action}. ${nextStep}`,
    diagnostics: { action, status: error.status, statusText: error.statusText },
  };
}

function projectErrorNextStep(status: number, action: string): string {
  if (status === 409) {
    if (action === deleteProjectAction) {
      return 'Only a DRAFT project can be deleted. Archive the project when Customer correspondence or Git handoff history exists.';
    }
    return 'Reload the project, check its latest state, then repeat the action.';
  }

  if (status === 503) {
    return 'The service is temporarily unavailable. Wait briefly and try again.';
  }

  if (status === 404) {
    return 'Return to the Project Portfolio and check that the project still exists.';
  }

  if (status === 400 || status === 422) {
    return 'Check the submitted values and try again.';
  }

  return 'Refresh the page and try again. If the error persists, contact the Operator organization.';
}
