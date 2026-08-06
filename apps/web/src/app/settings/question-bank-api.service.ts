import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, of, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type {
  BaseQuestionBank,
  CreateBaseQuestionInput,
  ProjectQuestionSchema,
  PublishProjectQuestionSchemaInput,
  UpdateBaseQuestionInput,
} from '@project-maker/contracts';

@Injectable({ providedIn: 'root' })
export class QuestionBankApiService {
  private readonly http = inject(HttpClient);

  loadBaseQuestionBank(): Observable<BaseQuestionBank> {
    return this.http
      .get<BaseQuestionBank>('/api/settings/base-questions')
      .pipe(catchError((error: unknown) => failApiRequest(error, 'load the base question bank')));
  }

  createBaseQuestion(input: CreateBaseQuestionInput): Observable<BaseQuestionBank> {
    return this.http
      .post<BaseQuestionBank>('/api/settings/base-questions', input)
      .pipe(catchError((error: unknown) => failApiRequest(error, 'create the base question')));
  }

  updateBaseQuestion(input: UpdateBaseQuestionInput): Observable<BaseQuestionBank> {
    return this.http
      .patch<BaseQuestionBank>('/api/settings/base-questions', input)
      .pipe(catchError((error: unknown) => failApiRequest(error, 'update the base question')));
  }

  loadProjectSchema(projectId: string): Observable<ProjectQuestionSchema | null> {
    const encodedProjectId = encodeURIComponent(projectId);
    return this.http
      .get<ProjectQuestionSchema>(`/api/projects/${encodedProjectId}/question-schema`)
      .pipe(
        catchError((error: unknown) => {
          if (error instanceof HttpErrorResponse && error.status === 404) {
            return of(null);
          }
          return failApiRequest(error, 'load the project question schema');
        }),
      );
  }

  createProjectSchema(
    projectId: string,
    input: PublishProjectQuestionSchemaInput,
  ): Observable<ProjectQuestionSchema> {
    const encodedProjectId = encodeURIComponent(projectId);
    return this.http
      .post<ProjectQuestionSchema>(
        `/api/projects/${encodedProjectId}/question-schema`,
        input,
      )
      .pipe(catchError((error: unknown) => failApiRequest(error, 'publish the project question schema')));
  }

  updateProjectSchema(
    projectId: string,
    input: PublishProjectQuestionSchemaInput,
  ): Observable<ProjectQuestionSchema> {
    const encodedProjectId = encodeURIComponent(projectId);
    return this.http
      .patch<ProjectQuestionSchema>(
        `/api/projects/${encodedProjectId}/question-schema`,
        input,
      )
      .pipe(catchError((error: unknown) => failApiRequest(error, 'update the project question schema')));
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
    console.error('Question bank API request failed.', mapped.diagnostics);
  }
  return throwError(() => new Error(mapped.userMessage));
}

function mapApiError(error: unknown, action: string): ActionableApiError {
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

  const nextStep =
    error.status === 404
      ? 'Confirm that the requested project or question still exists.'
      : error.status === 409
        ? 'Refresh the page to see the latest published version, then try again.'
        : 'Review the entered values and try again.';
  return {
    userMessage: `Could not ${action} (HTTP ${error.status}). ${nextStep}`,
    diagnostics: { action, status: error.status, statusText: error.statusText },
  };
}
