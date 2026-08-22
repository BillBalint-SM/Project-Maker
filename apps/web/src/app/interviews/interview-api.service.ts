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
          failApiRequest(error, 'load the active Initial Intake'),
        ),
      );
  }

  listRounds(projectId: string): Observable<readonly InterviewRound[]> {
    return this.http
      .get<readonly InterviewRound[]>(`/api/projects/${encodeURIComponent(projectId)}/rounds`)
      .pipe(catchError((error: unknown) => failApiRequest(error, 'load the Initial Intake rounds')));
  }

  getRound(projectId: string, roundId: string): Observable<InterviewRound> {
    const encodedProjectId = encodeURIComponent(projectId);
    const encodedRoundId = encodeURIComponent(roundId);
    return this.http
      .get<InterviewRound>(`/api/projects/${encodedProjectId}/rounds/${encodedRoundId}`)
      .pipe(catchError((error: unknown) => failApiRequest(error, 'load the selected Initial Intake round')));
  }

  createRound(
    projectId: string,
    input: CreateInterviewRoundInput,
  ): Observable<InterviewRound> {
    const encodedProjectId = encodeURIComponent(projectId);
    return this.http
      .post<InterviewRound>(`/api/projects/${encodedProjectId}/rounds`, input)
      .pipe(
        catchError((error: unknown) => failApiRequest(error, 'start the Initial Intake round')),
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
      .pipe(catchError((error: unknown) => failApiRequest(error, 'save the answer')));
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
      .pipe(catchError((error: unknown) => failApiRequest(error, 'save the assessment')));
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
      .pipe(catchError((error: unknown) => failApiRequest(error, 'restore the automatic assessment')));
  }

  finishRound(projectId: string, roundId: string): Observable<InterviewRound> {
    const encodedProjectId = encodeURIComponent(projectId);
    const encodedRoundId = encodeURIComponent(roundId);
    return this.http
      .post<InterviewRound>(
        `/api/projects/${encodedProjectId}/rounds/${encodedRoundId}/finish`,
        {},
      )
      .pipe(
        catchError((error: unknown) => failApiRequest(error, 'end the Initial Intake round')),
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
      userMessage: `Unable to ${action} because the service is unavailable. Check the connection and try again.`,
      diagnostics: { action, status: error.status, statusText: error.statusText },
    };
  }

  const nextStep =
    error.status === 404
      ? 'Check that the project, Initial Intake round, or question still exists.'
      : error.status === 409
        ? 'Refresh the page to load the latest Initial Intake state, then try again.'
        : 'Check the submitted data and try again.';
  return {
    userMessage: `Unable to ${action}. ${nextStep}`,
    diagnostics: { action, status: error.status, statusText: error.statusText },
  };
}

function createGenericActionErrorMessage(action: string): string {
  return `Unable to ${action}. Refresh the page and try again.`;
}
