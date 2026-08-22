import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  CorrespondenceMailboxIdentity,
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

import { genericHttpErrorMessage } from '../../shared/http-error-message';

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
      'load the Customer follow-up',
    );
  }

  listReferenceOptions(
    projectId: string,
  ): Observable<readonly CustomerFollowUpReferenceOption[]> {
    return this.request(
      this.http.get<readonly CustomerFollowUpReferenceOption[]>(
        `${this.route(projectId)}/reference-options`,
      ),
      'load available Discovery follow-ups',
    );
  }

  senderIdentity(projectId: string): Observable<CorrespondenceMailboxIdentity> {
    return this.request(
      this.http.get<CorrespondenceMailboxIdentity>(`${this.route(projectId)}/sender-identity`),
      'load the correspondence mailbox sender',
    );
  }

  updateSettings(
    projectId: string,
    input: UpdateCustomerFollowUpInput,
  ): Observable<CustomerFollowUpState> {
    return this.request(
      this.http.patch<CustomerFollowUpState>(this.route(projectId), input),
      'save automated follow-up settings',
    );
  }

  updateDraft(
    projectId: string,
    input: UpdateCustomerFollowUpDraftInput,
  ): Observable<CustomerFollowUpState> {
    return this.request(
      this.http.patch<CustomerFollowUpState>(`${this.route(projectId)}/draft`, input),
      'save the Customer follow-up draft',
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
      'prepare the Customer follow-up preview',
    );
  }

  send(
    projectId: string,
    input: SendFollowUpPingInput,
  ): Observable<CustomerFollowUpPingDelivery> {
    return this.request(
      this.http.post<CustomerFollowUpPingDelivery>(`${this.route(projectId)}/ping`, input),
      'send the Customer follow-up',
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
      'retry the Customer follow-up',
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
      console.error('Customer follow-up request failed before receiving an HTTP response.', error);
      return throwError(() =>
        new CustomerFollowUpApiError(
          genericHttpErrorMessage(error, action),
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
          'Save a non-empty Customer follow-up draft first.',
          code,
        ));
      }
      return throwError(() =>
        new CustomerFollowUpApiError(
          `Could not ${action} because the state changed. Reload the current draft and try again.`,
          code,
        ),
      );
    }
    if (error.status === 503) {
      if (code === 'FOLLOW_UP_DELIVERY_UNKNOWN') {
        return throwError(() => new CustomerFollowUpApiError(
          'Delivery outcome is unknown. Check the outbound mailbox before retrying.',
          code,
        ));
      }
      if (code === 'FOLLOW_UP_DELIVERY_FAILED') {
        return throwError(() => new CustomerFollowUpApiError(
          'Customer follow-up delivery failed. You can retry it manually.',
          code,
        ));
      }
      return throwError(() =>
        new CustomerFollowUpApiError(
          `Could not ${action} because email delivery is unavailable. Check the mail gateway configuration.`,
          code,
        ),
      );
    }
    return throwError(() =>
      new CustomerFollowUpApiError(
        genericHttpErrorMessage(error, action),
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
