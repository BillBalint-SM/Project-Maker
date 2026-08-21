import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type {
  NextActionOwnerRole,
  ProjectActivityFeed,
  ProjectHealth,
  ProjectStatusUpdate,
  ProjectWorkspace,
  SaveProjectStatusUpdateInput,
} from '@project-maker/contracts';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';

import { ProjectContextState } from './project-context/project-context.state';
import { DecisionPortfolioApiService } from './decision-portfolio-api.service';
import { ProjectApiService } from './project-api.service';

@Component({
  selector: 'app-project-status-page',
  imports: [
    ButtonModule,
    CardModule,
    DatePipe,
    DatePickerModule,
    MessageModule,
    ReactiveFormsModule,
    RouterLink,
    SelectModule,
    TextareaModule,
  ],
  templateUrl: './project-status.page.html',
  styleUrl: './project-status.page.scss',
})
export class ProjectStatusPage implements OnInit {
  private readonly api = inject(ProjectApiService);
  private readonly decisionPortfolioApi = inject(DecisionPortfolioApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  readonly projectContext = inject(ProjectContextState);

  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  readonly coordinationLoading = signal(true);
  readonly coordinationLoadError = signal<string | null>(null);
  readonly coordinationWorkspace = signal<ProjectWorkspace | null>(null);
  readonly coordinationEditing = signal(false);
  readonly coordinationSaving = signal(false);
  readonly coordinationSaveError = signal<string | null>(null);
  readonly coordinationFeedback = signal<string | null>(null);
  readonly activityLoading = signal(true);
  readonly activityError = signal<string | null>(null);
  readonly activity = signal<ProjectActivityFeed | null>(null);
  readonly statusUpdates = signal<readonly ProjectStatusUpdate[]>([]);
  readonly statusUpdatesLoading = signal(true);
  readonly statusUpdatesError = signal<string | null>(null);
  readonly statusSaving = signal(false);
  readonly statusFeedback = signal<string | null>(null);
  readonly editingStatusId = signal<string | null>(null);
  readonly healthOptions = [
    { value: 'ON_TRACK' as const, label: 'Terv szerint' },
    { value: 'AT_RISK' as const, label: 'Kockázatos' },
    { value: 'BLOCKED' as const, label: 'Blokkolt' },
  ];
  readonly ownerRoleOptions = computed(() => {
    const project = this.coordinationWorkspace();
    return [
      {
        label: `Belső projektgazda – ${project?.internalOwnerName || 'név nincs beállítva'}`,
        value: 'INTERNAL_OWNER' as const,
        disabled: !project?.internalOwnerName,
      },
      {
        label: `Ügyfélkapcsolattartó – ${project?.customerContactName || 'név nincs beállítva'}`,
        value: 'CUSTOMER_CONTACT' as const,
        disabled: !project?.customerContactName,
      },
    ];
  });

  readonly coordinationForm = new FormGroup({
    nextActionOwnerRole: new FormControl<NextActionOwnerRole | null>(null),
    nextAction: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(10_000)],
    }),
    dueAt: new FormControl<Date | null>(null),
  });

  readonly statusForm = new FormGroup({
    health: new FormControl<ProjectHealth>('ON_TRACK', { nonNullable: true }),
    summary: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(2_000)],
    }),
    changes: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(4_000)],
    }),
    risks: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(4_000)],
    }),
    nextStep: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(2_000)],
    }),
  });

  ngOnInit(): void {
    this.route.fragment
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((fragment) => {
        if (fragment === 'workspace') this.editCoordination();
      });
    this.loadCoordinationEditor();
    this.loadActivity();
    this.loadStatusUpdates();
  }

  loadCoordinationEditor(): void {
    if (!this.projectId) {
      this.coordinationLoadError.set('A projekt azonosítója hiányzik az útvonalból.');
      this.coordinationLoading.set(false);
      return;
    }

    this.coordinationLoading.set(true);
    this.coordinationLoadError.set(null);
    this.api.loadProjectWorkspace(this.projectId).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (project) => {
        this.coordinationWorkspace.set(project);
        this.resetCoordinationForm(project);
        this.coordinationLoading.set(false);
        if (this.route.snapshot.fragment === 'workspace') {
          this.editCoordination();
        }
      },
      error: (error: Error) => {
        this.coordinationLoadError.set(error.message);
        this.coordinationLoading.set(false);
      },
    });
  }

  editCoordination(): void {
    const project = this.coordinationWorkspace();
    if (!project || project.status === 'ARCHIVED' || this.coordinationSaving()) {
      return;
    }
    this.coordinationSaveError.set(null);
    this.coordinationFeedback.set(null);
    this.resetCoordinationForm(project);
    this.coordinationEditing.set(true);
  }

  cancelCoordinationEdit(): void {
    const project = this.coordinationWorkspace();
    if (project) this.resetCoordinationForm(project);
    this.coordinationSaveError.set(null);
    this.coordinationEditing.set(false);
  }

  saveCoordination(): void {
    this.coordinationForm.markAllAsTouched();
    const project = this.coordinationWorkspace();
    if (
      !project ||
      project.status === 'ARCHIVED' ||
      this.coordinationForm.invalid ||
      this.coordinationSaving()
    ) {
      return;
    }

    const value = this.coordinationForm.getRawValue();
    this.coordinationSaving.set(true);
    this.coordinationSaveError.set(null);
    this.coordinationFeedback.set(null);
    this.api.updateWorkspace(this.projectId, {
      nextActionOwnerRole: value.nextActionOwnerRole,
      nextAction: emptyToNull(value.nextAction),
      dueAt: value.dueAt?.toISOString() ?? null,
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (updatedProject) => {
        this.coordinationWorkspace.set(updatedProject);
        this.resetCoordinationForm(updatedProject);
        this.coordinationSaving.set(false);
        this.coordinationEditing.set(false);
        this.coordinationFeedback.set('A projektkoordináció frissítve lett.');
        this.projectContext.reload();
      },
      error: (error: Error) => {
        this.coordinationSaveError.set(error.message);
        this.coordinationSaving.set(false);
      },
    });
  }

  loadActivity(): void {
    if (!this.projectId) {
      this.activityError.set('A projekt azonosítója hiányzik az útvonalból.');
      this.activityLoading.set(false);
      return;
    }

    this.activityLoading.set(true);
    this.activityError.set(null);
    this.activity.set(null);
    this.api.loadProjectActivity(this.projectId).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (activity) => {
        this.activity.set(activity);
        this.activityLoading.set(false);
      },
      error: (error: Error) => {
        this.activityError.set(error.message);
        this.activityLoading.set(false);
      },
    });
  }

  loadStatusUpdates(): void {
    if (!this.projectId) {
      this.statusUpdatesError.set('A projekt azonosítója hiányzik az útvonalból.');
      this.statusUpdatesLoading.set(false);
      return;
    }
    this.statusUpdatesLoading.set(true);
    this.statusUpdatesError.set(null);
    this.decisionPortfolioApi.statusUpdates(this.projectId).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (updates) => {
        this.statusUpdates.set(updates);
        this.statusUpdatesLoading.set(false);
      },
      error: (error: Error) => {
        this.statusUpdatesError.set(error.message);
        this.statusUpdatesLoading.set(false);
      },
    });
  }

  saveStatusUpdate(): void {
    this.statusForm.markAllAsTouched();
    if (this.statusForm.invalid || this.statusSaving() || this.isArchived()) return;
    const value = this.statusForm.getRawValue();
    const input: SaveProjectStatusUpdateInput = {
      health: value.health,
      summary: value.summary.trim(),
      changes: emptyToNull(value.changes),
      risks: emptyToNull(value.risks),
      nextStep: value.nextStep.trim(),
    };
    const editingId = this.editingStatusId();
    const request = editingId
      ? this.decisionPortfolioApi.updateStatusUpdate(this.projectId, editingId, input)
      : this.decisionPortfolioApi.createStatusUpdate(this.projectId, input);
    this.statusSaving.set(true);
    this.statusUpdatesError.set(null);
    this.statusFeedback.set(null);
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.statusSaving.set(false);
        this.statusFeedback.set(editingId ? 'A legfrissebb státusz frissítve lett.' : 'Az új státusz rögzítve lett.');
        this.cancelStatusEdit(false);
        this.loadStatusUpdates();
      },
      error: (error: Error) => {
        this.statusUpdatesError.set(error.message);
        this.statusSaving.set(false);
      },
    });
  }

  editStatusUpdate(update: ProjectStatusUpdate): void {
    if (!update.editable || this.isArchived() || this.statusSaving()) return;
    this.editingStatusId.set(update.id);
    this.statusFeedback.set(null);
    this.statusForm.reset({
      health: update.health,
      summary: update.summary,
      changes: update.changes ?? '',
      risks: update.risks ?? '',
      nextStep: update.nextStep,
    });
  }

  cancelStatusEdit(clearFeedback = true): void {
    this.editingStatusId.set(null);
    this.statusForm.reset({ health: 'ON_TRACK', summary: '', changes: '', risks: '', nextStep: '' });
    if (clearFeedback) this.statusFeedback.set(null);
  }

  healthLabel(health: ProjectHealth): string {
    return this.healthOptions.find((option) => option.value === health)?.label ?? health;
  }

  isArchived(): boolean {
    return this.coordinationWorkspace()?.status === 'ARCHIVED';
  }

  private resetCoordinationForm(project: ProjectWorkspace): void {
    this.coordinationForm.reset({
      nextActionOwnerRole: project.nextActionOwnerRole,
      nextAction: project.nextAction ?? '',
      dueAt: project.dueAt ? new Date(project.dueAt) : null,
    });
  }
}

function emptyToNull(value: string): string | null {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
