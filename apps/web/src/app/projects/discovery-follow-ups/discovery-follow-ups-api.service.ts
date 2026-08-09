import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  catchError,
  type Observable,
  throwError,
} from 'rxjs';
import type {
  CreateDiscoveryFollowUpInput,
  DiscoveryFollowUp,
  ResolveDiscoveryFollowUpInput,
} from '@project-maker/contracts';

type DiscoveryOperation = 'load' | 'create' | 'resolve';

const discoveryActions: Readonly<Record<DiscoveryOperation, string>> = {
  load: 'load discovery follow-ups',
  create: 'create a discovery follow-up',
  resolve: 'resolve a discovery follow-up',
};

@Injectable()
export class DiscoveryFollowUpsApiService {
  private readonly http = inject(HttpClient);

  list(projectId: string): Observable<readonly DiscoveryFollowUp[]> {
    return this.http
      .get<readonly DiscoveryFollowUp[]>(
        '/api/projects/' +
          encodeURIComponent(projectId) +
          '/discovery-follow-ups',
      )
      .pipe(
        catchError((error: unknown) => this.fail(error, 'load')),
      );
  }

  create(
    projectId: string,
    input: CreateDiscoveryFollowUpInput,
  ): Observable<DiscoveryFollowUp> {
    return this.http
      .post<DiscoveryFollowUp>(
        '/api/projects/' +
          encodeURIComponent(projectId) +
          '/discovery-follow-ups',
        input,
      )
      .pipe(
        catchError((error: unknown) => this.fail(error, 'create')),
      );
  }

  resolve(
    projectId: string,
    followUpId: string,
    input: ResolveDiscoveryFollowUpInput,
  ): Observable<DiscoveryFollowUp> {
    return this.http
      .post<DiscoveryFollowUp>(
        '/api/projects/' +
          encodeURIComponent(projectId) +
          '/discovery-follow-ups/' +
          encodeURIComponent(followUpId) +
          '/resolve',
        input,
      )
      .pipe(
        catchError((error: unknown) => this.fail(error, 'resolve')),
      );
  }

  private fail(
    error: unknown,
    operation: DiscoveryOperation,
  ): Observable<never> {
    const action = discoveryActions[operation];
    if (!(error instanceof HttpErrorResponse)) {
      const message =
        error instanceof Error
          ? error.message
          : 'Could not ' + action + '. Refresh the page and try again.';
      return throwError(() => new Error(message));
    }

    console.error('Discovery follow-up request failed.', {
      operation,
      status: error.status,
      statusText: error.statusText,
    });

    if (error.status === 0) {
      return throwError(
        () =>
          new Error(
            'Could not ' +
              action +
              ' because the API is unreachable. Check that the server is running, then try again.',
          ),
      );
    }

    return throwError(
      () =>
        new Error(
          'Could not ' +
            action +
            ' (HTTP ' +
            error.status +
            '). ' +
            discoveryNextStep(error.status, operation),
        ),
    );
  }
}

function discoveryNextStep(
  status: number,
  operation: DiscoveryOperation,
): string {
  if (status === 404) {
    return 'Return to the project list and confirm that the project still exists.';
  }
  if (status === 409 && operation === 'create') {
    return 'The project may be archived or changed. Refresh the cockpit and try again.';
  }
  if (status === 409) {
    return 'Refresh the project to see its latest lifecycle state.';
  }
  if (status === 400 && operation === 'create') {
    return 'Choose a category, enter the required text, and use a real due date, then try again.';
  }
  if (status === 400 && operation === 'resolve') {
    return 'Review the entered values and try again.';
  }
  return 'Refresh the Discovery follow-ups and try again.';
}
