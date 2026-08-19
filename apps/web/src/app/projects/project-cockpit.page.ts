import { DatePipe, JsonPipe } from '@angular/common';
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
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import {
  type NextActionOwnerRole,
  type ProjectStatus,
  type ProjectWorkspace,
} from '@project-maker/contracts';

import {
  COCKPIT_OPERATION_POLICY,
  provideCockpitOperationPolicy,
  releaseCockpitOperationOnFinalize,
} from './cockpit-operation-policy';
import { DiscoveryFollowUpsComponent } from './discovery-follow-ups/discovery-follow-ups.component';
import { DecisionReviewComponent } from './decision-review/decision-review.component';
import { CustomerFollowUpComponent } from './customer-follow-up/customer-follow-up.component';
import type { AuditEventPage, CockpitView } from './project-api.models';
import { ProjectApiService } from './project-api.service';
import { activeProjectStatusOptions, projectStatusLabel } from './project-status-label';
import { ReadinessReviewComponent } from './readiness-review/readiness-review.component';

type ActiveProjectStatus = Exclude<ProjectStatus, 'ARCHIVED'>;

@Component({
  selector: 'app-project-cockpit-page',
  imports: [
    ButtonModule,
    CardModule,
    ConfirmDialog,
    CustomerFollowUpComponent,
    DatePipe,
    DatePickerModule,
    DecisionReviewComponent,
    DiscoveryFollowUpsComponent,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    JsonPipe,
    ReadinessReviewComponent,
    ReactiveFormsModule,
    SelectModule,
    TagModule,
    TextareaModule,
  ],
  providers: [ConfirmationService, provideCockpitOperationPolicy()],
  templateUrl: './project-cockpit.page.html',
  styleUrl: './project-cockpit.page.scss',
})
export class ProjectCockpitPage implements OnInit {
  private readonly api = inject(ProjectApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly router = inject(Router);
  readonly operationPolicy = inject(COCKPIT_OPERATION_POLICY);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  readonly reviewFollowUpId = this.route.snapshot.queryParamMap.get('reviewFollowUpId');
  readonly reviewFollowUpVersion = this.route.snapshot.queryParamMap.get('reviewFollowUpVersion');
  readonly reviewCorrespondenceId = this.route.snapshot.queryParamMap.get('reviewCorrespondenceId');
  readonly statusOptions = activeProjectStatusOptions;
  readonly ownerRoleOptions = computed(() => {
    const project = this.view()?.project;
    return [
      { label: `PO/PM – ${project?.internalOwnerName || 'név hiányzik'}`, value: 'INTERNAL_OWNER' as const, disabled: !project?.internalOwnerName },
      { label: `Ügyfél – ${project?.customerContactName || 'név hiányzik'}`, value: 'CUSTOMER_CONTACT' as const, disabled: !project?.customerContactName },
    ];
  });
  readonly view = signal<CockpitView | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly saving = computed(
    () => this.operationPolicy.activeOperation() === 'workspace-save',
  );
  readonly transitioning = computed(() => {
    const operation = this.operationPolicy.activeOperation();
    return operation === 'project-archive' || operation === 'project-restore';
  });
  readonly deleting = computed(
    () => this.operationPolicy.activeOperation() === 'project-delete',
  );
  readonly cockpitMutationInProgress = this.operationPolicy.busy;
  readonly auditPage = signal<AuditEventPage | null>(null);
  readonly auditLoading = signal(false);
  readonly auditError = signal<string | null>(null);
  readonly readinessRefreshKey = signal(0);
  private auditRequestOffset = 0;
  private auditRequestToken = 0;

  readonly workspaceForm = new FormGroup({
    status: new FormControl<ActiveProjectStatus>('DRAFT', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    internalOwnerName: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(255)],
    }),
    nextActionOwnerRole: new FormControl<NextActionOwnerRole | null>(null),
    nextAction: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(10000)],
    }),
    dueAt: new FormControl<Date | null>(null),
  });
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
  readonly basicsSaving = computed(
    () => this.operationPolicy.activeOperation() === 'project-basics-save',
  );
  readonly basicsError = signal<string | null>(null);
  readonly basicsFeedback = signal<string | null>(null);

  ngOnInit(): void {
    this.loadCockpit();
  }

  loadCockpit(): void {
    if (!this.projectId) {
      this.loadError.set('The project URL is missing an ID. Return to the project list and open the project again.');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.loadError.set(null);
    this.actionError.set(null);
    this.feedback.set(null);
    this.auditRequestToken += 1;
    this.auditRequestOffset = 0;
    this.auditPage.set(null);
    this.auditError.set(null);
    this.auditLoading.set(false);
    this.api.loadCockpit(this.projectId).subscribe({
      next: (view) => {
        this.setView(view);
        this.loading.set(false);
        this.loadAuditEvents(0);
      },
      error: (error: Error) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  loadAuditEvents(offset: number): void {
    if (!this.view()) {
      return;
    }

    const requestToken = ++this.auditRequestToken;
    this.auditRequestOffset = offset;
    this.auditLoading.set(true);
    this.auditError.set(null);
    this.api.loadAuditEvents(this.projectId, offset).subscribe({
      next: (page) => {
        if (requestToken !== this.auditRequestToken) {
          return;
        }
        this.auditPage.set(page);
        this.auditLoading.set(false);
      },
      error: (error: Error) => {
        if (requestToken !== this.auditRequestToken) {
          return;
        }
        this.auditError.set(error.message);
        this.auditLoading.set(false);
      },
    });
  }

  retryAuditEvents(): void {
    this.loadAuditEvents(this.auditRequestOffset);
  }

  previousAuditPage(): void {
    const page = this.auditPage();
    if (!page || this.auditLoading() || page.offset === 0) {
      return;
    }
    this.loadAuditEvents(Math.max(0, page.offset - page.limit));
  }

  nextAuditPage(): void {
    const page = this.auditPage();
    if (!page || this.auditLoading() || page.nextOffset === null) {
      return;
    }
    this.loadAuditEvents(page.nextOffset);
  }

  canGoPreviousAuditPage(): boolean {
    const page = this.auditPage();
    return Boolean(page && page.offset > 0 && !this.auditLoading());
  }

  canGoNextAuditPage(): boolean {
    const page = this.auditPage();
    return Boolean(page && page.hasMore && !this.auditLoading());
  }

  refreshAuditEvents(): void {
    if (this.view()) {
      this.loadAuditEvents(0);
    }
  }

  statusLabel(status: ProjectStatus): string {
    return projectStatusLabel(status);
  }

  handleDiscoveryCommittedChange(): void {
    this.readinessRefreshKey.update((value) => value + 1);
    this.refreshAuditEvents();
  }

  saveWorkspace(): void {
    this.workspaceForm.markAllAsTouched();
    if (
      this.workspaceForm.invalid ||
      this.cockpitMutationInProgress() ||
      this.isArchived()
    ) {
      return;
    }

    const value = this.workspaceForm.getRawValue();
    const input = {
      status: value.status,
      internalOwnerName: emptyToNull(value.internalOwnerName),
      nextActionOwnerRole: value.nextActionOwnerRole,
      nextAction: emptyToNull(value.nextAction),
      dueAt: value.dueAt?.toISOString() ?? null,
    };
    const lease = this.operationPolicy.tryAcquire('workspace-save');
    if (!lease) {
      return;
    }
    this.actionError.set(null);
    this.feedback.set(null);
    this.api
      .updateWorkspace(this.projectId, input)
      .pipe(
        releaseCockpitOperationOnFinalize(lease),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (project) => {
          this.applyWorkspaceResponse(project);
          this.feedback.set('Workspace saved.');
          this.readinessRefreshKey.update((value) => value + 1);
          this.refreshAuditEvents();
        },
        error: (error: Error) => {
          this.actionError.set(error.message);
        },
      });
  }

  canEditBasics(): boolean {
    const view = this.view();
    return view?.project.status !== 'ARCHIVED' && view?.preparationStatus.state === 'SCHEMA_REQUIRED';
  }

  saveProjectBasics(): void {
    this.basicsForm.markAllAsTouched();
    if (
      this.basicsForm.invalid ||
      this.cockpitMutationInProgress() ||
      !this.canEditBasics()
    ) {
      return;
    }

    const value = this.basicsForm.getRawValue();
    const lease = this.operationPolicy.tryAcquire('project-basics-save');
    if (!lease) {
      return;
    }
    this.basicsError.set(null);
    this.basicsFeedback.set(null);
    this.api
      .updateProjectBasics(this.projectId, {
        name: value.name.trim(),
        internalOwnerName: value.internalOwnerName.trim(),
        customerContactName: value.customerContactName.trim(),
        customerContactEmail: value.customerContactEmail.trim(),
      })
      .pipe(
        releaseCockpitOperationOnFinalize(lease),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (project) => {
          this.applyWorkspaceResponse(project);
          this.basicsFeedback.set('Alapadatok mentve.');
        },
        error: (error: Error) => {
          this.basicsError.set(error.message);
        },
      });
  }

  archiveProject(): void {
    if (
      this.cockpitMutationInProgress() ||
      this.isArchived()
    ) {
      return;
    }
    const lease = this.operationPolicy.tryAcquire('project-archive');
    if (!lease) {
      return;
    }
    this.actionError.set(null);
    this.feedback.set(null);
    this.api
      .archiveProject(this.projectId)
      .pipe(
        releaseCockpitOperationOnFinalize(lease),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (project) => {
          this.applyWorkspaceResponse(project);
          this.feedback.set('Project archived.');
          this.readinessRefreshKey.update((value) => value + 1);
          this.refreshAuditEvents();
        },
        error: (error: Error) => {
          this.actionError.set(error.message);
        },
      });
  }

  restoreProject(): void {
    if (
      this.cockpitMutationInProgress() ||
      !this.isArchived()
    ) {
      return;
    }
    const lease = this.operationPolicy.tryAcquire('project-restore');
    if (!lease) {
      return;
    }
    this.actionError.set(null);
    this.feedback.set(null);
    this.api
      .restoreProject(this.projectId)
      .pipe(
        releaseCockpitOperationOnFinalize(lease),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (project) => {
          this.applyWorkspaceResponse(project);
          this.feedback.set('A projekt visszaállt Előkészítés alatt állapotba.');
          this.readinessRefreshKey.update((value) => value + 1);
          this.refreshAuditEvents();
        },
        error: (error: Error) => {
          this.actionError.set(error.message);
        },
      });
  }

  isArchived(): boolean {
    return this.view()?.cockpit.status === 'ARCHIVED';
  }

  requestProjectDeletion(): void {
    if (
      !this.isDeletableDraft() ||
      this.cockpitMutationInProgress()
    ) {
      return;
    }
    this.confirmationService.confirm({
      key: 'project-delete',
      header: 'Delete project?',
      message: 'Deletion is permanent. It succeeds only while this draft has no persisted activity.',
      defaultFocus: 'none',
      accept: () => this.deleteProject(),
    });
  }

  deleteProject(): void {
    if (
      !this.isDeletableDraft() ||
      this.cockpitMutationInProgress()
    ) {
      return;
    }
    const lease = this.operationPolicy.tryAcquire('project-delete');
    if (!lease) {
      return;
    }
    this.actionError.set(null);
    this.feedback.set(null);
    this.api
      .deleteProject(this.projectId)
      .pipe(
        releaseCockpitOperationOnFinalize(lease),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          void this.router.navigate(['/']);
        },
        error: (error: Error) => {
          this.actionError.set(error.message);
        },
      });
  }

  isDeletableDraft(): boolean {
    return this.view()?.cockpit.status === 'DRAFT';
  }

  private setView(view: CockpitView): void {
    this.view.set(view);
    this.resetForm(view.project);
  }

  private applyWorkspaceResponse(project: ProjectWorkspace): void {
    const current = this.view();
    if (!current) {
      return;
    }
    this.view.set({
      project,
      preparationStatus: current.preparationStatus,
      cockpit: {
        projectId: project.id,
        status: project.status,
        internalOwnerName: project.internalOwnerName,
        nextActionOwnerRole: project.nextActionOwnerRole,
        nextActionOwner: project.nextActionOwner,
        nextAction: project.nextAction,
        dueAt: project.dueAt,
      },
    });
    this.resetForm(project);
  }

  private resetForm(project: ProjectWorkspace): void {
    this.basicsForm.reset({
      name: project.name,
      internalOwnerName: project.internalOwnerName ?? '',
      customerContactName: project.customerContactName,
      customerContactEmail: project.customerContactEmail,
    });
    this.workspaceForm.reset({
      status: project.status as ActiveProjectStatus,
      internalOwnerName: project.internalOwnerName ?? '',
      nextActionOwnerRole: project.nextActionOwnerRole,
      nextAction: project.nextAction ?? '',
      dueAt: project.dueAt ? new Date(project.dueAt) : null,
    });

    if (project.status === 'ARCHIVED') {
      this.workspaceForm.disable();
      return;
    }

    this.workspaceForm.enable();
  }

}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function nonBlankValidator(control: AbstractControl): { nonBlank: true } | null {
  return typeof control.value === 'string' && control.value.trim().length > 0
    ? null
    : { nonBlank: true };
}
