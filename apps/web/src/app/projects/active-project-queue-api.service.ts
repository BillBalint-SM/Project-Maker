import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  activeProjectQueueCursorErrorCodes,
  type ActiveProjectQueueCursorErrorCode,
  type ActiveProjectQueuePage,
  type ActiveProjectQueueQuery,
} from '@project-maker/contracts';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ActiveProjectQueueApiService {
  private readonly http = inject(HttpClient);

  getPage(query: ActiveProjectQueueQuery = {}): Observable<ActiveProjectQueuePage> {
    let params = new HttpParams();
    if (query.search) params = params.set('q', query.search);
    for (const urgency of query.urgencies ?? []) params = params.append('urgency', urgency);
    for (const state of query.preparationStates ?? []) params = params.append('preparation', state);
    if (query.cursor) params = params.set('cursor', query.cursor);
    return this.http.get<ActiveProjectQueuePage>('/api/projects/active-queue', { params }).pipe(
      catchError((error: unknown) => {
        const cursorCode = cursorErrorCode(error);
        return throwError(() => cursorCode
          ? new ActiveProjectQueueCursorRequestError(cursorCode)
          : new Error('Az aktív munkasor nem tölthető be. Ellenőrizd a kapcsolatot, majd próbáld újra.'));
      }),
    );
  }
}

export class ActiveProjectQueueCursorRequestError extends Error {
  constructor(readonly code: ActiveProjectQueueCursorErrorCode) {
    super(code);
  }
}

function cursorErrorCode(error: unknown): ActiveProjectQueueCursorErrorCode | null {
  if (!(error instanceof HttpErrorResponse) || !error.error || typeof error.error !== 'object') {
    return null;
  }
  const code = (error.error as { readonly code?: unknown }).code;
  return typeof code === 'string'
    && (activeProjectQueueCursorErrorCodes as readonly string[]).includes(code)
    ? code as ActiveProjectQueueCursorErrorCode
    : null;
}
