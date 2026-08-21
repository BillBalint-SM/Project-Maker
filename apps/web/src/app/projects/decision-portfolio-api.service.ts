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
      catchError((error: unknown) => this.fail(error, 'betölteni a projektportfóliót')),
    );
  }

  roadmap(includeArchived = false): Observable<BusinessRoadmap> {
    const params = includeArchived ? new HttpParams().set('includeArchived', 'true') : undefined;
    return this.http.get<BusinessRoadmap>('/api/roadmap', { params }).pipe(
      catchError((error: unknown) => this.fail(error, 'betölteni a roadmapot')),
    );
  }

  createGoal(input: SaveRoadmapGroupInput): Observable<BusinessGoal> {
    return this.http.post<BusinessGoal>('/api/roadmap/goals', input).pipe(
      catchError((error: unknown) => this.fail(error, 'létrehozni az üzleti célt')),
    );
  }

  updateGoal(goalId: string, input: SaveRoadmapGroupInput): Observable<BusinessGoal> {
    return this.http.put<BusinessGoal>(`/api/roadmap/goals/${encodeURIComponent(goalId)}`, input).pipe(
      catchError((error: unknown) => this.fail(error, 'menteni az üzleti célt')),
    );
  }

  deleteGoal(goalId: string): Observable<void> {
    return this.http.delete<void>(`/api/roadmap/goals/${encodeURIComponent(goalId)}`).pipe(
      catchError((error: unknown) => this.fail(error, 'törölni az üzleti célt')),
    );
  }

  createInitiative(goalId: string, input: SaveRoadmapGroupInput): Observable<Initiative> {
    return this.http.post<Initiative>(
      `/api/roadmap/goals/${encodeURIComponent(goalId)}/initiatives`,
      input,
    ).pipe(catchError((error: unknown) => this.fail(error, 'létrehozni a kezdeményezést')));
  }

  updateInitiative(initiativeId: string, input: SaveRoadmapGroupInput): Observable<Initiative> {
    return this.http.put<Initiative>(
      `/api/roadmap/initiatives/${encodeURIComponent(initiativeId)}`,
      input,
    ).pipe(catchError((error: unknown) => this.fail(error, 'menteni a kezdeményezést')));
  }

  deleteInitiative(initiativeId: string): Observable<void> {
    return this.http.delete<void>(
      `/api/roadmap/initiatives/${encodeURIComponent(initiativeId)}`,
    ).pipe(catchError((error: unknown) => this.fail(error, 'törölni a kezdeményezést')));
  }

  assignProject(
    projectId: string,
    input: AssignProjectInitiativeInput,
  ): Observable<ProjectWorkspace> {
    return this.http.put<ProjectWorkspace>(
      `/api/projects/${encodeURIComponent(projectId)}/initiative`,
      input,
    ).pipe(catchError((error: unknown) => this.fail(error, 'hozzárendelni a projektet')));
  }

  statusUpdates(projectId: string): Observable<readonly ProjectStatusUpdate[]> {
    return this.http.get<readonly ProjectStatusUpdate[]>(
      `/api/projects/${encodeURIComponent(projectId)}/status-updates`,
    ).pipe(catchError((error: unknown) => this.fail(error, 'betölteni a státuszjelentéseket')));
  }

  createStatusUpdate(
    projectId: string,
    input: SaveProjectStatusUpdateInput,
  ): Observable<ProjectStatusUpdate> {
    return this.http.post<ProjectStatusUpdate>(
      `/api/projects/${encodeURIComponent(projectId)}/status-updates`,
      input,
    ).pipe(catchError((error: unknown) => this.fail(error, 'menteni a státuszjelentést')));
  }

  updateStatusUpdate(
    projectId: string,
    statusUpdateId: string,
    input: SaveProjectStatusUpdateInput,
  ): Observable<ProjectStatusUpdate> {
    return this.http.put<ProjectStatusUpdate>(
      `/api/projects/${encodeURIComponent(projectId)}/status-updates/${encodeURIComponent(statusUpdateId)}`,
      input,
    ).pipe(catchError((error: unknown) => this.fail(error, 'frissíteni a státuszjelentést')));
  }

  decisions(projectId: string): Observable<readonly FormalDecision[]> {
    return this.http.get<readonly FormalDecision[]>(
      `/api/projects/${encodeURIComponent(projectId)}/decisions`,
    ).pipe(catchError((error: unknown) => this.fail(error, 'betölteni a döntéseket')));
  }

  createDecision(
    projectId: string,
    input: CreateFormalDecisionInput,
  ): Observable<FormalDecision> {
    return this.http.post<FormalDecision>(
      `/api/projects/${encodeURIComponent(projectId)}/decisions`,
      input,
    ).pipe(catchError((error: unknown) => this.fail(error, 'rögzíteni a döntést')));
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
      () => new Error(serverMessage ?? `Nem sikerült ${action}. Frissítsd az oldalt, majd próbáld újra.`),
    );
  }
}
