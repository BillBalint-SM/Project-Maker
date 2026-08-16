import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type {
  CreateMarkdownTemplateInput,
  MarkdownTemplatePreview,
  MarkdownTemplateSummary,
  UpdateMarkdownTemplateDraftInput,
} from '@project-maker/contracts';

@Injectable({ providedIn: 'root' })
export class MarkdownTemplateApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<readonly MarkdownTemplateSummary[]> {
    return this.http.get<readonly MarkdownTemplateSummary[]>('/api/settings/markdown-templates')
      .pipe(catchError((error: unknown) => fail(error, 'betölteni a Markdown sablonokat')));
  }

  create(input: CreateMarkdownTemplateInput): Observable<MarkdownTemplateSummary> {
    return this.http.post<MarkdownTemplateSummary>('/api/settings/markdown-templates', input)
      .pipe(catchError((error: unknown) => fail(error, 'létrehozni a Markdown sablont')));
  }

  update(id: string, input: UpdateMarkdownTemplateDraftInput): Observable<MarkdownTemplateSummary> {
    return this.http.put<MarkdownTemplateSummary>(`/api/settings/markdown-templates/${encodeURIComponent(id)}/draft`, input)
      .pipe(catchError((error: unknown) => fail(error, 'menteni a Markdown sablon draftját')));
  }

  preview(id: string): Observable<MarkdownTemplatePreview> {
    return this.http.post<MarkdownTemplatePreview>(`/api/settings/markdown-templates/${encodeURIComponent(id)}/preview`, {})
      .pipe(catchError((error: unknown) => fail(error, 'előnézetet készíteni')));
  }

  publish(id: string): Observable<MarkdownTemplateSummary> {
    return this.http.post<MarkdownTemplateSummary>(`/api/settings/markdown-templates/${encodeURIComponent(id)}/publish`, {})
      .pipe(catchError((error: unknown) => fail(error, 'publikálni a Markdown sablont')));
  }
}

function fail(error: unknown, action: string): Observable<never> {
  const serverMessage = error instanceof HttpErrorResponse ? safeServerMessage(error) : null;
  const message = error instanceof HttpErrorResponse
    ? (error.status === 400 || error.status === 409) && serverMessage
      ? serverMessage
      : `Nem sikerült ${action} (HTTP ${error.status}). Ellenőrizd az adatokat, majd próbáld újra.`
    : `Nem sikerült ${action}. Próbáld újra.`;
  return throwError(() => new Error(message));
}

function safeServerMessage(error: HttpErrorResponse): string | null {
  const payload: unknown = error.error;
  if (!payload || typeof payload !== 'object' || !('message' in payload)) {
    return null;
  }

  const message = payload.message;
  return typeof message === 'string' && message.trim().length > 0 ? message : null;
}
