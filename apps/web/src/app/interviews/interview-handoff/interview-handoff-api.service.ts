import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { InterviewCustomerHandoffDetail, InterviewCustomerHandoffPreview, InterviewCustomerHandoffSummary, InterviewHandoffSenderOptions, InterviewHandoffSenderSelection } from '@project-maker/contracts';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class InterviewHandoffApiService {
  private readonly http = inject(HttpClient);
  private base(projectId: string, roundId: string): string {
    return `/api/projects/${encodeURIComponent(projectId)}/rounds/${encodeURIComponent(roundId)}/customer-handoffs`;
  }
  list(projectId: string, roundId: string): Observable<readonly InterviewCustomerHandoffSummary[]> { return this.http.get<readonly InterviewCustomerHandoffSummary[]>(this.base(projectId, roundId)); }
  senderOptions(projectId: string, roundId: string): Observable<InterviewHandoffSenderOptions> { return this.http.get<InterviewHandoffSenderOptions>(`${this.base(projectId, roundId)}/sender-options`); }
  get(projectId: string, roundId: string, id: string): Observable<InterviewCustomerHandoffDetail> { return this.http.get<InterviewCustomerHandoffDetail>(`${this.base(projectId, roundId)}/${encodeURIComponent(id)}`); }
  start(projectId: string, roundId: string): Observable<InterviewCustomerHandoffDetail> { return this.http.post<InterviewCustomerHandoffDetail>(this.base(projectId, roundId), {}); }
  update(projectId: string, roundId: string, id: string, modificationSummary: string | null): Observable<InterviewCustomerHandoffDetail> { return this.http.put<InterviewCustomerHandoffDetail>(`${this.base(projectId, roundId)}/${encodeURIComponent(id)}/draft`, { modificationSummary }); }
  preview(projectId: string, roundId: string, id: string, sender: InterviewHandoffSenderSelection): Observable<InterviewCustomerHandoffPreview> { return this.http.post<InterviewCustomerHandoffPreview>(`${this.base(projectId, roundId)}/${encodeURIComponent(id)}/preview`, sender); }
  send(projectId: string, roundId: string, preview: InterviewCustomerHandoffPreview): Observable<InterviewCustomerHandoffDetail> { return this.http.post<InterviewCustomerHandoffDetail>(`${this.base(projectId, roundId)}/${encodeURIComponent(preview.handoffId)}/send`, { sourceContentVersion: preview.sourceContentVersion, previewDigest: preview.previewDigest, senderAddress: preview.senderAddress }); }
  retry(projectId: string, roundId: string, id: string, acknowledgeDuplicateRisk: boolean): Observable<InterviewCustomerHandoffDetail> { return this.http.post<InterviewCustomerHandoffDetail>(`${this.base(projectId, roundId)}/${encodeURIComponent(id)}/retry`, { acknowledgeDuplicateRisk }); }
  resume(projectId: string, roundId: string, id: string): Observable<InterviewCustomerHandoffDetail> { return this.http.post<InterviewCustomerHandoffDetail>(`${this.base(projectId, roundId)}/${encodeURIComponent(id)}/resume-editing`, {}); }
}
