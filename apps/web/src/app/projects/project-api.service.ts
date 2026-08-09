import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type {
  AuditEventPage,
  CustomerEmailDelivery,
  CustomerFollowUpState,
  CreateDiscoveryFollowUpInput,
  CreateProjectInput,
  DiscoveryFollowUp,
  ProjectCockpit,
  ProjectWorkspace,
  ResolveDiscoveryFollowUpInput,
  SendCustomerReviewEmailInput,
  SendFollowUpPingInput,
  UpdateCustomerFollowUpInput,
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

  loadCockpit(projectId: string): Observable<CockpitView> {
    const encodedProjectId = encodeURIComponent(projectId);
    return forkJoin({
      cockpit: this.http.get<ProjectCockpit>(
        `/api/projects/${encodedProjectId}/cockpit`,
      ),
      projects: this.http.get<readonly ProjectWorkspace[]>('/api/projects'),
      followUp: this.http
        .get<CustomerFollowUpState>(
          `/api/projects/${encodedProjectId}/follow-up`,
        )
        .pipe(
          catchError((error: unknown) =>
            this.fail(error, 'load project follow-up settings'),
          ),
        ),
      discoveryFollowUps: this.http
        .get<readonly DiscoveryFollowUp[]>(
          `/api/projects/${encodedProjectId}/discovery-follow-ups`,
        )
        .pipe(
          catchError((error: unknown) =>
            this.fail(error, 'load discovery follow-ups'),
          ),
        ),
    }).pipe(
      map(({ cockpit, projects, followUp, discoveryFollowUps }) => {
        const project = projects.find((candidate) => candidate.id === projectId);
        if (!project) {
          throw new Error(
            'The cockpit loaded, but its project is missing from the project list. Refresh the page; if the problem continues, check the API data.',
          );
        }
        return { cockpit, project, followUp, discoveryFollowUps };
      }),
      catchError((error: unknown) => this.fail(error, 'load the project cockpit')),
    );
  }

  updateFollowUp(
    projectId: string,
    input: UpdateCustomerFollowUpInput,
  ): Observable<CustomerFollowUpState> {
    return this.http
      .patch<CustomerFollowUpState>(
        `/api/projects/${encodeURIComponent(projectId)}/follow-up`,
        input,
      )
      .pipe(
        catchError((error: unknown) =>
          this.fail(error, 'save follow-up settings'),
        ),
      );
  }

  createDiscoveryFollowUp(
    projectId: string,
    input: CreateDiscoveryFollowUpInput,
  ): Observable<DiscoveryFollowUp> {
    return this.http
      .post<DiscoveryFollowUp>(
        `/api/projects/${encodeURIComponent(projectId)}/discovery-follow-ups`,
        input,
      )
      .pipe(
        catchError((error: unknown) =>
          this.fail(error, 'create a discovery follow-up'),
        ),
      );
  }

  resolveDiscoveryFollowUp(
    projectId: string,
    followUpId: string,
    input: ResolveDiscoveryFollowUpInput,
  ): Observable<DiscoveryFollowUp> {
    return this.http
      .post<DiscoveryFollowUp>(
        '/api/projects/' +
          encodeURIComponent(projectId) +
          '/discovery-follow-ups/' +
          encodeURIComponent(followUpId) +
          '/resolve',
        input,
      )
      .pipe(
        catchError((error: unknown) =>
          this.fail(error, 'resolve a discovery follow-up'),
        ),
      );
  }

  sendFollowUpPing(
    projectId: string,
    input?: SendFollowUpPingInput,
  ): Observable<CustomerFollowUpState> {
    return this.http
      .post<CustomerFollowUpState>(
        `/api/projects/${encodeURIComponent(projectId)}/follow-up/ping`,
        input ?? {},
      )
      .pipe(
        catchError((error: unknown) =>
          this.fail(error, 'send a follow-up ping'),
        ),
      );
  }

  sendCustomerReviewEmail(
    projectId: string,
    input?: SendCustomerReviewEmailInput,
  ): Observable<CustomerEmailDelivery> {
    return this.http
      .post<CustomerEmailDelivery>(
        `/api/projects/${encodeURIComponent(projectId)}/customer-review-email`,
        input ?? {},
      )
      .pipe(
        catchError((error: unknown) =>
          this.fail(error, 'send the customer review email'),
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

  const nextStep = followUpErrorNextStep(error.status, action);
  return {
    userMessage: `Could not ${action} (HTTP ${error.status}). ${nextStep}`,
    diagnostics: { action, status: error.status, statusText: error.statusText },
  };
}

function followUpErrorNextStep(status: number, action: string): string {
  if (status === 409) {
    if (action === 'delete the project') {
      return 'The project now has persisted activity and cannot be deleted. Archive it instead.';
    }
    if (action === 'save follow-up settings') {
      return 'The project may be archived or changed. Refresh the cockpit and try again.';
    }
    if (action === 'send a follow-up ping') {
      return 'The project may be archived or changed. Refresh the cockpit, then try again.';
    }
    if (action === 'send the customer review email') {
      return 'The project may be archived or have no Markdown revision. Open Markdown or restore the project, then try again.';
    }
    if (action === 'create a discovery follow-up') {
      return 'The project may be archived or changed. Refresh the cockpit and try again.';
    }
    return 'Refresh the project to see its latest lifecycle state.';
  }

  if (status === 503) {
    if (
      action === 'send a follow-up ping' ||
      action === 'send the customer review email'
    ) {
      return 'Customer email delivery is unavailable. Check the API email configuration, then try again.';
    }
    return 'Review the entered values and try again.';
  }

  if (status === 404) {
    return 'Return to the project list and confirm that the project still exists.';
  }

  if (action === 'save follow-up settings') {
    return 'Use a whole-number cadence from 1 to 525,600 minutes and a future expiry, then try again.';
  }
  if (status === 400 && action === 'create a discovery follow-up') {
    return 'Choose a category, enter the required text, and use a real due date, then try again.';
  }
  return 'Review the entered values and try again.';
}
