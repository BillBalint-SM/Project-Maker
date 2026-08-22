import { HttpClient } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import type { NotificationList } from '@project-maker/contracts';
import { catchError, Observable, tap, throwError } from 'rxjs';

import { AuthApiService } from '../auth/auth-api.service';

export interface NotificationSnapshot {
  readonly userId: string;
  readonly notifications: NotificationList;
}

@Injectable({ providedIn: 'root' })
export class NotificationsApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthApiService);
  readonly current = signal<NotificationSnapshot | null>(null);

  load(): Observable<NotificationList> {
    const userId = this.auth.currentUser()?.id ?? null;
    return this.http.get<NotificationList>('/api/notifications').pipe(
      tap((notifications) => {
        if (userId && this.auth.currentUser()?.id === userId) {
          this.current.set({ userId, notifications });
        }
      }),
      catchError(() => throwError(() => new Error('Notifications are currently unavailable.'))),
    );
  }

  clearCurrent(): void {
    this.current.set(null);
  }
}
