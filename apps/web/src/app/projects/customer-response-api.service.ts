import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CustomerResponseEligiblePrompt,
  CustomerResponseRequest,
  CustomerResponseRequestPreview,
  CustomerResponseSubmissionReceipt,
  Evidence,
  PreviewCustomerResponseRequestInput,
  PublicCustomerResponseRequest,
  SubmitCustomerResponseInput,
} from '@project-maker/contracts';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class CustomerResponseApiService {
  private readonly http = inject(HttpClient);

  eligible(projectId: string): Observable<readonly CustomerResponseEligiblePrompt[]> {
    return this.http.get<readonly CustomerResponseEligiblePrompt[]>(`${root(projectId)}/eligible-prompts`)
      .pipe(catchError((error: unknown) => this.fail(error, 'load the available clarifications')));
  }

  preview(projectId: string, input: PreviewCustomerResponseRequestInput): Observable<CustomerResponseRequestPreview> {
    return this.http.post<CustomerResponseRequestPreview>(`${root(projectId)}/preview`, input)
      .pipe(catchError((error: unknown) => this.fail(error, 'create the preview')));
  }

  confirm(projectId: string, previewToken: string): Observable<CustomerResponseRequest> {
    return this.http.post<CustomerResponseRequest>(`${root(projectId)}/confirm`, { previewToken })
      .pipe(catchError((error: unknown) => this.fail(error, 'send the response request')));
  }

  list(projectId: string): Observable<readonly CustomerResponseRequest[]> {
    return this.http.get<readonly CustomerResponseRequest[]>(root(projectId))
      .pipe(catchError((error: unknown) => this.fail(error, 'load the Customer clarifications')));
  }

  revoke(projectId: string, requestId: string): Observable<CustomerResponseRequest> {
    return this.command(projectId, requestId, 'revoke', 'revoke the response request');
  }

  retry(projectId: string, requestId: string): Observable<CustomerResponseRequest> {
    return this.command(projectId, requestId, 'retry', 'retry sending the request');
  }

  review(projectId: string, requestId: string): Observable<CustomerResponseRequest> {
    return this.command(projectId, requestId, 'review', 'mark the response as reviewed');
  }

  evidence(projectId: string, requestId: string, answerId: string): Observable<Evidence> {
    return this.http.post<Evidence>(
      `${root(projectId)}/${encodeURIComponent(requestId)}/answers/${encodeURIComponent(answerId)}/evidence`,
      {},
    ).pipe(catchError((error: unknown) => this.fail(error, 'retain the response as evidence')));
  }

  exchange(token: string): Observable<{ readonly available: true }> {
    return this.http.post<{ readonly available: true }>('/api/public/customer-response/exchange', { token })
      .pipe(catchError(() => throwError(() => new Error('The response request is unavailable.'))));
  }

  publicRequest(): Observable<PublicCustomerResponseRequest> {
    return this.http.get<PublicCustomerResponseRequest>('/api/public/customer-response')
      .pipe(catchError(() => throwError(() => new Error('The response request is unavailable.'))));
  }

  submit(input: SubmitCustomerResponseInput): Observable<CustomerResponseSubmissionReceipt> {
    return this.http.post<CustomerResponseSubmissionReceipt>('/api/public/customer-response/submit', input)
      .pipe(catchError(() => throwError(() => new Error('The response cannot be submitted. Check the fields and try again.'))));
  }

  private command(projectId: string, requestId: string, action: string, message: string): Observable<CustomerResponseRequest> {
    return this.http.post<CustomerResponseRequest>(
      `${root(projectId)}/${encodeURIComponent(requestId)}/${action}`,
      {},
    ).pipe(catchError((error: unknown) => this.fail(error, message)));
  }

  private fail(error: unknown, action: string): Observable<never> {
    const serverMessage = error instanceof HttpErrorResponse && typeof error.error === 'object' && error.error !== null &&
      typeof (error.error as { message?: unknown }).message === 'string'
      ? (error.error as { message: string }).message : null;
    return throwError(() => new Error(serverMessage ?? `Unable to ${action}. Refresh the page and try again.`));
  }
}

function root(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/customer-response-requests`;
}
