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
  DiscoveryFollowUpSourceOption,
  OpenDiscoveryFollowUpQueueItem,
  ResolveDiscoveryFollowUpInput,
  SetDiscoveryFollowUpSourceLinkInput,
  UpdateDiscoveryFollowUpInput,
} from '@project-maker/contracts';

export type DiscoveryOperation =
  | 'load'
  | 'load-source-options'
  | 'create'
  | 'update'
  | 'set-source-link'
  | 'resolve';

const discoveryActions: Readonly<Record<DiscoveryOperation, string>> = {
  load: 'load Discovery follow-ups',
  'load-source-options': 'load Initial Intake sources',
  create: 'create the Discovery follow-up',
  update: 'save Discovery follow-up changes',
  'set-source-link': 'update the Discovery follow-up source',
  resolve: 'resolve the Discovery follow-up',
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

@Injectable({ providedIn: 'root' })
export class DiscoveryFollowUpsApiService {
  private readonly http = inject(HttpClient);

  listOpen(): Observable<readonly OpenDiscoveryFollowUpQueueItem[]> {
    return this.http
      .get<readonly OpenDiscoveryFollowUpQueueItem[]>(
        '/api/discovery-follow-ups/open',
      )
      .pipe(catchError((error: unknown) => this.fail(error, 'load')));
  }

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

  listSourceOptions(
    projectId: string,
  ): Observable<readonly DiscoveryFollowUpSourceOption[]> {
    return this.http
      .get<readonly DiscoveryFollowUpSourceOption[]>(
        '/api/projects/' +
          encodeURIComponent(projectId) +
          '/discovery-follow-ups/source-options',
      )
      .pipe(
        catchError((error: unknown) =>
          this.fail(error, 'load-source-options'),
        ),
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

  setSourceLink(
    projectId: string,
    followUpId: string,
    input: SetDiscoveryFollowUpSourceLinkInput,
  ): Observable<DiscoveryFollowUp> {
    return this.http
      .put<DiscoveryFollowUp>(
        '/api/projects/' +
          encodeURIComponent(projectId) +
          '/discovery-follow-ups/' +
          encodeURIComponent(followUpId) +
          '/source-link',
        input,
      )
      .pipe(
        catchError((error: unknown) => this.fail(error, 'set-source-link')),
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
              ' because the service is unavailable. Check the connection and try again.',
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
            '. ' +
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
    return 'Return to the Project Portfolio and confirm that the Project still exists.';
  }
  if (status === 409 && operation === 'create') {
    return 'The Project was archived or changed in the meantime. Reload the page and try again.';
  }
  if (status === 409 && operation === 'update') {
    return 'The Discovery follow-up may have changed. Load the current version and try again.';
  }
  if (status === 409 && operation === 'set-source-link') {
    return 'The Initial Intake source list changed. Select a source again.';
  }
  if (status === 409) {
    return 'Refresh the Project to display its latest administrative phase.';
  }
  if (status === 400 && operation === 'create') {
    return 'Select a category, complete the required fields, and enter a valid due date.';
  }
  if (status === 400 && operation === 'resolve') {
    return 'Review the entered values and try again.';
  }
  return 'Refresh Discovery follow-ups and try again.';
}
