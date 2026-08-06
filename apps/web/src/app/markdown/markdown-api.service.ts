import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type {
  CreateMarkdownRevisionInput,
  MarkdownRevision,
} from '@project-maker/contracts';

@Injectable({ providedIn: 'root' })
export class MarkdownApiService {
  private readonly http = inject(HttpClient);

  createRevision(
    projectId: string,
    input: CreateMarkdownRevisionInput,
  ): Observable<MarkdownRevision> {
    const encodedProjectId = encodeURIComponent(projectId);
    return this.http
      .post<MarkdownRevision>(
        `/api/projects/${encodedProjectId}/markdown-revisions`,
        input,
      )
      .pipe(catchError((error: unknown) => failApiRequest(error, 'generate the Markdown revision')));
  }

  listRevisions(projectId: string): Observable<readonly MarkdownRevision[]> {
    const encodedProjectId = encodeURIComponent(projectId);
    return this.http
      .get<readonly MarkdownRevision[]>(
        `/api/projects/${encodedProjectId}/markdown-revisions`,
      )
      .pipe(catchError((error: unknown) => failApiRequest(error, 'load Markdown revisions')));
  }

  loadRevision(projectId: string, revisionId: string): Observable<MarkdownRevision> {
    const encodedProjectId = encodeURIComponent(projectId);
    const encodedRevisionId = encodeURIComponent(revisionId);
    return this.http
      .get<MarkdownRevision>(
        `/api/projects/${encodedProjectId}/markdown-revisions/${encodedRevisionId}`,
      )
      .pipe(catchError((error: unknown) => failApiRequest(error, 'load the Markdown revision')));
  }

  downloadUrl(projectId: string, revisionId: string): string {
    const encodedProjectId = encodeURIComponent(projectId);
    const encodedRevisionId = encodeURIComponent(revisionId);
    return `/api/projects/${encodedProjectId}/markdown-revisions/${encodedRevisionId}/download`;
  }
}

interface ApiDiagnostics {
  readonly action: string;
  readonly status: number;
  readonly statusText: string;
}

interface ActionableApiError {
  readonly userMessage: string;
  readonly diagnostics: ApiDiagnostics | null;
}

function failApiRequest(error: unknown, action: string): Observable<never> {
  const mapped = mapApiError(error, action);
  if (mapped.diagnostics) {
    console.error('Markdown API request failed.', mapped.diagnostics);
  }
  return throwError(() => new Error(mapped.userMessage));
}

function mapApiError(error: unknown, action: string): ActionableApiError {
  if (!(error instanceof HttpErrorResponse)) {
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

  const nextStep =
    error.status === 404
      ? 'Confirm that the project or revision still exists.'
      : error.status === 409
        ? 'Refresh the project to see the latest revision state, then try again.'
        : 'Review the selected reason and try again.';
  return {
    userMessage: `Could not ${action} (HTTP ${error.status}). ${nextStep}`,
    diagnostics: { action, status: error.status, statusText: error.statusText },
  };
}
