import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  parseCustomerMailboxSyncState,
  type CustomerMailboxSyncStatus,
} from '@project-maker/contracts';
import { catchError, map, Observable, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CustomerMailboxSyncApiService {
  private readonly http = inject(HttpClient);

  status(): Observable<CustomerMailboxSyncStatus> {
    return this.http
      .get<CustomerMailboxSyncStatus>('/api/customer-mailbox-sync')
      .pipe(map(validateState), catchError(() => this.failure()));
  }

  refresh(): Observable<CustomerMailboxSyncStatus> {
    return this.http
      .post<CustomerMailboxSyncStatus>('/api/customer-mailbox-sync/refresh', {})
      .pipe(map(validateState), catchError(() => this.failure()));
  }

  private failure(): Observable<never> {
    return throwError(
      () => new Error('The Customer mailbox state is currently unavailable. You can continue project work.'),
    );
  }
}

function validateState(status: CustomerMailboxSyncStatus): CustomerMailboxSyncStatus {
  parseCustomerMailboxSyncState(status.state);
  return status;
}
