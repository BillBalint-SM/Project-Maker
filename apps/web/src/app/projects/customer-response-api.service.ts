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
      .pipe(catchError((error: unknown) => this.fail(error, 'betölteni a kérhető pontosításokat')));
  }

  preview(projectId: string, input: PreviewCustomerResponseRequestInput): Observable<CustomerResponseRequestPreview> {
    return this.http.post<CustomerResponseRequestPreview>(`${root(projectId)}/preview`, input)
      .pipe(catchError((error: unknown) => this.fail(error, 'elkészíteni az előnézetet')));
  }

  confirm(projectId: string, previewToken: string): Observable<CustomerResponseRequest> {
    return this.http.post<CustomerResponseRequest>(`${root(projectId)}/confirm`, { previewToken })
      .pipe(catchError((error: unknown) => this.fail(error, 'elküldeni a válaszkérést')));
  }

  list(projectId: string): Observable<readonly CustomerResponseRequest[]> {
    return this.http.get<readonly CustomerResponseRequest[]>(root(projectId))
      .pipe(catchError((error: unknown) => this.fail(error, 'betölteni az ügyfél-pontosításokat')));
  }

  revoke(projectId: string, requestId: string): Observable<CustomerResponseRequest> {
    return this.command(projectId, requestId, 'revoke', 'visszavonni a válaszkérést');
  }

  retry(projectId: string, requestId: string): Observable<CustomerResponseRequest> {
    return this.command(projectId, requestId, 'retry', 'újrapróbálni a küldést');
  }

  review(projectId: string, requestId: string): Observable<CustomerResponseRequest> {
    return this.command(projectId, requestId, 'review', 'átnézettnek jelölni a választ');
  }

  evidence(projectId: string, requestId: string, answerId: string): Observable<Evidence> {
    return this.http.post<Evidence>(
      `${root(projectId)}/${encodeURIComponent(requestId)}/answers/${encodeURIComponent(answerId)}/evidence`,
      {},
    ).pipe(catchError((error: unknown) => this.fail(error, 'bizonyítékforrásként megtartani a választ')));
  }

  exchange(token: string): Observable<{ readonly available: true }> {
    return this.http.post<{ readonly available: true }>('/api/public/customer-response/exchange', { token })
      .pipe(catchError(() => throwError(() => new Error('A válaszkérés nem érhető el.'))));
  }

  publicRequest(): Observable<PublicCustomerResponseRequest> {
    return this.http.get<PublicCustomerResponseRequest>('/api/public/customer-response')
      .pipe(catchError(() => throwError(() => new Error('A válaszkérés nem érhető el.'))));
  }

  submit(input: SubmitCustomerResponseInput): Observable<CustomerResponseSubmissionReceipt> {
    return this.http.post<CustomerResponseSubmissionReceipt>('/api/public/customer-response/submit', input)
      .pipe(catchError(() => throwError(() => new Error('A válasz nem küldhető el. Ellenőrizd a mezőket, majd próbáld újra.'))));
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
    return throwError(() => new Error(serverMessage ?? `Nem sikerült ${action}. Frissítsd az oldalt, majd próbáld újra.`));
  }
}

function root(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}/customer-response-requests`;
}
