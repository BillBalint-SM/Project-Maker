import { DatePipe, JsonPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
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
  discoveryFollowUpCategories,
  resolvedDiscoveryFollowUpStatuses,
  type CreateDiscoveryFollowUpInput,
  type CustomerFollowUpState,
  type DiscoveryFollowUp,
  type DiscoveryFollowUpCategory,
  type ProjectStatus,
  type ProjectWorkspace,
  type ResolveDiscoveryFollowUpInput,
  type UpdateCustomerFollowUpInput,
} from '@project-maker/contracts';
import { finalize } from 'rxjs';

import {
  COCKPIT_OPERATION_POLICY,
  provideCockpitOperationPolicy,
  releaseCockpitOperationOnFinalize,
  type CockpitOperationId,
} from './cockpit-operation-policy';
import type { AuditEventPage, CockpitView, StatusOption } from './project-api.models';
import { ProjectApiService } from './project-api.service';

type ActiveProjectStatus = Exclude<ProjectStatus, 'ARCHIVED'>;

const statusOptions: StatusOption[] = [
  { label: 'DRAFT', value: 'DRAFT' },
  { label: 'INTAKE_IN_PROGRESS', value: 'INTAKE_IN_PROGRESS' },
  { label: 'WAITING_INTERNAL', value: 'WAITING_INTERNAL' },
  { label: 'WAITING_CUSTOMER', value: 'WAITING_CUSTOMER' },
  { label: 'READY_FOR_PLANNING', value: 'READY_FOR_PLANNING' },
];

