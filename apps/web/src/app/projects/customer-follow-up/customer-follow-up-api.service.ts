import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CustomerFollowUpPingDelivery,
  CustomerFollowUpPingPreview,
  CustomerFollowUpReferenceOption,
  CustomerFollowUpState,
  PreviewCustomerFollowUpPingInput,
  RetryFollowUpPingInput,
  SendFollowUpPingInput,
  UpdateCustomerFollowUpDraftInput,
  UpdateCustomerFollowUpInput,
} from '@project-maker/contracts';
import { catchError, type Observable, throwError } from 'rxjs';

export class CustomerFollowUpApiError extends Error {
  constructor(
    message: string,
    readonly code: string | null,
  ) {
    super(message);
    this.name = 'CustomerFollowUpApiError';
  }
}

@Injectable({ providedIn: 'root' })
export class CustomerFollowUpApiService {
  private readonly http = inject(HttpClient);

  load(projectId: string): Observable<CustomerFollowUpState> {
    return this.request(
      this.http.get<CustomerFollowUpState>(this.route(projectId)),
      'betölteni az ügyfél-pinget',
    );
  }

  listReferenceOptions(
    projectId: string,
  ): Observable<readonly CustomerFollowUpReferenceOption[]> {
    return this.request(
      this.http.get<readonly CustomerFollowUpReferenceOption[]>(
        `${this.route(projectId)}/reference-options`,
      ),
      'betölteni a hivatkozható Discovery follow-upokat',
    );
  }

  updateSettings(
    projectId: string,
    input: UpdateCustomerFollowUpInput,
  ): Observable<CustomerFollowUpState> {
    return this.request(
      this.http.patch<CustomerFollowUpState>(this.route(projectId), input),
      'menteni az automatikus ping beállításait',
    );
  }

  updateDraft(
    projectId: string,
    input: UpdateCustomerFollowUpDraftInput,
  ): Observable<CustomerFollowUpState> {
    return this.request(
      this.http.patch<CustomerFollowUpState>(`${this.route(projectId)}/draft`, input),
      'menteni az ügyfél-ping piszkozatát',
    );
  }

  preview(
    projectId: string,
    input: PreviewCustomerFollowUpPingInput,
  ): Observable<CustomerFollowUpPingPreview> {
    return this.request(
      this.http.post<CustomerFollowUpPingPreview>(
        `${this.route(projectId)}/ping/preview`,
        input,
      ),
      'elkészíteni az ügyfél-ping előnézetét',
    );
  }

  send(
    projectId: string,
    input: SendFollowUpPingInput,
  ): Observable<CustomerFollowUpPingDelivery> {
    return this.request(
      this.http.post<CustomerFollowUpPingDelivery>(`${this.route(projectId)}/ping`, input),
      'elküldeni az ügyfél-pinget',
    );
  }

  retry(
    projectId: string,
    input: RetryFollowUpPingInput,
  ): Observable<CustomerFollowUpPingDelivery> {
    return this.request(
      this.http.post<CustomerFollowUpPingDelivery>(
        `${this.route(projectId)}/ping/retry`,
        input,
      ),
      'újrapróbálni az ügyfél-pinget',
    );
  }

  private route(projectId: string): string {
    return `/api/projects/${encodeURIComponent(projectId)}/follow-up`;
  }

  private request<T>(request: Observable<T>, action: string): Observable<T> {
    return request.pipe(catchError((error: unknown) => this.fail(error, action)));
  }

  private fail(error: unknown, action: string): Observable<never> {
    if (!(error instanceof HttpErrorResponse)) {
      return throwError(() =>
        new CustomerFollowUpApiError(
          error instanceof Error ? error.message : `Nem sikerült ${action}.`,
          null,
        ),
      );
    }
    const code = readErrorCode(error.error);
    console.error('Customer follow-up API request failed.', {
      action,
      status: error.status,
      statusText: error.statusText,
    });
    if (error.status === 409) {
      if (code === 'FOLLOW_UP_DRAFT_REQUIRED') {
        return throwError(() => new CustomerFollowUpApiError(
          'Előbb ments egy nem üres Customer follow-up ping üzenetet.',
          code,
        ));
      }
      return throwError(() =>
        new CustomerFollowUpApiError(
          `Nem sikerült ${action}, mert az állapot időközben megváltozott. Töltsd újra az aktuális piszkozatot.`,
          code,
        ),
      );
    }
    if (error.status === 503) {
      if (code === 'FOLLOW_UP_DELIVERY_UNKNOWN') {
        return throwError(() => new CustomerFollowUpApiError(
          'A kézbesítési eredmény bizonytalan. Ellenőrizd a kimenő postafiókot az újraküldés előtt.',
          code,
        ));
      }
      if (code === 'FOLLOW_UP_DELIVERY_FAILED') {
        return throwError(() => new CustomerFollowUpApiError(
          'Az ügyfél-ping küldése sikertelen. Kézzel újrapróbálható.',
          code,
        ));
      }
      return throwError(() =>
        new CustomerFollowUpApiError(
          `Nem sikerült ${action}, mert az e-mail-küldés nem érhető el. Ellenőrizd az SMTP-beállítást.`,
          code,
        ),
      );
    }
    return throwError(() =>
      new CustomerFollowUpApiError(
        `Nem sikerült ${action} (HTTP ${error.status}). Próbáld újra.`,
        code,
      ),
    );
  }
}

function readErrorCode(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('code' in value)) {
    return null;
  }
  return typeof value.code === 'string' ? value.code : null;
}
