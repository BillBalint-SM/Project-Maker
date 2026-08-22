import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  GovernedAttachment,
  GovernedAttachmentOwnerKind,
} from '@project-maker/contracts';
import { catchError, type Observable, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ProjectAttachmentsApiService {
  private readonly http = inject(HttpClient);

  list(projectId: string): Observable<readonly GovernedAttachment[]> {
    return this.http
      .get<readonly GovernedAttachment[]>(this.url(projectId, 'attachments'))
      .pipe(catchError((error: unknown) => fail(error, 'betölteni a kapcsolódó fájlokat')));
  }

  upload(
    projectId: string,
    ownerKind: GovernedAttachmentOwnerKind,
    ownerId: string,
    file: File,
  ): Observable<GovernedAttachment> {
    const body = new FormData();
    body.set('ownerKind', ownerKind);
    body.set('ownerId', ownerId);
    body.set('file', file, file.name);
    return this.http
      .post<GovernedAttachment>(this.url(projectId, 'attachments'), body)
      .pipe(catchError((error: unknown) => fail(error, 'feltölteni a kapcsolódó fájlt')));
  }

  remove(projectId: string, attachmentId: string): Observable<void> {
    return this.http
      .delete<void>(this.url(projectId, `attachments/${encodeURIComponent(attachmentId)}`))
      .pipe(catchError((error: unknown) => fail(error, 'eltávolítani a kapcsolódó fájlt')));
  }

  downloadUrl(projectId: string, attachmentId: string): string {
    return this.url(projectId, `attachments/${encodeURIComponent(attachmentId)}/download`);
  }

  private url(projectId: string, path: string): string {
    return `/api/projects/${encodeURIComponent(projectId)}/${path}`;
  }
}

function fail(error: unknown, action: string): Observable<never> {
  const nextStep = error instanceof HttpErrorResponse && error.status === 409
    ? ' A projekt vagy a kapcsolódó munkatétel időközben lezárult. Frissítsd az oldalt.'
    : ' Ellenőrizd a fájl típusát és méretét, majd próbáld újra.';
  return throwError(() => new Error(`Nem sikerült ${action}.${nextStep}`));
}
