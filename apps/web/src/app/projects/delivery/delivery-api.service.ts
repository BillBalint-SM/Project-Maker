import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  DeliveryHandoff,
  DeliveryHandoffPreview,
  DeliveryPackage,
  GitConnectionTestResult,
  GitSetup,
  SaveDeliveryPackageInput,
  SaveGitSetupInput,
} from '@project-maker/contracts';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DeliveryApiService {
  private readonly http = inject(HttpClient);

  loadPackage(projectId: string): Observable<DeliveryPackage | null> {
    return this.http.get<DeliveryPackage | null>(`${projectBase(projectId)}/delivery-package`).pipe(
      catchError((error: unknown) => fail(error, 'load the Delivery Package')),
    );
  }

  savePackage(projectId: string, input: SaveDeliveryPackageInput): Observable<DeliveryPackage> {
    return this.http.put<DeliveryPackage>(`${projectBase(projectId)}/delivery-package`, input).pipe(
      catchError((error: unknown) => fail(error, 'save the Delivery Package')),
    );
  }

  listGitSetups(): Observable<readonly GitSetup[]> {
    return this.http.get<readonly GitSetup[]>('/api/git-setups').pipe(
      catchError((error: unknown) => fail(error, 'load the Git setups')),
    );
  }

  createGitSetup(input: SaveGitSetupInput): Observable<GitSetup> {
    return this.http.post<GitSetup>('/api/git-setups', input).pipe(
      catchError((error: unknown) => fail(error, 'create the Git setup')),
    );
  }

  updateGitSetup(id: string, input: SaveGitSetupInput): Observable<GitSetup> {
    return this.http.put<GitSetup>(`/api/git-setups/${encodeURIComponent(id)}`, input).pipe(
      catchError((error: unknown) => fail(error, 'save the Git setup')),
    );
  }

  deleteGitSetup(id: string): Observable<void> {
    return this.http.delete<void>(`/api/git-setups/${encodeURIComponent(id)}`).pipe(
      catchError((error: unknown) => fail(error, 'delete the Git setup')),
    );
  }

  testGitSetup(id: string): Observable<GitConnectionTestResult> {
    return this.http.post<GitConnectionTestResult>(`/api/git-setups/${encodeURIComponent(id)}/test`, {}).pipe(
      catchError((error: unknown) => fail(error, 'test the Git connection')),
    );
  }

  previewHandoff(projectId: string, gitSetupId: string): Observable<DeliveryHandoffPreview> {
    return this.http.post<DeliveryHandoffPreview>(
      `${projectBase(projectId)}/delivery-handoffs/preview`,
      { gitSetupId },
    ).pipe(catchError((error: unknown) => fail(error, 'create the Git handoff preview')));
  }

  confirmHandoff(projectId: string, previewToken: string): Observable<DeliveryHandoff> {
    return this.http.post<DeliveryHandoff>(
      `${projectBase(projectId)}/delivery-handoffs/confirm`,
      { previewToken },
    ).pipe(catchError((error: unknown) => fail(error, 'complete the Git handoff')));
  }

  listHandoffs(projectId: string): Observable<readonly DeliveryHandoff[]> {
    return this.http.get<readonly DeliveryHandoff[]>(`${projectBase(projectId)}/delivery-handoffs`).pipe(
      catchError((error: unknown) => fail(error, 'load Git handoff history')),
    );
  }

  retryHandoff(projectId: string, handoffId: string): Observable<DeliveryHandoff> {
    return this.http.post<DeliveryHandoff>(
      `${projectBase(projectId)}/delivery-handoffs/${encodeURIComponent(handoffId)}/retry`,
      {},
    ).pipe(catchError((error: unknown) => fail(error, 'retry the Git handoff')));
  }

  markdownExportUrl(projectId: string): string {
    return `${projectBase(projectId)}/delivery-package/export.md`;
  }

  csvExportUrl(projectId: string): string {
    return `${projectBase(projectId)}/delivery-package/export.csv`;
  }

  printUrl(projectId: string): string {
    return `${projectBase(projectId)}/delivery-package/print`;
  }
}

function projectBase(projectId: string): string {
  return `/api/projects/${encodeURIComponent(projectId)}`;
}

function fail(error: unknown, action: string): Observable<never> {
  const serverMessage = error instanceof HttpErrorResponse && isRecord(error.error) &&
    typeof error.error['message'] === 'string' ? error.error['message'] : null;
  return throwError(() => new Error(
    serverMessage ?? `Unable to ${action}. Refresh the page and try again.`,
  ));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
