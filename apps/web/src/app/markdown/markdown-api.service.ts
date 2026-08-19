import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type {
  CreateMarkdownRevisionInput,
  MarkdownGenerationConfiguration,
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
      .pipe(catchError((error: unknown) => failApiRequest(error, 'generálni a Markdown-revíziót')));
  }

  loadConfiguration(projectId: string): Observable<MarkdownGenerationConfiguration> {
    const encodedProjectId = encodeURIComponent(projectId);
    return this.http
      .get<MarkdownGenerationConfiguration>(`/api/projects/${encodedProjectId}/markdown-revisions/configuration`)
      .pipe(catchError((error: unknown) => failApiRequest(error, 'betölteni a Markdown-sablonokat')));
  }

  listRevisions(projectId: string): Observable<readonly MarkdownRevision[]> {
    const encodedProjectId = encodeURIComponent(projectId);
    return this.http
      .get<readonly MarkdownRevision[]>(
        `/api/projects/${encodedProjectId}/markdown-revisions`,
      )
      .pipe(catchError((error: unknown) => failApiRequest(error, 'betölteni a Markdown-revíziókat')));
  }

  loadRevision(projectId: string, revisionId: string): Observable<MarkdownRevision> {
    const encodedProjectId = encodeURIComponent(projectId);
    const encodedRevisionId = encodeURIComponent(revisionId);
    return this.http
      .get<MarkdownRevision>(
        `/api/projects/${encodedProjectId}/markdown-revisions/${encodedRevisionId}`,
      )
      .pipe(catchError((error: unknown) => failApiRequest(error, 'betölteni a Markdown-revíziót')));
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
      userMessage: `Nem sikerült ${action}. Frissítsd az oldalt, majd próbáld újra.`,
      diagnostics: null,
    };
  }

  if (error.status === 0) {
    return {
      userMessage: `Nem sikerült ${action}, mert a szolgáltatás nem érhető el. Ellenőrizd a kapcsolatot, majd próbáld újra.`,
      diagnostics: { action, status: error.status, statusText: error.statusText },
    };
  }

  const nextStep =
    error.status === 404
      ? 'Ellenőrizd, hogy a projekt vagy a revízió még létezik-e.'
      : error.status === 409
        ? safeMarkdownConflictMessage(error) ??
          'Frissítsd a projektet a legújabb revízióállapotért, majd próbáld újra.'
        : 'Ellenőrizd a kiválasztott létrehozási okot, majd próbáld újra.';
  return {
    userMessage: `Nem sikerült ${action}. ${nextStep}`,
    diagnostics: { action, status: error.status, statusText: error.statusText },
  };
}

function safeMarkdownConflictMessage(error: HttpErrorResponse): string | null {
  if (!isRecord(error.error) || typeof error.error['message'] !== 'string') return null;
  const message = error.error['message'];
  if (message.startsWith('A kötelező sablonblokk nem áll rendelkezésre:')) {
    return `${message} Pótold a megnevezett projektadatot, majd próbáld újra.`;
  }
  if (message.startsWith('Archivált projekthez nem generálható Markdown-revízió')) {
    return 'Archivált projekthez nem generálható Markdown-revízió. Előbb állítsd vissza a projektet a Projektbeállításokban.';
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