@Component({
  selector: 'app-project-cockpit-page',
  imports: [
    ButtonModule,
    CardModule,
    ConfirmDialog,
    DatePipe,
    DatePickerModule,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    JsonPipe,
    ReactiveFormsModule,
    RouterLink,
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
  readonly statusOptions = statusOptions;
  readonly view = signal<CockpitView | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly openedDiscoveryFollowUpResolutionId = signal<string | null>(null);
  readonly savingDiscoveryFollowUpResolutionId = signal<string | null>(null);
  readonly saving = computed(
    () => this.operationPolicy.activeOperation() === 'workspace-save',
  );
  readonly transitioning = computed(() => {
    const operation = this.operationPolicy.activeOperation();
    return operation === 'project-archive' || operation === 'project-restore';
  });
  readonly followUpSaving = computed(
    () => this.operationPolicy.activeOperation() === 'customer-follow-up-save',
  );
  readonly discoveryFollowUpSaving = computed(
    () => this.operationPolicy.activeOperation() === 'discovery-create',
  );
  readonly pinging = computed(
    () => this.operationPolicy.activeOperation() === 'customer-follow-up-ping',
  );
  readonly reviewSending = computed(
    () => this.operationPolicy.activeOperation() === 'customer-review-email',
  );
  readonly deleting = computed(
    () => this.operationPolicy.activeOperation() === 'project-delete',
  );
  readonly discoveryFollowUpMutationInProgress = computed(() => {
    const operation = this.operationPolicy.activeOperation();
    return operation === 'discovery-create' || operation === 'discovery-resolve';
  });
  readonly cockpitMutationInProgress = this.operationPolicy.busy;
  readonly auditPage = signal<AuditEventPage | null>(null);
  readonly auditLoading = signal(false);
  readonly auditError = signal<string | null>(null);
  private auditRequestOffset = 0;
  private auditRequestToken = 0;
  readonly discoveryFollowUpCategoryOptions = discoveryFollowUpCategories.map(
    (value) => ({ label: value, value }),
  );
  readonly resolvedDiscoveryFollowUpStatusOptions =
    resolvedDiscoveryFollowUpStatuses.map((value) => ({ label: value, value }));

  readonly workspaceForm = new FormGroup({
    status: new FormControl<ActiveProjectStatus>('DRAFT', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    ballOwner: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(255)],
    }),
    nextAction: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(10000)],
    }),
    dueAt: new FormControl<Date | null>(null),
  });

  readonly followUpForm = new FormGroup({
    enabled: new FormControl(false, {
      nonNullable: true,
    }),
    intervalMinutes: new FormControl(10_080, {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.min(1),
        Validators.max(525_600),
        Validators.pattern(/^\d+$/),
      ],
    }),
    expiresAt: new FormControl<Date | null>(null),
  });

  readonly discoveryFollowUpForm = new FormGroup({
    category: new FormControl<DiscoveryFollowUpCategory | null>(null, {
      validators: [Validators.required],
    }),
    question: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(10_000),
      ],
    }),
    owner: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(255),
      ],
    }),
    dueDate: new FormControl<Date | null>(null, {
      validators: [Validators.required],
    }),
    nextStep: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(10_000),
      ],
    }),
  });

  readonly discoveryFollowUpResolutionForm = new FormGroup({
    status: new FormControl<string | null>(null, {
      validators: [Validators.required],
    }),
    decisionOrAnswer: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.pattern(/\S/),
        Validators.maxLength(10_000),
      ],
    }),
  });

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
      ballOwner: emptyToNull(value.ballOwner),
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
          this.refreshAuditEvents();
        },
        error: (error: Error) => {
          this.actionError.set(error.message);
        },
      });
  }

  saveFollowUp(): void {
    this.followUpForm.markAllAsTouched();
    if (
      this.followUpForm.invalid ||
      this.deleting() ||
      this.followUpControlsDisabled() ||
      !this.view()
    ) {
      return;
    }

    const value = this.followUpForm.getRawValue();
    const input: UpdateCustomerFollowUpInput = {
      enabled: value.enabled,
      intervalMinutes: value.intervalMinutes,
      expiresAt: value.expiresAt?.toISOString() ?? null,
    };
    const lease = this.operationPolicy.tryAcquire('customer-follow-up-save');
    if (!lease) {
      return;
    }
    this.actionError.set(null);
    this.feedback.set(null);
    this.api
      .updateFollowUp(this.projectId, input)
      .pipe(
        releaseCockpitOperationOnFinalize(lease),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (followUp) => {
          this.applyFollowUpResponse(followUp);
          this.feedback.set('Customer follow-up settings saved.');
          this.refreshAuditEvents();
        },
        error: (error: Error) => {
          this.actionError.set(error.message);
        },
      });
  }

  createDiscoveryFollowUp(): void {
    this.discoveryFollowUpForm.markAllAsTouched();
    const current = this.view();
    const value = this.discoveryFollowUpForm.getRawValue();
    if (
      !current ||
      this.discoveryFollowUpControlsDisabled() ||
      !value.category ||
      !value.dueDate ||
      this.discoveryFollowUpForm.invalid
    ) {
      return;
    }

    const input: CreateDiscoveryFollowUpInput = {
      category: value.category,
      question: value.question.trim(),
      owner: value.owner.trim(),
      dueDate: toLocalDateOnly(value.dueDate),
      nextStep: value.nextStep.trim(),
    };
    const lease = this.operationPolicy.tryAcquire('discovery-create');
    if (!lease) {
      return;
    }
    this.actionError.set(null);
    this.feedback.set(null);
    this.api
      .createDiscoveryFollowUp(this.projectId, input)
      .pipe(
        releaseCockpitOperationOnFinalize(lease),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (created) => {
          this.view.update((existing) =>
            existing
              ? {
                  ...existing,
                  discoveryFollowUps: sortDiscoveryFollowUps([
                    ...existing.discoveryFollowUps,
                    created,
                  ]),
                }
              : existing,
          );
          this.resetDiscoveryFollowUpForm();
          this.feedback.set('Discovery follow-up created.');
          this.refreshAuditEvents();
        },
        error: (error: Error) => {
          this.actionError.set(error.message);
        },
      });
  }

  openDiscoveryFollowUpResolution(followUpId: string): void {
    const followUp = this.view()?.discoveryFollowUps.find(
      (candidate) => candidate.id === followUpId,
    );
    if (
      !followUp ||
      this.isDiscoveryFollowUpResolved(followUp) ||
      this.openedDiscoveryFollowUpResolutionId() !== null ||
      this.discoveryFollowUpResolutionControlsDisabled()
    ) {
      return;
    }

    this.actionError.set(null);
    this.openedDiscoveryFollowUpResolutionId.set(followUpId);
    this.resetDiscoveryFollowUpResolutionForm();
  }

  cancelDiscoveryFollowUpResolution(): void {
    if (this.savingDiscoveryFollowUpResolutionId() !== null) {
      return;
    }

    this.openedDiscoveryFollowUpResolutionId.set(null);
    this.resetDiscoveryFollowUpResolutionForm();
  }

  resolveDiscoveryFollowUp(followUpId: string): void {
    this.discoveryFollowUpResolutionForm.markAllAsTouched();
    const followUp = this.view()?.discoveryFollowUps.find(
      (candidate) => candidate.id === followUpId,
    );
    const value = this.discoveryFollowUpResolutionForm.getRawValue();
    if (
      !followUp ||
      this.openedDiscoveryFollowUpResolutionId() !== followUpId ||
      this.isDiscoveryFollowUpResolved(followUp) ||
      !value.status ||
      !resolvedDiscoveryFollowUpStatuses.includes(value.status) ||
      this.discoveryFollowUpResolutionForm.invalid ||
      this.discoveryFollowUpResolutionControlsDisabled()
    ) {
      return;
    }

    const input: ResolveDiscoveryFollowUpInput = {
      status: value.status,
      decisionOrAnswer: value.decisionOrAnswer.trim(),
    };
    const lease = this.operationPolicy.tryAcquire('discovery-resolve');
    if (!lease) {
      return;
    }
    this.savingDiscoveryFollowUpResolutionId.set(followUpId);
    this.actionError.set(null);
    this.feedback.set(null);
    this.api
      .resolveDiscoveryFollowUp(this.projectId, followUpId, input)
      .pipe(
        finalize(() => this.savingDiscoveryFollowUpResolutionId.set(null)),
        releaseCockpitOperationOnFinalize(lease),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (resolved) => {
          this.view.update((current) =>
            current
              ? {
                  ...current,
                  discoveryFollowUps: sortDiscoveryFollowUps(
                    current.discoveryFollowUps.map((candidate) =>
                      candidate.id === resolved.id ? resolved : candidate,
                    ),
                  ),
                }
              : current,
          );
          this.openedDiscoveryFollowUpResolutionId.set(null);
          this.resetDiscoveryFollowUpResolutionForm();
          this.feedback.set('Discovery follow-up resolved.');
          this.refreshAuditEvents();
        },
        error: (error: Error) => {
          this.actionError.set(error.message);
        },
      });
  }

  isDiscoveryFollowUpResolved(followUp: DiscoveryFollowUp): boolean {
    return resolvedDiscoveryFollowUpStatuses.includes(followUp.status);
  }

  isDiscoveryFollowUpResolutionOpen(followUpId: string): boolean {
    return this.openedDiscoveryFollowUpResolutionId() === followUpId;
  }

  isDiscoveryFollowUpResolutionSaving(followUpId: string): boolean {
    return (
      this.operationPolicy.activeOperation() === 'discovery-resolve' &&
      this.savingDiscoveryFollowUpResolutionId() === followUpId
    );
  }

  discoveryFollowUpResolutionControlsDisabled(): boolean {
    return this.cockpitMutationInProgress() || this.isArchived();
  }

  discoveryFollowUpResolveControlDisabled(): boolean {
    return (
      this.cockpitMutationInProgress() ||
      this.openedDiscoveryFollowUpResolutionId() !== null ||
      this.isArchived()
    );
  }

  sendFollowUpPing(): void {
    if (this.deleting() || this.emailActionsDisabled() || !this.view()) {
      return;
    }

    const input = {};
    const lease = this.operationPolicy.tryAcquire('customer-follow-up-ping');
    if (!lease) {
      return;
    }
    this.actionError.set(null);
    this.feedback.set(null);
    this.api
      .sendFollowUpPing(this.projectId, input)
      .pipe(
        releaseCockpitOperationOnFinalize(lease),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (followUp) => {
          this.applyFollowUpStatus(followUp);
          this.feedback.set('Customer follow-up ping sent.');
          this.refreshAuditEvents();
        },
        error: (error: Error) => {
          this.actionError.set(error.message);
          this.refreshAuditEvents();
        },
      });
  }

  sendCustomerReviewEmail(): void {
    if (this.deleting() || this.emailActionsDisabled() || !this.view()) {
      return;
    }

    const input = {};
    const lease = this.operationPolicy.tryAcquire('customer-review-email');
    if (!lease) {
      return;
    }
    this.actionError.set(null);
    this.feedback.set(null);
    this.api
      .sendCustomerReviewEmail(this.projectId, input)
      .pipe(
        releaseCockpitOperationOnFinalize(lease),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (delivery) => {
          this.feedback.set(
            `Customer review email sent using Markdown revision v${delivery.revisionVersion}.`,
          );
          this.refreshAuditEvents();
        },
        error: (error: Error) => {
          this.actionError.set(error.message);
          this.refreshAuditEvents();
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
          this.feedback.set('Project restored to DRAFT.');
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

  followUpControlsDisabled(): boolean {
    return this.cockpitMutationInProgress() || this.isArchived();
  }

  emailActionsDisabled(): boolean {
    return this.followUpControlsDisabled() || this.followUpForm.dirty;
  }

  discoveryFollowUpControlsDisabled(): boolean {
    return this.cockpitMutationInProgress() || this.isArchived();
  }

  private setView(view: CockpitView): void {
    this.view.set(view);
    this.openedDiscoveryFollowUpResolutionId.set(null);
    this.resetForm(view.project);
    this.resetFollowUpForm(view.followUp);
    this.resetDiscoveryFollowUpForm();
    this.resetDiscoveryFollowUpResolutionForm();
  }

  private applyWorkspaceResponse(project: ProjectWorkspace): void {
    const current = this.view();
    if (!current) {
      return;
    }
    const lifecycleStatusChanged = current.project.status !== project.status;
    this.view.set({
      project,
      cockpit: {
        projectId: project.id,
        status: project.status,
        ballOwner: project.ballOwner,
        nextAction: project.nextAction,
        dueAt: project.dueAt,
      },
      followUp: current.followUp,
      discoveryFollowUps: current.discoveryFollowUps,
    });
    this.resetForm(project);
    if (lifecycleStatusChanged) {
      this.openedDiscoveryFollowUpResolutionId.set(null);
      this.resetDiscoveryFollowUpResolutionForm();
    }
  }

  private applyFollowUpResponse(followUp: CustomerFollowUpState): void {
    this.view.update((current) => (current ? { ...current, followUp } : current));
    this.resetFollowUpForm(followUp);
  }

  private applyFollowUpStatus(followUp: CustomerFollowUpState): void {
    this.view.update((current) => (current ? { ...current, followUp } : current));
  }

  private resetForm(project: ProjectWorkspace): void {
    this.workspaceForm.reset({
      status: project.status as ActiveProjectStatus,
      ballOwner: project.ballOwner ?? '',
      nextAction: project.nextAction ?? '',
      dueAt: project.dueAt ? new Date(project.dueAt) : null,
    });

    if (project.status === 'ARCHIVED') {
      this.workspaceForm.disable();
      return;
    }

    this.workspaceForm.enable();
  }

  private resetFollowUpForm(followUp: CustomerFollowUpState): void {
    this.followUpForm.reset({
      enabled: followUp.enabled,
      intervalMinutes: followUp.intervalMinutes,
      expiresAt: followUp.expiresAt ? new Date(followUp.expiresAt) : null,
    });
  }

  private resetDiscoveryFollowUpForm(): void {
    this.discoveryFollowUpForm.reset({
      category: null,
      question: '',
      owner: '',
      dueDate: null,
      nextStep: '',
    });
  }

  private resetDiscoveryFollowUpResolutionForm(): void {
    this.discoveryFollowUpResolutionForm.reset({
      status: null,
      decisionOrAnswer: '',
    });
  }
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function toLocalDateOnly(value: Date): string {
  const year = String(value.getFullYear()).padStart(4, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function sortDiscoveryFollowUps(
  values: readonly DiscoveryFollowUp[],
): readonly DiscoveryFollowUp[] {
  return [...values].sort(
    (left, right) =>
      left.dueDate.localeCompare(right.dueDate) ||
      left.createdAt.localeCompare(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
}
