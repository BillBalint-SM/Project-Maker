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
      .pipe(catchError((error: unknown) => failApiRequest(error, 'betölteni a kérdésbankot')));
  }

  createBaseQuestion(input: CreateBaseQuestionInput): Observable<BaseQuestionBank> {
    return this.http
      .post<BaseQuestionBank>('/api/settings/base-questions', input)
      .pipe(catchError((error: unknown) => failApiRequest(error, 'létrehozni az alapkérdést')));
  }

  updateBaseQuestion(input: UpdateBaseQuestionInput): Observable<BaseQuestionBank> {
    return this.http
      .patch<BaseQuestionBank>('/api/settings/base-questions', input)
      .pipe(catchError((error: unknown) => failApiRequest(error, 'menteni az alapkérdés módosításait')));
  }

  addReferenceFile(questionId: string, file: File): Observable<BaseQuestionBank> {
    const body = new FormData();
    body.set('file', file, file.name);
    return this.http
      .post<BaseQuestionBank>(
        `/api/settings/base-questions/${encodeURIComponent(questionId)}/reference-files`,
        body,
      )
      .pipe(catchError((error: unknown) => failApiRequest(error, 'hozzáadni a referenciafájlt')));
  }

  removeReferenceFile(questionId: string, fileId: string): Observable<BaseQuestionBank> {
    return this.http
      .delete<BaseQuestionBank>(
        `/api/settings/base-questions/${encodeURIComponent(questionId)}/reference-files/${encodeURIComponent(fileId)}`,
      )
      .pipe(catchError((error: unknown) => failApiRequest(error, 'eltávolítani a referenciafájlt')));
  }

  referenceFileDownloadUrl(questionId: string, fileId: string): string {
    return `/api/settings/base-questions/${encodeURIComponent(questionId)}/reference-files/${encodeURIComponent(fileId)}/download`;
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
          return failApiRequest(error, 'betölteni a projekt kérdéssémáját');
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
      .pipe(catchError((error: unknown) => failApiRequest(error, 'publikálni a projekt kérdéssémáját')));
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
      .pipe(catchError((error: unknown) => failApiRequest(error, 'frissíteni a projekt kérdéssémáját')));
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
      ? 'Ellenőrizd, hogy a projekt vagy a kérdés még létezik-e.'
      : error.status === 409
        ? 'Frissítsd az oldalt a legújabb publikált verzióhoz, majd próbáld újra.'
        : 'Ellenőrizd a megadott értékeket, majd próbáld újra.';
  return {
    userMessage: `Nem sikerült ${action}. ${nextStep}`,
    diagnostics: { action, status: error.status, statusText: error.statusText },
  };
}
