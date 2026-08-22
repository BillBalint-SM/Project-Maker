import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  ProjectDecisionReview,
  UpdateDecisionReviewInput,
} from '@project-maker/contracts';
import { catchError, type Observable, throwError } from 'rxjs';

import { genericHttpErrorMessage } from '../../shared/http-error-message';

@Injectable()
export class DecisionReviewApiService {
  private readonly http = inject(HttpClient);

  load(projectId: string): Observable<ProjectDecisionReview> {
    return this.http
      .get<ProjectDecisionReview>(this.endpoint(projectId))
      .pipe(
        catchError((error: unknown) =>
          throwError(
            () => new Error(genericHttpErrorMessage(
              error,
              'load the Decision Review',
              'Unable to load the Decision Review. Try again.',
            )),
          ),
        ),
      );
  }

  save(
    projectId: string,
    input: UpdateDecisionReviewInput,
  ): Observable<ProjectDecisionReview> {
    return this.http
      .put<ProjectDecisionReview>(this.endpoint(projectId), input)
      .pipe(
        catchError((error: unknown) =>
          throwError(
            () => new Error(genericHttpErrorMessage(
              error,
              'save the Decision Review',
              'Unable to save the Decision Review. Check the project state and try again.',
            )),
          ),
        ),
      );
  }

  private endpoint(projectId: string): string {
    return '/api/projects/' + encodeURIComponent(projectId) + '/decision-review';
  }
}
