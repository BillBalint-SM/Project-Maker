import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import type { NotificationList } from '@project-maker/contracts';
import { catchError, Observable, tap, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly http = inject(HttpClient);
  readonly current = signal<NotificationList | null>(null);

  load(): Observable<NotificationList> {
    return this.http.get<NotificationList>('/api/notifications').pipe(
      tap((result) => this.current.set(result)),
      catchError(() => throwError(() => new Error('Az értesítések most nem tölthetők be.'))),
    );
  }
}
