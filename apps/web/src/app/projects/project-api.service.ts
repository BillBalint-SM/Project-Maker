import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { forkJoin, map, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import type {
  CreateProjectInput,
  ProjectActivityFeed,
  ProjectPortfolioEntry,
  ProjectPreparationStatus,
  ProjectWorkState,
  ProjectWorkspace,
  PackagedPlaybookSummary,
  UpdateProjectPlaybookInput,
  UpdateProjectBasicsInput,
} from '@project-maker/contracts';

import {
  UpdateProjectWorkspaceInput,
} from './project-api.models';
import type { ProjectSettingsView } from './project-api.models';

@Injectable({ providedIn: 'root' })
export class ProjectApiService {
  private readonly http = inject(HttpClient);

  listProjects(): Observable<readonly ProjectWorkspace[]> {
    return this.http
      .get<readonly ProjectWorkspace[]>('/api/projects')
      .pipe(catchError((error: unknown) => this.fail(error, 'betölteni a projekteket')));
  }

  loadPortfolio(): Observable<readonly ProjectPortfolioEntry[]> {
    return this.http
      .get<readonly ProjectPortfolioEntry[]>('/api/projects/portfolio')
      .pipe(catchError((error: unknown) => this.fail(error, 'betölteni a projektportfóliót')));
  }

  createProject(input: CreateProjectInput): Observable<ProjectWorkspace> {
    return this.http
      .post<ProjectWorkspace>('/api/projects', input)
      .pipe(catchError((error: unknown) => this.fail(error, 'létrehozni a projektet')));
  }

  listPlaybooks(): Observable<readonly PackagedPlaybookSummary[]> {
    return this.http
      .get<readonly PackagedPlaybookSummary[]>('/api/playbooks')
      .pipe(catchError((error: unknown) => this.fail(error, 'betölteni a playbookokat')));
  }

  updateProjectPlaybook(
    projectId: string,
    input: UpdateProjectPlaybookInput,
  ): Observable<ProjectWorkspace> {
    return this.http
      .put<ProjectWorkspace>(`/api/projects/${encodeURIComponent(projectId)}/playbook`, input)
      .pipe(catchError((error: unknown) => this.fail(error, 'menteni a projekt playbookját')));
  }

  updateProjectBasics(
    projectId: string,
    input: UpdateProjectBasicsInput,
  ): Observable<ProjectWorkspace> {
    return this.http
      .patch<ProjectWorkspace>(
        `/api/projects/${encodeURIComponent(projectId)}/basics`,
        input,
      )
      .pipe(catchError((error: unknown) => this.fail(error, 'menteni a projekt alapadatait')));
  }

  loadProjectSettings(projectId: string): Observable<ProjectSettingsView> {
    return forkJoin({
      project: this.loadProjectWorkspace(projectId),
      preparationStatus: this.loadPreparationStatus(projectId),
    }).pipe(
      catchError((error: unknown) => this.fail(error, 'betölteni a projektbeállításokat')),
    );
  }

  loadPreparationStatus(projectId: string): Observable<ProjectPreparationStatus> {
    return this.http
      .get<ProjectPreparationStatus>(
        `/api/projects/${encodeURIComponent(projectId)}/preparation-status`,
      )
      .pipe(
        catchError((error: unknown) =>
          this.fail(error, 'betölteni a projekt felkészültségi állapotát'),
        ),
      );
  }

  loadWorkState(projectId: string): Observable<ProjectWorkState> {
    return this.http
      .get<ProjectWorkState>(`/api/projects/${encodeURIComponent(projectId)}/work-state`)
      .pipe(catchError((error: unknown) => this.fail(error, 'betölteni a projekt aktuális feladatát')));
  }

  loadProjectActivity(projectId: string): Observable<ProjectActivityFeed> {
    return this.http
      .get<ProjectActivityFeed>(`/api/projects/${encodeURIComponent(projectId)}/activity`)
      .pipe(catchError((error: unknown) => this.fail(error, 'betölteni a legutóbbi projektaktivitást')));
  }

  loadProjectWorkspace(projectId: string): Observable<ProjectWorkspace> {
    return this.listProjects().pipe(
      map((projects) => {
        const project = projects.find((candidate) => candidate.id === projectId);
        if (!project) {
          throw new Error('A projekt nem található. Térj vissza a projektlistához, és ellenőrizd újra.');
        }
        return project;
      }),
      catchError((error: unknown) =>
        this.fail(error, 'betölteni a projektkoordináció szerkesztési adatait'),
      ),
    );
  }

  updateWorkspace(
    projectId: string,
    input: UpdateProjectWorkspaceInput,
  ): Observable<ProjectWorkspace> {
    return this.http
      .patch<ProjectWorkspace>(
        `/api/projects/${encodeURIComponent(projectId)}/workspace`,
        input,
      )
      .pipe(catchError((error: unknown) => this.fail(error, 'menteni a projektkoordinációt')));
  }

  deleteProject(projectId: string): Observable<void> {
    return this.http
      .delete<void>(`/api/projects/${encodeURIComponent(projectId)}`)
      .pipe(catchError((error: unknown) => this.fail(error, deleteProjectAction)));
  }

  archiveProject(projectId: string): Observable<ProjectWorkspace> {
    return this.http
      .post<ProjectWorkspace>(
        `/api/projects/${encodeURIComponent(projectId)}/archive`,
        {},
      )
      .pipe(catchError((error: unknown) => this.fail(error, 'archiválni a projektet')));
  }

  restoreProject(projectId: string): Observable<ProjectWorkspace> {
    return this.http
      .post<ProjectWorkspace>(
        `/api/projects/${encodeURIComponent(projectId)}/restore`,
        {},
      )
      .pipe(catchError((error: unknown) => this.fail(error, 'visszaállítani a projektet')));
  }

  private fail(error: unknown, action: string): Observable<never> {
    const mapped = toActionableError(error, action);
    if (mapped.diagnostics) {
      console.error('Project API request failed.', mapped.diagnostics);
    }
    return throwError(() => new Error(mapped.userMessage));
  }
}

interface ActionableError {
  readonly userMessage: string;
  readonly diagnostics: { readonly action: string; readonly status: number; readonly statusText: string } | null;
}

const deleteProjectAction = 'végleg törölni a projektet';

function toActionableError(error: unknown, action: string): ActionableError {
  if (!(error instanceof HttpErrorResponse)) {
    return {
      userMessage: `Nem sikerült ${action}. Frissítsd az oldalt, majd próbáld újra.`,
      diagnostics: null,
    };
  }

  if (error.status === 0) {
    return {
      userMessage: `Nem sikerült ${action}, mert a szolgáltatás nem érhető el. Ellenőrizd a hálózati kapcsolatot, majd próbáld újra.`,
      diagnostics: { action, status: error.status, statusText: error.statusText },
    };
  }

  const nextStep = projectErrorNextStep(error.status, action);
  return {
    userMessage: `Nem sikerült ${action}. ${nextStep}`,
    diagnostics: { action, status: error.status, statusText: error.statusText },
  };
}

function projectErrorNextStep(status: number, action: string): string {
  if (status === 409) {
    if (action === deleteProjectAction) {
      return 'Csak DRAFT projekt törölhető. Ügyfélkommunikációs vagy Git-átadási előzmény esetén archiváld a projektet.';
    }
    return 'Töltsd újra a projektet, ellenőrizd a legfrissebb állapotát, majd ismételd meg a műveletet.';
  }

  if (status === 503) {
    return 'A szolgáltatás átmenetileg nem érhető el. Várj röviden, majd próbáld újra.';
  }

  if (status === 404) {
    return 'Térj vissza a projektlistához, és ellenőrizd, hogy a projekt még létezik-e.';
  }

  if (status === 400 || status === 422) {
    return 'Ellenőrizd a megadott értékeket, majd próbáld újra.';
  }

  return 'Frissítsd az oldalt, majd próbáld újra. Ha a hiba megmarad, jelezd az üzemeltetőnek.';
}
