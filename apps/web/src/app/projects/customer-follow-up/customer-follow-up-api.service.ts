import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CustomerFollowUpPingDelivery,
  CustomerFollowUpPingPreview,
  CustomerFollowUpReferenceOption,
  CustomerFollowUpState,
  PreviewCustomerFollowUpPingInput,
  SendFollowUpPingInput,
  UpdateCustomerFollowUpDraftInput,
  UpdateCustomerFollowUpInput,
} from '@project-maker/contracts';
import { catchError, type Observable, throwError } from 'rxjs';

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

  private route(projectId: string): string {
    return `/api/projects/${encodeURIComponent(projectId)}/follow-up`;
  }

  private request<T>(request: Observable<T>, action: string): Observable<T> {
    return request.pipe(catchError((error: unknown) => this.fail(error, action)));
  }

  private fail(error: unknown, action: string): Observable<never> {
    if (!(error instanceof HttpErrorResponse)) {
      return throwError(() =>
        new Error(error instanceof Error ? error.message : `Nem sikerült ${action}.`),
      );
    }
    console.error('Customer follow-up API request failed.', {
      action,
      status: error.status,
      statusText: error.statusText,
    });
    if (error.status === 409) {
      return throwError(() =>
        new Error(`Nem sikerült ${action}, mert az állapot időközben megváltozott. Töltsd újra az aktuális piszkozatot.`),
      );
    }
    if (error.status === 503) {
      return throwError(() =>
        new Error(`Nem sikerült ${action}, mert az e-mail-küldés nem érhető el. Ellenőrizd az SMTP-beállítást.`),
      );
    }
    return throwError(() =>
      new Error(`Nem sikerült ${action} (HTTP ${error.status}). Próbáld újra.`),
    );
  }
}
