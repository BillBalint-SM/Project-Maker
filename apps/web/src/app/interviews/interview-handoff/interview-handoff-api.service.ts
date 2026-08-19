import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { InterviewCustomerHandoffDetail, InterviewCustomerHandoffPreview, InterviewCustomerHandoffSummary, InterviewHandoffSenderOptions, InterviewHandoffSenderSelection } from '@project-maker/contracts';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class InterviewHandoffApiService {
  private readonly http = inject(HttpClient);
  private base(projectId: string, roundId: string): string {
    return `/api/projects/${encodeURIComponent(projectId)}/rounds/${encodeURIComponent(roundId)}/customer-handoffs`;
  }
  list(projectId: string, roundId: string): Observable<readonly InterviewCustomerHandoffSummary[]> { return this.request(this.http.get<readonly InterviewCustomerHandoffSummary[]>(this.base(projectId, roundId)), 'betölteni az összefoglalókat'); }
  senderOptions(projectId: string, roundId: string): Observable<InterviewHandoffSenderOptions> { return this.request(this.http.get<InterviewHandoffSenderOptions>(`${this.base(projectId, roundId)}/sender-options`), 'betölteni a feladókat'); }
  get(projectId: string, roundId: string, id: string): Observable<InterviewCustomerHandoffDetail> { return this.request(this.http.get<InterviewCustomerHandoffDetail>(`${this.base(projectId, roundId)}/${encodeURIComponent(id)}`), 'betölteni az összefoglalót'); }
  start(projectId: string, roundId: string): Observable<InterviewCustomerHandoffDetail> { return this.request(this.http.post<InterviewCustomerHandoffDetail>(this.base(projectId, roundId), {}), 'létrehozni az új verziót'); }
  update(projectId: string, roundId: string, id: string, modificationSummary: string | null): Observable<InterviewCustomerHandoffDetail> { return this.request(this.http.put<InterviewCustomerHandoffDetail>(`${this.base(projectId, roundId)}/${encodeURIComponent(id)}/draft`, { modificationSummary }), 'menteni a módosítás leírását'); }
  preview(projectId: string, roundId: string, id: string, sender: InterviewHandoffSenderSelection): Observable<InterviewCustomerHandoffPreview> { return this.request(this.http.post<InterviewCustomerHandoffPreview>(`${this.base(projectId, roundId)}/${encodeURIComponent(id)}/preview`, sender), 'elkészíteni az előnézetet'); }
  send(projectId: string, roundId: string, preview: InterviewCustomerHandoffPreview): Observable<InterviewCustomerHandoffDetail> { return this.request(this.http.post<InterviewCustomerHandoffDetail>(`${this.base(projectId, roundId)}/${encodeURIComponent(preview.handoffId)}/send`, { sourceContentVersion: preview.sourceContentVersion, previewDigest: preview.previewDigest, senderName: preview.senderName, senderAddress: preview.senderAddress }), 'elküldeni az összefoglalót'); }
  retry(projectId: string, roundId: string, id: string, acknowledgeDuplicateRisk: boolean): Observable<InterviewCustomerHandoffDetail> { return this.request(this.http.post<InterviewCustomerHandoffDetail>(`${this.base(projectId, roundId)}/${encodeURIComponent(id)}/retry`, { acknowledgeDuplicateRisk }), 'újrapróbálni a küldést'); }
  resume(projectId: string, roundId: string, id: string): Observable<InterviewCustomerHandoffDetail> { return this.request(this.http.post<InterviewCustomerHandoffDetail>(`${this.base(projectId, roundId)}/${encodeURIComponent(id)}/resume-editing`, {}), 'folytatni a szerkesztést'); }

  private request<T>(request: Observable<T>, action: string): Observable<T> {
    return request.pipe(catchError((error: unknown) => {
      console.error('Interview handoff request failed.', {
        action,
        status: error instanceof HttpErrorResponse ? error.status : null,
      });
      return throwError(() => new Error(`Nem sikerült ${action}. Próbáld meg újra.`));
    }));
  }
}
