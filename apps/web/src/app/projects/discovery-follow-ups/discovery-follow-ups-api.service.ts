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
  load: 'betölteni a tisztázandó tételeket',
  'load-source-options': 'betölteni a kezdő felmérés forrásait',
  create: 'létrehozni a tisztázandó tételt',
  update: 'menteni a tisztázandó tétel módosításait',
  'set-source-link': 'módosítani a tisztázandó tétel forrását',
  resolve: 'lezárni a tisztázandó tételt',
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
            'Nem sikerült ' + action + '. Frissítsd az oldalt, majd próbáld újra.',
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
            'Nem sikerült ' +
              action +
              ', mert a szolgáltatás nem érhető el. Ellenőrizd a kapcsolatot, majd próbáld újra.',
            operation,
            error.status,
          ),
      );
    }

    return throwError(
      () =>
        new DiscoveryFollowUpsApiError(
          'Nem sikerült ' +
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
    return 'Térj vissza a projektportfólióhoz, és ellenőrizd, hogy a projekt még létezik-e.';
  }
  if (status === 409 && operation === 'create') {
    return 'A projekt archiválva lett vagy időközben megváltozott. Töltsd újra az oldalt, majd próbáld meg ismét.';
  }
  if (status === 409 && operation === 'update') {
    return 'A tisztázandó tétel időközben megváltozhatott. Töltsd be az aktuális verziót, majd próbáld újra.';
  }
  if (status === 409 && operation === 'set-source-link') {
    return 'A kezdő felmérés forráslistája frissült. Válassz újra.';
  }
  if (status === 409) {
    return 'Frissítsd a projektet a legújabb adminisztratív projektfázis megjelenítéséhez.';
  }
  if (status === 400 && operation === 'create') {
    return 'Válassz kategóriát, töltsd ki a kötelező mezőket és adj meg valós határidőt.';
  }
  if (status === 400 && operation === 'resolve') {
    return 'Ellenőrizd a megadott értékeket, majd próbáld újra.';
  }
  return 'Frissítsd a tisztázandó tételeket, majd próbáld újra.';
}
