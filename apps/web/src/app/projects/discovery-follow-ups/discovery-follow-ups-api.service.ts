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
  UpdateDiscoveryFollowUpInput,
} from '@project-maker/contracts';

export type DiscoveryOperation = 'load' | 'create' | 'update' | 'resolve';

const discoveryActions: Readonly<Record<DiscoveryOperation, string>> = {
  load: 'load discovery follow-ups',
  create: 'create a discovery follow-up',
  update: 'update a discovery follow-up',
  resolve: 'resolve a discovery follow-up',
};

export class DiscoveryFollowUpsApiError extends Error {
  constructor(
    message: string,
    readonly operation: DiscoveryOperation,
    readonly status: number | null,
  ) {
    super(message);
    this.name = 'DiscoveryFollowUpsApiError';
  }
}

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

  update(
    projectId: string,
    followUpId: string,
    input: UpdateDiscoveryFollowUpInput,
  ): Observable<DiscoveryFollowUp> {
    return this.http
      .patch<DiscoveryFollowUp>(
        '/api/projects/' +
          encodeURIComponent(projectId) +
          '/discovery-follow-ups/' +
          encodeURIComponent(followUpId),
        input,
      )
      .pipe(catchError((error: unknown) => this.fail(error, 'update')));
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
      return throwError(
        () =>
          new DiscoveryFollowUpsApiError(
            'Could not ' + action + '. Refresh the page and try again.',
            operation,
            null,
          ),
      );
    }

    console.error('Discovery follow-up request failed.', {
      operation,
      status: error.status,
      statusText: error.statusText,
    });

    if (error.status === 0) {
      return throwError(
        () =>
          new DiscoveryFollowUpsApiError(
            'Could not ' +
              action +
              ' because the API is unreachable. Check that the server is running, then try again.',
            operation,
            error.status,
          ),
      );
    }

    return throwError(
      () =>
        new DiscoveryFollowUpsApiError(
          'Could not ' +
            action +
            ' (HTTP ' +
            error.status +
            '). ' +
            discoveryNextStep(error.status, operation),
          operation,
          error.status,
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
  if (status === 409 && operation === 'update') {
    return 'The discovery follow-up may have changed. Refresh its current version and try again.';
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
