import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { catchError, type Observable, throwError } from 'rxjs';
import type { ProjectReadiness } from '@project-maker/contracts';

@Injectable()
export class ReadinessReviewApiService {
  private readonly http = inject(HttpClient);

  load(projectId: string): Observable<ProjectReadiness> {
    return this.http
      .get<ProjectReadiness>(
        '/api/projects/' + encodeURIComponent(projectId) + '/readiness',
      )
      .pipe(
        catchError(() =>
          throwError(
            () =>
              new Error(
                'A felkészültség értékelése nem tölthető be. Próbáld újra.',
              ),
          ),
        ),
      );
  }
}
