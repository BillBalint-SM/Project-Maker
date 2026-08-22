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
      .pipe(catchError((error: unknown) => fail(error, 'load specification templates')));
  }

  create(input: CreateMarkdownTemplateInput): Observable<MarkdownTemplateSummary> {
    return this.http.post<MarkdownTemplateSummary>('/api/settings/markdown-templates', input)
      .pipe(catchError((error: unknown) => fail(error, 'create the specification template')));
  }

  update(id: string, input: UpdateMarkdownTemplateDraftInput): Observable<MarkdownTemplateSummary> {
    return this.http.put<MarkdownTemplateSummary>(`/api/settings/markdown-templates/${encodeURIComponent(id)}/draft`, input)
      .pipe(catchError((error: unknown) => fail(error, 'save the specification template draft')));
  }

  preview(id: string): Observable<MarkdownTemplatePreview> {
    return this.http.post<MarkdownTemplatePreview>(`/api/settings/markdown-templates/${encodeURIComponent(id)}/preview`, {})
      .pipe(catchError((error: unknown) => fail(error, 'generate a preview')));
  }

  publish(id: string): Observable<MarkdownTemplateSummary> {
    return this.http.post<MarkdownTemplateSummary>(`/api/settings/markdown-templates/${encodeURIComponent(id)}/publish`, {})
      .pipe(catchError((error: unknown) => fail(error, 'publish the specification template')));
  }
}

function fail(error: unknown, action: string): Observable<never> {
  const message = error instanceof HttpErrorResponse
    ? error.status === 409
      ? `Unable to ${action} because the template changed in the meantime. Refresh the page and try again.`
      : error.status === 400
        ? 'The specification template contains an unsupported or invalid placeholder. Review the available placeholders and save again.'
      : `Unable to ${action}. Check the supplied values and try again.`
    : `Unable to ${action}. Try again.`;
  return throwError(() => new Error(message));
}
