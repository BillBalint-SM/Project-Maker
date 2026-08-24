import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type {
  CreateMarkdownRevisionInput,
  MarkdownGenerationConfiguration,
  MarkdownRevision,
  MarkdownRevisionSummary,
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
      .pipe(catchError((error: unknown) => failApiRequest(error, 'generate the specification version')));
  }

  loadConfiguration(projectId: string): Observable<MarkdownGenerationConfiguration> {
    const encodedProjectId = encodeURIComponent(projectId);
    return this.http
      .get<MarkdownGenerationConfiguration>(`/api/projects/${encodedProjectId}/markdown-revisions/configuration`)
      .pipe(catchError((error: unknown) => failApiRequest(error, 'load the specification templates')));
  }

  listRevisions(projectId: string): Observable<readonly MarkdownRevisionSummary[]> {
    const encodedProjectId = encodeURIComponent(projectId);
    return this.http
      .get<readonly MarkdownRevisionSummary[]>(
        `/api/projects/${encodedProjectId}/markdown-revisions`,
      )
      .pipe(catchError((error: unknown) => failApiRequest(error, 'load the specification versions')));
  }

  loadRevision(projectId: string, revisionId: string): Observable<MarkdownRevision> {
    const encodedProjectId = encodeURIComponent(projectId);
    const encodedRevisionId = encodeURIComponent(revisionId);
    return this.http
      .get<MarkdownRevision>(
        `/api/projects/${encodedProjectId}/markdown-revisions/${encodedRevisionId}`,
      )
      .pipe(catchError((error: unknown) => failApiRequest(error, 'load the specification version')));
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
      userMessage: `Unable to ${action}. Refresh the page and try again.`,
      diagnostics: null,
    };
  }

  if (error.status === 0) {
    return {
      userMessage: `Unable to ${action} because the service is unavailable. Check the connection and try again.`,
      diagnostics: { action, status: error.status, statusText: error.statusText },
    };
  }

  const nextStep =
    error.status === 404
      ? 'Check that the project or specification version still exists.'
      : error.status === 409
        ? safeMarkdownConflictMessage(error) ??
          'Refresh the project to load the latest specification version, then try again.'
        : 'Check the selected generation reason and try again.';
  return {
    userMessage: `Unable to ${action}. ${nextStep}`,
    diagnostics: { action, status: error.status, statusText: error.statusText },
  };
}

function safeMarkdownConflictMessage(error: HttpErrorResponse): string | null {
  if (!isRecord(error.error)) return null;
  if (error.error['code'] === 'SPECIFICATION_SOURCE_INTEGRITY_ERROR') {
    return 'The Specification source provenance is incomplete. Correct the linked Insight, Evidence, follow-up, or decision source and try again.';
  }
  if (typeof error.error['message'] !== 'string') return null;
  const message = error.error['message'];
  if (message.startsWith('Required template block is unavailable:')) {
    return `${message} Add the named project data and try again.`;
  }
  if (message.startsWith('A specification version cannot be created for an archived project')) {
    return 'A specification version cannot be created for an archived project. Restore the project in Project Settings first.';
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
