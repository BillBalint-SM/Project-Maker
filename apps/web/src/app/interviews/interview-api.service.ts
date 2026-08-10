import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type {
  CreateInterviewRoundInput,
  InterviewRound,
  RoundQuestionSnapshot,
  SetRoundQuestionAssessmentInput,
  UpdateRoundAnswerInput,
} from '@project-maker/contracts';

export const interviewApiErrorBrand = 'INTERVIEW_API_ERROR' as const;

export class InterviewApiError extends Error {
  readonly brand = interviewApiErrorBrand;

  constructor(userMessage: string) {
    super(userMessage);
    this.name = 'InterviewApiError';
  }
}

export function isInterviewApiError(error: unknown): error is InterviewApiError {
  if (!(error instanceof Error)) {
    return false;
  }

  const brandedError = error as Error & { brand?: unknown };
  return brandedError.brand === interviewApiErrorBrand;
}

@Injectable({ providedIn: 'root' })
export class InterviewApiService {
  private readonly http = inject(HttpClient);

  getActiveInitialIntake(projectId: string): Observable<InterviewRound | null> {
    const encodedProjectId = encodeURIComponent(projectId);
    return this.http
      .get<InterviewRound | null>(`/api/projects/${encodedProjectId}/rounds/active`)
      .pipe(
        catchError((error: unknown) =>
          failApiRequest(error, 'betölteni az aktív kezdő interjúkört'),
        ),
      );
  }

  createRound(
    projectId: string,
    input: CreateInterviewRoundInput,
  ): Observable<InterviewRound> {
    const encodedProjectId = encodeURIComponent(projectId);
    return this.http
      .post<InterviewRound>(`/api/projects/${encodedProjectId}/rounds`, input)
      .pipe(
        catchError((error: unknown) => failApiRequest(error, 'elindítani az interjúkört')),
      );
  }

  updateAnswer(
    projectId: string,
    roundId: string,
    snapshotId: string,
    input: UpdateRoundAnswerInput,
  ): Observable<RoundQuestionSnapshot> {
    const encodedProjectId = encodeURIComponent(projectId);
    const encodedRoundId = encodeURIComponent(roundId);
    const encodedSnapshotId = encodeURIComponent(snapshotId);
    return this.http
      .patch<RoundQuestionSnapshot>(
        `/api/projects/${encodedProjectId}/rounds/${encodedRoundId}/answers/${encodedSnapshotId}`,
        input,
      )
      .pipe(catchError((error: unknown) => failApiRequest(error, 'elmenteni a választ')));
  }

  setAssessment(
    projectId: string,
    roundId: string,
    snapshotId: string,
    input: SetRoundQuestionAssessmentInput,
  ): Observable<RoundQuestionSnapshot> {
    const encodedProjectId = encodeURIComponent(projectId);
    const encodedRoundId = encodeURIComponent(roundId);
    const encodedSnapshotId = encodeURIComponent(snapshotId);
    return this.http
      .put<RoundQuestionSnapshot>(
        `/api/projects/${encodedProjectId}/rounds/${encodedRoundId}/answers/${encodedSnapshotId}/assessment`,
        input,
      )
      .pipe(catchError((error: unknown) => failApiRequest(error, 'elmenteni az értékelést')));
  }

  resetAssessment(
    projectId: string,
    roundId: string,
    snapshotId: string,
  ): Observable<RoundQuestionSnapshot> {
    const encodedProjectId = encodeURIComponent(projectId);
    const encodedRoundId = encodeURIComponent(roundId);
    const encodedSnapshotId = encodeURIComponent(snapshotId);
    return this.http
      .delete<RoundQuestionSnapshot>(
        `/api/projects/${encodedProjectId}/rounds/${encodedRoundId}/answers/${encodedSnapshotId}/assessment`,
      )
      .pipe(catchError((error: unknown) => failApiRequest(error, 'visszaállítani az automatikus értékelést')));
  }

  completeRound(projectId: string, roundId: string): Observable<InterviewRound> {
    const encodedProjectId = encodeURIComponent(projectId);
    const encodedRoundId = encodeURIComponent(roundId);
    return this.http
      .post<InterviewRound>(
        `/api/projects/${encodedProjectId}/rounds/${encodedRoundId}/complete`,
        {},
      )
      .pipe(
        catchError((error: unknown) => failApiRequest(error, 'lezárni az interjúkört')),
      );
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
    console.error('Interview API request failed.', mapped.diagnostics);
  }
  return throwError(() => new InterviewApiError(mapped.userMessage));
}

function mapApiError(error: unknown, action: string): ActionableApiError {
  if (isInterviewApiError(error)) {
    return { userMessage: error.message, diagnostics: null };
  }

  if (!(error instanceof HttpErrorResponse)) {
    return {
      userMessage: createGenericActionErrorMessage(action),
      diagnostics: null,
    };
  }

  if (error.status === 0) {
    return {
      userMessage: `Nem sikerült ${action}, mert az API nem érhető el. Ellenőrizd, hogy fut-e a szerver, majd próbáld újra.`,
      diagnostics: { action, status: error.status, statusText: error.statusText },
    };
  }

  if (error.status === 409 && action === 'lezárni az interjúkört') {
    return {
      userMessage: 'Nem sikerült lezárni az interjúkört, mert hiányoznak kötelező válaszok. Ments el minden kötelező kérdést, majd próbáld újra.',
      diagnostics: { action, status: error.status, statusText: error.statusText },
    };
  }

  const nextStep =
    error.status === 404
      ? 'Ellenőrizd, hogy a projekt, az interjúkör vagy a kérdés még létezik-e.'
      : error.status === 409
        ? 'Frissítsd az oldalt, hogy a legfrissebb interjúállapotot lásd, majd próbáld újra.'
        : 'Ellenőrizd az adatokat, majd próbáld újra.';
  return {
    userMessage: `Nem sikerült ${action} (HTTP ${error.status}). ${nextStep}`,
    diagnostics: { action, status: error.status, statusText: error.statusText },
  };
}

function createGenericActionErrorMessage(action: string): string {
  return `Nem sikerült ${action}. Frissítsd az oldalt, majd próbáld újra.`;
}
