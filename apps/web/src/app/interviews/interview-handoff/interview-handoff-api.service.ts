import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { CorrespondenceMailboxIdentity, InterviewCustomerHandoffDetail, InterviewCustomerHandoffPreview, InterviewCustomerHandoffSummary } from '@project-maker/contracts';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class InterviewHandoffApiService {
  private readonly http = inject(HttpClient);
  private base(projectId: string, roundId: string): string {
    return `/api/projects/${encodeURIComponent(projectId)}/rounds/${encodeURIComponent(roundId)}/customer-handoffs`;
  }
  list(projectId: string, roundId: string): Observable<readonly InterviewCustomerHandoffSummary[]> { return this.request(this.http.get<readonly InterviewCustomerHandoffSummary[]>(this.base(projectId, roundId)), 'load the handoff summaries'); }
  senderIdentity(projectId: string, roundId: string): Observable<CorrespondenceMailboxIdentity> { return this.request(this.http.get<CorrespondenceMailboxIdentity>(`${this.base(projectId, roundId)}/sender-identity`), 'load the correspondence mailbox sender'); }
  get(projectId: string, roundId: string, id: string): Observable<InterviewCustomerHandoffDetail> { return this.request(this.http.get<InterviewCustomerHandoffDetail>(`${this.base(projectId, roundId)}/${encodeURIComponent(id)}`), 'load the handoff'); }
  start(projectId: string, roundId: string): Observable<InterviewCustomerHandoffDetail> { return this.request(this.http.post<InterviewCustomerHandoffDetail>(this.base(projectId, roundId), {}), 'create the new version'); }
  update(projectId: string, roundId: string, id: string, modificationSummary: string | null): Observable<InterviewCustomerHandoffDetail> { return this.request(this.http.put<InterviewCustomerHandoffDetail>(`${this.base(projectId, roundId)}/${encodeURIComponent(id)}/draft`, { modificationSummary }), 'save the change summary'); }
  preview(projectId: string, roundId: string, id: string): Observable<InterviewCustomerHandoffPreview> { return this.request(this.http.post<InterviewCustomerHandoffPreview>(`${this.base(projectId, roundId)}/${encodeURIComponent(id)}/preview`, {}), 'create the preview'); }
  send(projectId: string, roundId: string, preview: InterviewCustomerHandoffPreview): Observable<InterviewCustomerHandoffDetail> { return this.request(this.http.post<InterviewCustomerHandoffDetail>(`${this.base(projectId, roundId)}/${encodeURIComponent(preview.handoffId)}/send`, { sourceContentVersion: preview.sourceContentVersion, previewDigest: preview.previewDigest }), 'send the handoff'); }
  retry(projectId: string, roundId: string, id: string, acknowledgeDuplicateRisk: boolean): Observable<InterviewCustomerHandoffDetail> { return this.request(this.http.post<InterviewCustomerHandoffDetail>(`${this.base(projectId, roundId)}/${encodeURIComponent(id)}/retry`, { acknowledgeDuplicateRisk }), 'retry sending the handoff'); }
  resume(projectId: string, roundId: string, id: string): Observable<InterviewCustomerHandoffDetail> { return this.request(this.http.post<InterviewCustomerHandoffDetail>(`${this.base(projectId, roundId)}/${encodeURIComponent(id)}/resume-editing`, {}), 'resume editing'); }

  private request<T>(request: Observable<T>, action: string): Observable<T> {
    return request.pipe(catchError((error: unknown) => {
      console.error('Interview handoff request failed.', {
        action,
        status: error instanceof HttpErrorResponse ? error.status : null,
      });
      return throwError(() => new Error(`Unable to ${action}. Try again.`));
    }));
  }
}
