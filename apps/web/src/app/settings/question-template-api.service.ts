import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, Observable, throwError } from 'rxjs';
import type {
  CreateQuestionTemplateInput,
  QuestionTemplateSummary,
  UpdateQuestionTemplateDraftInput,
} from '@project-maker/contracts';

@Injectable({ providedIn: 'root' })
export class QuestionTemplateApiService {
  private readonly http = inject(HttpClient);

  list(): Observable<readonly QuestionTemplateSummary[]> {
    return this.http
      .get<readonly QuestionTemplateSummary[]>('/api/settings/question-templates')
      .pipe(catchError((error: unknown) => failRequest(error, 'load Question Templates')));
  }

  create(input: CreateQuestionTemplateInput): Observable<QuestionTemplateSummary> {
    return this.http
      .post<QuestionTemplateSummary>('/api/settings/question-templates', input)
      .pipe(catchError((error: unknown) => failRequest(error, 'create the Question Template')));
  }

  updateDraft(
    templateId: string,
    input: UpdateQuestionTemplateDraftInput,
  ): Observable<QuestionTemplateSummary> {
    return this.http
      .put<QuestionTemplateSummary>(
        `/api/settings/question-templates/${encodeURIComponent(templateId)}/draft`,
        input,
      )
      .pipe(catchError((error: unknown) => failRequest(error, 'save the Question Template draft')));
  }

  publish(templateId: string): Observable<QuestionTemplateSummary> {
    return this.http
      .post<QuestionTemplateSummary>(
        `/api/settings/question-templates/${encodeURIComponent(templateId)}/publish`,
        {},
      )
      .pipe(catchError((error: unknown) => failRequest(error, 'publish the Question Template')));
  }
}

function failRequest(error: unknown, action: string): Observable<never> {
  const message =
    error instanceof HttpErrorResponse && typeof error.error?.message === 'string'
      ? error.error.message
      : `Could not ${action}. Try again.`;
  return throwError(() => new Error(message));
}
