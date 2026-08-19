import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import type {
  NextActionOwnerRole,
  ProjectActivityFeed,
  ProjectWorkspace,
} from '@project-maker/contracts';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { MessageModule } from 'primeng/message';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';

import { ProjectContextState } from './project-context/project-context.state';
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

  ngOnInit(): void {
    this.route.fragment
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((fragment) => {
        if (fragment === 'workspace') this.editCoordination();
      });
    this.loadCoordinationEditor();
    this.loadActivity();
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
