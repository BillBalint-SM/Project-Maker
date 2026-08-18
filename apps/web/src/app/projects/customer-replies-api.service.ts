import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { CustomerCorrespondenceCommand, CustomerCorrespondenceView, CustomerReplySummary, ProjectCustomerCorrespondenceWork } from '@project-maker/contracts';
import { BehaviorSubject, catchError, Observable, tap, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CustomerRepliesApiService {
  private readonly http = inject(HttpClient);
  private readonly summarySubject = new BehaviorSubject<CustomerReplySummary>({
    newReplyCount: 0,
    projectCount: 0,
    projects: [],
  });
  readonly summaryChanges = this.summarySubject.asObservable();

  summary(): Observable<CustomerReplySummary> {
    return this.http.get<CustomerReplySummary>('/api/customer-correspondences/summary')
      .pipe(
        tap((summary) => this.summarySubject.next(summary)),
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
    return throwError(() => new Error('A Customer válaszok most nem tölthetők be. A többi projektmunka folytatható.'));
  }
}
