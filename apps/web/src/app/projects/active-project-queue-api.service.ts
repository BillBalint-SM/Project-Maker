import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import type { ActiveProjectQueuePage, ActiveProjectQueueQuery } from '@project-maker/contracts';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ActiveProjectQueueApiService {
  private readonly http = inject(HttpClient);

  firstPage(query: ActiveProjectQueueQuery = {}): Observable<ActiveProjectQueuePage> {
    let params = new HttpParams();
    if (query.search) params = params.set('q', query.search);
    for (const urgency of query.urgencies ?? []) params = params.append('urgency', urgency);
    for (const state of query.preparationStates ?? []) params = params.append('preparation', state);
    return this.http.get<ActiveProjectQueuePage>('/api/projects/active-queue', { params }).pipe(
      catchError(() =>
        throwError(
          () => new Error('Az aktív munkasor nem tölthető be. Ellenőrizd a kapcsolatot, majd próbáld újra.'),
        ),
      ),
    );
  }
}
