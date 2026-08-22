import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { CustomerCorrespondenceCommand, CustomerCorrespondenceView, CustomerReplySummary, ProjectCustomerCorrespondenceWork } from '@project-maker/contracts';
import { catchError, Observable, Subject, tap, throwError } from 'rxjs';

import { AuthApiService } from '../auth/auth-api.service';

export interface CustomerReplySummaryUpdate {
  readonly userId: string;
  readonly summary: CustomerReplySummary;
}

@Injectable({ providedIn: 'root' })
export class CustomerRepliesApiService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthApiService);
  private readonly summarySubject = new Subject<CustomerReplySummaryUpdate>();
  readonly summaryChanges = this.summarySubject.asObservable();

  summary(): Observable<CustomerReplySummary> {
    const userId = this.auth.currentUser()?.id ?? null;
    return this.http.get<CustomerReplySummary>('/api/customer-correspondences/summary')
      .pipe(
        tap((summary) => {
          if (userId && this.auth.currentUser()?.id === userId) {
            this.summarySubject.next({ userId, summary });
          }
        }),
        catchError(() => this.failure()),
      );
  }
  forProject(projectId: string): Observable<ProjectCustomerCorrespondenceWork> {
    return this.http.get<ProjectCustomerCorrespondenceWork>(`/api/projects/${encodeURIComponent(projectId)}/customer-correspondences`)
      .pipe(catchError(() => this.failure()));
  }
  command(
    projectId: string,
    correspondenceId: string,
    command: CustomerCorrespondenceCommand,
  ): Observable<CustomerCorrespondenceView> {
    return this.http.post<CustomerCorrespondenceView>(
      `/api/projects/${encodeURIComponent(projectId)}/customer-correspondences/${encodeURIComponent(correspondenceId)}/commands`,
      command,
    ).pipe(catchError(() => this.failure()));
  }
  private failure(): Observable<never> {
    return throwError(() => new Error('Customer replies are currently unavailable. Other project work can continue; reload this page later.'));
  }
}
