import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { ActiveProjectQueuePage } from '@project-maker/contracts';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ActiveProjectQueueApiService {
  private readonly http = inject(HttpClient);

  firstPage(): Observable<ActiveProjectQueuePage> {
    return this.http.get<ActiveProjectQueuePage>('/api/projects/active-queue').pipe(
      catchError(() =>
        throwError(
          () => new Error('Az aktív munkasor nem tölthető be. Ellenőrizd a kapcsolatot, majd próbáld újra.'),
        ),
      ),
    );
  }
}
