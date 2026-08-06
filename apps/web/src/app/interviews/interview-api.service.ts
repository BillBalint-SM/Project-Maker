import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type {
  CreateInterviewRoundInput,
  InterviewRound,
  RoundQuestionSnapshot,
  UpdateRoundAnswerInput,
} from '@project-maker/contracts';

@Injectable({ providedIn: 'root' })
export class InterviewApiService {
  private readonly http = inject(HttpClient);

  createRound(
    projectId: string,
    input: CreateInterviewRoundInput,
  ): Observable<InterviewRound> {
    const encodedProjectId = encodeURIComponent(projectId);
    return this.http
      .post<InterviewRound>(`/api/projects/${encodedProjectId}/rounds`, input)
      .pipe(catchError((error: unknown) => failApiRequest(error, 'create the interview round')));
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

  completeRound(projectId: string, roundId: string): Observable<InterviewRound> {
    const encodedProjectId = encodeURIComponent(projectId);
    const encodedRoundId = encodeURIComponent(roundId);
    return this.http
      .post<InterviewRound>(
        `/api/projects/${encodedProjectId}/rounds/${encodedRoundId}/complete`,
        {},
      )
      .pipe(catchError((error: unknown) => failApiRequest(error, 'complete the interview round')));
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

  if (error.status === 409 && action === 'complete the interview round') {
    return {
      userMessage: `Could not ${action} because required answers are missing. Fill and save every required question, then try again.`,
      diagnostics: { action, status: error.status, statusText: error.statusText },
    };
  }

  const nextStep =
    error.status === 404
      ? 'Confirm that the project, round, or question still exists.'
      : error.status === 409
        ? 'Refresh the page to see the latest round state, then try again.'
        : 'Review the answer and try again.';
  return {
    userMessage: `Could not ${action} (HTTP ${error.status}). ${nextStep}`,
    diagnostics: { action, status: error.status, statusText: error.statusText },
  };
}
