import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
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
      .pipe(catchError((error: unknown) => failApiRequest(error, 'load the Question Bank')));
  }

  createBaseQuestion(input: CreateBaseQuestionInput): Observable<BaseQuestionBank> {
    return this.http
      .post<BaseQuestionBank>('/api/settings/base-questions', input)
      .pipe(catchError((error: unknown) => failApiRequest(error, 'create the base question')));
  }

  updateBaseQuestion(input: UpdateBaseQuestionInput): Observable<BaseQuestionBank> {
    return this.http
      .patch<BaseQuestionBank>('/api/settings/base-questions', input)
      .pipe(catchError((error: unknown) => failApiRequest(error, 'save base question changes')));
  }

  addReferenceFile(questionId: string, file: File): Observable<BaseQuestionBank> {
    const body = new FormData();
    body.set('file', file, file.name);
    return this.http
      .post<BaseQuestionBank>(
        `/api/settings/base-questions/${encodeURIComponent(questionId)}/reference-files`,
        body,
      )
      .pipe(catchError((error: unknown) => failApiRequest(error, 'add the reference file')));
  }

  removeReferenceFile(questionId: string, fileId: string): Observable<BaseQuestionBank> {
    return this.http
      .delete<BaseQuestionBank>(
        `/api/settings/base-questions/${encodeURIComponent(questionId)}/reference-files/${encodeURIComponent(fileId)}`,
      )
      .pipe(catchError((error: unknown) => failApiRequest(error, 'remove the reference file')));
  }

  referenceFileDownloadUrl(questionId: string, fileId: string): string {
    return `/api/settings/base-questions/${encodeURIComponent(questionId)}/reference-files/${encodeURIComponent(fileId)}/download`;
  }

  loadProjectSchema(projectId: string): Observable<ProjectQuestionSchema | null> {
    const encodedProjectId = encodeURIComponent(projectId);
    return this.http
      .get<ProjectQuestionSchema | null>(`/api/projects/${encodedProjectId}/question-schema`)
      .pipe(catchError((error: unknown) => failApiRequest(error, 'load the Project question schema')));
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
      .pipe(catchError((error: unknown) => failApiRequest(error, 'publish the Project question schema')));
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
      .pipe(catchError((error: unknown) => failApiRequest(error, 'update the Project question schema')));
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
    return {
      userMessage: `Unable to ${action}. Refresh the page and try again.`,
      diagnostics: null,
    };
  }

  if (error.status === 0) {
    return {
      userMessage: `Unable to ${action} because the service is unavailable. Check your connection and try again.`,
      diagnostics: { action, status: error.status, statusText: error.statusText },
    };
  }

  const nextStep =
    error.status === 404
      ? 'Check that the Project or question still exists.'
      : error.status === 409
        ? 'Refresh the page to load the latest published version, then try again.'
        : 'Check the supplied values and try again.';
  return {
    userMessage: `Unable to ${action}. ${nextStep}`,
    diagnostics: { action, status: error.status, statusText: error.statusText },
  };
}
