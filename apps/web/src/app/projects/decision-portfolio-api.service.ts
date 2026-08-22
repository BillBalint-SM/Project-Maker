import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type {
  AssignProjectInitiativeInput,
  BusinessGoal,
  BusinessRoadmap,
  CreateFormalDecisionInput,
  FormalDecision,
  Initiative,
  PortfolioPage,
  PortfolioQuery,
  ProjectStatusUpdate,
  ProjectWorkspace,
  SaveProjectStatusUpdateInput,
  SaveRoadmapGroupInput,
} from '@project-maker/contracts';
import { catchError, Observable, throwError } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DecisionPortfolioApiService {
  private readonly http = inject(HttpClient);

  portfolio(query: PortfolioQuery): Observable<PortfolioPage> {
    let params = new HttpParams();
    for (const [key, value] of Object.entries({
      search: query.search,
      internalOwner: query.internalOwner,
      readiness: query.readinessBucket,
      score: query.decisionScoreBucket,
      due: query.due,
      decision: query.decision,
      health: query.health,
      goalId: query.goalId,
      initiativeId: query.initiativeId,
      archiveScope: query.archiveScope,
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize,
    })) {
      if (value !== undefined && value !== '') params = params.set(key, String(value));
    }
    for (const status of query.statuses ?? []) params = params.append('status', status);
    for (const preparation of query.preparationStates ?? []) {
      params = params.append('preparation', preparation);
    }
    return this.http.get<PortfolioPage>('/api/projects/portfolio-page', { params }).pipe(
      catchError((error: unknown) => this.fail(error, 'load the Project Portfolio')),
    );
  }

  roadmap(includeArchived = false): Observable<BusinessRoadmap> {
    const params = includeArchived ? new HttpParams().set('includeArchived', 'true') : undefined;
    return this.http.get<BusinessRoadmap>('/api/roadmap', { params }).pipe(
      catchError((error: unknown) => this.fail(error, 'load the roadmap')),
    );
  }

  createGoal(input: SaveRoadmapGroupInput): Observable<BusinessGoal> {
    return this.http.post<BusinessGoal>('/api/roadmap/goals', input).pipe(
      catchError((error: unknown) => this.fail(error, 'create the Business Goal')),
    );
  }

  updateGoal(goalId: string, input: SaveRoadmapGroupInput): Observable<BusinessGoal> {
    return this.http.put<BusinessGoal>(`/api/roadmap/goals/${encodeURIComponent(goalId)}`, input).pipe(
      catchError((error: unknown) => this.fail(error, 'save the Business Goal')),
    );
  }

  deleteGoal(goalId: string): Observable<void> {
    return this.http.delete<void>(`/api/roadmap/goals/${encodeURIComponent(goalId)}`).pipe(
      catchError((error: unknown) => this.fail(error, 'delete the Business Goal')),
    );
  }

  createInitiative(goalId: string, input: SaveRoadmapGroupInput): Observable<Initiative> {
    return this.http.post<Initiative>(
      `/api/roadmap/goals/${encodeURIComponent(goalId)}/initiatives`,
      input,
    ).pipe(catchError((error: unknown) => this.fail(error, 'create the Initiative')));
  }

  updateInitiative(initiativeId: string, input: SaveRoadmapGroupInput): Observable<Initiative> {
    return this.http.put<Initiative>(
      `/api/roadmap/initiatives/${encodeURIComponent(initiativeId)}`,
      input,
    ).pipe(catchError((error: unknown) => this.fail(error, 'save the Initiative')));
  }

  deleteInitiative(initiativeId: string): Observable<void> {
    return this.http.delete<void>(
      `/api/roadmap/initiatives/${encodeURIComponent(initiativeId)}`,
    ).pipe(catchError((error: unknown) => this.fail(error, 'delete the Initiative')));
  }

  assignProject(
    projectId: string,
    input: AssignProjectInitiativeInput,
  ): Observable<ProjectWorkspace> {
    return this.http.put<ProjectWorkspace>(
      `/api/projects/${encodeURIComponent(projectId)}/initiative`,
      input,
    ).pipe(catchError((error: unknown) => this.fail(error, 'assign the project')));
  }

  statusUpdates(projectId: string): Observable<readonly ProjectStatusUpdate[]> {
    return this.http.get<readonly ProjectStatusUpdate[]>(
      `/api/projects/${encodeURIComponent(projectId)}/status-updates`,
    ).pipe(catchError((error: unknown) => this.fail(error, 'load the status updates')));
  }

  createStatusUpdate(
    projectId: string,
    input: SaveProjectStatusUpdateInput,
  ): Observable<ProjectStatusUpdate> {
    return this.http.post<ProjectStatusUpdate>(
      `/api/projects/${encodeURIComponent(projectId)}/status-updates`,
      input,
    ).pipe(catchError((error: unknown) => this.fail(error, 'save the status update')));
  }

  updateStatusUpdate(
    projectId: string,
    statusUpdateId: string,
    input: SaveProjectStatusUpdateInput,
  ): Observable<ProjectStatusUpdate> {
    return this.http.put<ProjectStatusUpdate>(
      `/api/projects/${encodeURIComponent(projectId)}/status-updates/${encodeURIComponent(statusUpdateId)}`,
      input,
    ).pipe(catchError((error: unknown) => this.fail(error, 'update the status update')));
  }

  decisions(projectId: string): Observable<readonly FormalDecision[]> {
    return this.http.get<readonly FormalDecision[]>(
      `/api/projects/${encodeURIComponent(projectId)}/decisions`,
    ).pipe(catchError((error: unknown) => this.fail(error, 'load the decisions')));
  }

  createDecision(
    projectId: string,
    input: CreateFormalDecisionInput,
  ): Observable<FormalDecision> {
    return this.http.post<FormalDecision>(
      `/api/projects/${encodeURIComponent(projectId)}/decisions`,
      input,
    ).pipe(catchError((error: unknown) => this.fail(error, 'record the decision')));
  }

  private fail(error: unknown, action: string): Observable<never> {
    const serverMessage =
      error instanceof HttpErrorResponse &&
      typeof error.error === 'object' &&
      error.error !== null &&
      typeof (error.error as { message?: unknown }).message === 'string'
        ? (error.error as { message: string }).message
        : null;
    return throwError(
      () => new Error(serverMessage ?? `Unable to ${action}. Refresh the page and try again.`),
    );
  }
}
