import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CustomerMailTriageCommand,
  CustomerMailTriageCommandResult,
  CustomerMailTriageView,
} from '@project-maker/contracts';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CustomerMailTriageApiService {
  private readonly http = inject(HttpClient);

  view(): Observable<CustomerMailTriageView> {
    return this.http.get<CustomerMailTriageView>('/api/customer-mail-triage').pipe(
      catchError(() => throwError(() => new Error(
        'Unmatched Customer messages could not be loaded.',
      ))),
    );
  }

  command(
    messageId: string,
    command: CustomerMailTriageCommand,
  ): Observable<CustomerMailTriageCommandResult> {
    return this.http.post<CustomerMailTriageCommandResult>(
      `/api/customer-mail-triage/${messageId}/commands`,
      command,
    ).pipe(
      catchError(() => throwError(() => new Error(
        'The message could not be processed. Refresh the list and try again.',
      ))),
    );
  }
}
