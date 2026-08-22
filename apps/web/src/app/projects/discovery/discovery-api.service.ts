import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, type Observable, throwError } from 'rxjs';
import type {
  CreateInsightInput,
  Insight,
  ProjectContact,
  SaveProjectContactInput,
  UpdateInsightInput,
} from '@project-maker/contracts';

@Injectable({ providedIn: 'root' })
export class DiscoveryApiService {
  private readonly http = inject(HttpClient);

  listContacts(projectId: string): Observable<readonly ProjectContact[]> {
    return this.get<readonly ProjectContact[]>(projectId, 'contacts', 'betölteni a projektkapcsolatokat');
  }

  createContact(projectId: string, input: SaveProjectContactInput): Observable<ProjectContact> {
    return this.http.post<ProjectContact>(this.url(projectId, 'contacts'), input)
      .pipe(catchError((error: unknown) => fail(error, 'létrehozni a projektkapcsolatot')));
  }

  updateContact(projectId: string, contactId: string, input: SaveProjectContactInput): Observable<ProjectContact> {
    return this.http.patch<ProjectContact>(this.url(projectId, `contacts/${encodeURIComponent(contactId)}`), input)
      .pipe(catchError((error: unknown) => fail(error, 'menteni a projektkapcsolatot')));
  }

  deleteContact(projectId: string, contactId: string): Observable<void> {
    return this.http.delete<void>(this.url(projectId, `contacts/${encodeURIComponent(contactId)}`))
      .pipe(catchError((error: unknown) => fail(error, 'törölni a projektkapcsolatot')));
  }

  listInsights(projectId: string): Observable<readonly Insight[]> {
    return this.get<readonly Insight[]>(projectId, 'insights', 'betölteni az insightokat');
  }

  createInsight(projectId: string, input: CreateInsightInput): Observable<Insight> {
    return this.http.post<Insight>(this.url(projectId, 'insights'), input)
      .pipe(catchError((error: unknown) => fail(error, 'menteni az insightot')));
  }

  updateInsight(projectId: string, insightId: string, input: UpdateInsightInput): Observable<Insight> {
    return this.http.put<Insight>(this.url(projectId, `insights/${encodeURIComponent(insightId)}`), input)
      .pipe(catchError((error: unknown) => fail(error, 'frissíteni az insightot')));
  }

  private get<T>(projectId: string, path: string, action: string): Observable<T> {
    return this.http.get<T>(this.url(projectId, path))
      .pipe(catchError((error: unknown) => fail(error, action)));
  }

  private url(projectId: string, path: string): string {
    return `/api/projects/${encodeURIComponent(projectId)}/${path}`;
  }
}

function fail(error: unknown, action: string): Observable<never> {
  const detail = error instanceof HttpErrorResponse && error.status === 409
    ? ' Frissítsd az oldalt, mert az állapot közben megváltozott.'
    : '';
  return throwError(() => new Error(`Nem sikerült ${action}.${detail}`));
}
