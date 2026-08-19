import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import type { ProjectStatus, ProjectWorkspace } from '@project-maker/contracts';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';

import {
  COCKPIT_OPERATION_POLICY,
  provideCockpitOperationPolicy,
  releaseCockpitOperationOnFinalize,
} from './cockpit-operation-policy';
import { CustomerFollowUpComponent } from './customer-follow-up/customer-follow-up.component';
import type { ProjectSettingsView } from './project-api.models';
import { ProjectApiService } from './project-api.service';
import { ProjectContextState } from './project-context/project-context.state';
import { activeProjectStatusOptions } from './project-status-label';

type ActiveProjectStatus = Exclude<ProjectStatus, 'ARCHIVED'>;

@Component({
  selector: 'app-project-settings-page',
  imports: [
    ButtonModule,
    CardModule,
    ConfirmDialog,
    CustomerFollowUpComponent,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    ReactiveFormsModule,
    SelectModule,
  ],
  providers: [ConfirmationService, provideCockpitOperationPolicy()],
  templateUrl: './project-settings.page.html',
  styleUrl: './project-settings.page.scss',
})
export class ProjectSettingsPage implements OnInit {
  private readonly api = inject(ProjectApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly projectContext = inject(ProjectContextState, { optional: true });
  readonly operationPolicy = inject(COCKPIT_OPERATION_POLICY);

  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  readonly view = signal<ProjectSettingsView | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly basicsError = signal<string | null>(null);
  readonly basicsFeedback = signal<string | null>(null);
  readonly lifecycleError = signal<string | null>(null);
  readonly lifecycleFeedback = signal<string | null>(null);
  readonly statusOptions = activeProjectStatusOptions;
  readonly busy = this.operationPolicy.busy;
  readonly basicsSaving = computed(
    () => this.operationPolicy.activeOperation() === 'project-basics-save',
  );
  readonly transitioning = computed(() => {
    const activeOperation = this.operationPolicy.activeOperation();
    return activeOperation === 'project-archive' || activeOperation === 'project-restore';
  });
  readonly deleting = computed(
    () => this.operationPolicy.activeOperation() === 'project-delete',
  );
  readonly lifecycleSaving = computed(
    () => this.operationPolicy.activeOperation() === 'project-status-save',
  );

  readonly basicsForm = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [nonBlankValidator, Validators.maxLength(255)],
    }),
    internalOwnerName: new FormControl('', {
      nonNullable: true,
      validators: [nonBlankValidator, Validators.maxLength(255)],
    }),
    customerContactName: new FormControl('', {
      nonNullable: true,
      validators: [nonBlankValidator, Validators.maxLength(255)],
    }),
    customerContactEmail: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(320)],
    }),
  });
  readonly lifecycleForm = new FormGroup({
    status: new FormControl<ActiveProjectStatus>('DRAFT', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    if (!this.projectId) {
      this.loadError.set('A projekt azonosítója hiányzik az útvonalból.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.loadError.set(null);
    this.actionError.set(null);
    this.feedback.set(null);
    this.api.loadProjectSettings(this.projectId).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (view) => {
        this.view.set(view);
        this.resetForms(view.project);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  canEditBasics(): boolean {
    const view = this.view();
    return view?.project.status !== 'ARCHIVED'
      && view?.preparationStatus.state === 'SCHEMA_REQUIRED';
  }

  saveProjectBasics(): void {
    this.basicsForm.markAllAsTouched();
    if (this.basicsForm.invalid || this.busy() || !this.canEditBasics()) return;

    const value = this.basicsForm.getRawValue();
    const lease = this.operationPolicy.tryAcquire('project-basics-save');
    if (!lease) return;
    this.basicsError.set(null);
    this.basicsFeedback.set(null);
    this.api.updateProjectBasics(this.projectId, {
      name: value.name.trim(),
      internalOwnerName: value.internalOwnerName.trim(),
      customerContactName: value.customerContactName.trim(),
      customerContactEmail: value.customerContactEmail.trim(),
    }).pipe(
      releaseCockpitOperationOnFinalize(lease),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (project) => {
        this.applyProject(project);
        this.basicsFeedback.set('A projekt alapadatai mentve lettek.');
        this.projectContext?.reload();
      },
      error: (error: Error) => this.basicsError.set(error.message),
    });
  }

  saveProjectStatus(): void {
    this.lifecycleForm.markAllAsTouched();
    if (this.lifecycleForm.invalid || this.busy() || this.isArchived()) return;

    const lease = this.operationPolicy.tryAcquire('project-status-save');
    if (!lease) return;
    this.lifecycleError.set(null);
    this.lifecycleFeedback.set(null);
    this.api.updateWorkspace(this.projectId, {
      status: this.lifecycleForm.controls.status.value,
    }).pipe(
      releaseCockpitOperationOnFinalize(lease),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (project) => {
        this.applyProject(project);
        this.lifecycleFeedback.set('A projekt életciklus-állapota frissítve lett.');
        this.projectContext?.reload();
      },
      error: (error: Error) => this.lifecycleError.set(error.message),
    });
  }

  requestProjectArchive(): void {
    if (this.busy() || this.isArchived()) return;
    this.confirmationService.confirm({
      key: 'project-archive',
      header: 'Projekt archiválása',
      message: 'Az archivált projekt kikerül az aktív munkából, és a módosításai letiltásra kerülnek. Az adatok olvashatók és később visszaállíthatók maradnak.',
      defaultFocus: 'none',
      accept: () => this.archiveProject(),
    });
  }

  archiveProject(): void {
    if (this.busy() || this.isArchived()) return;
    const lease = this.operationPolicy.tryAcquire('project-archive');
    if (!lease) return;
    this.actionError.set(null);
    this.feedback.set(null);
    this.api.archiveProject(this.projectId).pipe(
      releaseCockpitOperationOnFinalize(lease),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (project) => {
        this.applyProject(project);
        this.feedback.set('A projekt archiválva lett.');
        this.projectContext?.reload();
      },
      error: (error: Error) => this.actionError.set(error.message),
    });
  }

  restoreProject(): void {
    if (this.busy() || !this.isArchived()) return;
    const lease = this.operationPolicy.tryAcquire('project-restore');
    if (!lease) return;
    this.actionError.set(null);
    this.feedback.set(null);
    this.api.restoreProject(this.projectId).pipe(
      releaseCockpitOperationOnFinalize(lease),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (project) => {
        this.applyProject(project);
        this.feedback.set('A projekt visszaállt Előkészítés alatt állapotba.');
        this.projectContext?.reload();
      },
      error: (error: Error) => this.actionError.set(error.message),
    });
  }

  requestProjectDeletion(): void {
    if (this.busy() || !this.isDeletableDraft()) return;
    this.confirmationService.confirm({
      key: 'project-delete',
      header: 'Projekt végleges törlése',
      message: 'A törlés nem vonható vissza, és csak mentett projektmunka nélküli piszkozatnál hajtható végre.',
      defaultFocus: 'none',
      accept: () => this.deleteProject(),
    });
  }

  deleteProject(): void {
    if (this.busy() || !this.isDeletableDraft()) return;
    const lease = this.operationPolicy.tryAcquire('project-delete');
    if (!lease) return;
    this.actionError.set(null);
    this.feedback.set(null);
    this.api.deleteProject(this.projectId).pipe(
      releaseCockpitOperationOnFinalize(lease),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => void this.router.navigate(['/']),
      error: (error: Error) => this.actionError.set(error.message),
    });
  }

  isArchived(): boolean {
    return this.view()?.project.status === 'ARCHIVED';
  }

  isDeletableDraft(): boolean {
    return this.view()?.project.status === 'DRAFT';
  }

  private applyProject(project: ProjectWorkspace): void {
    this.view.update((current) => current ? { ...current, project } : current);
    this.resetForms(project);
  }

  private resetForms(project: ProjectWorkspace): void {
    this.basicsForm.reset({
      name: project.name,
      internalOwnerName: project.internalOwnerName ?? '',
      customerContactName: project.customerContactName,
      customerContactEmail: project.customerContactEmail,
    });
    if (project.status !== 'ARCHIVED') {
      this.lifecycleForm.reset({ status: project.status });
    }
  }
}

function nonBlankValidator(control: AbstractControl): { nonBlank: true } | null {
  return typeof control.value === 'string' && control.value.trim().length > 0
    ? null
    : { nonBlank: true };
}
