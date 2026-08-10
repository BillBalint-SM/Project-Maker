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
  type CustomerFollowUpState,
  type ProjectStatus,
  type ProjectWorkspace,
  type UpdateCustomerFollowUpInput,
} from '@project-maker/contracts';

import {
  COCKPIT_OPERATION_POLICY,
  provideCockpitOperationPolicy,
  releaseCockpitOperationOnFinalize,
} from './cockpit-operation-policy';
import { DiscoveryFollowUpsComponent } from './discovery-follow-ups/discovery-follow-ups.component';
import type { AuditEventPage, CockpitView, StatusOption } from './project-api.models';
import { ProjectApiService } from './project-api.service';
import { ReadinessReviewComponent } from './readiness-review/readiness-review.component';

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
    DiscoveryFollowUpsComponent,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    JsonPipe,
    ReadinessReviewComponent,
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
  readonly pinging = computed(
    () => this.operationPolicy.activeOperation() === 'customer-follow-up-ping',
  );
  readonly reviewSending = computed(
    () => this.operationPolicy.activeOperation() === 'customer-review-email',
  );
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
          this.readinessRefreshKey.update((value) => value + 1);
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

  private setView(view: CockpitView): void {
    this.view.set(view);
    this.resetForm(view.project);
    this.resetFollowUpForm(view.followUp);
  }

  private applyWorkspaceResponse(project: ProjectWorkspace): void {
    const current = this.view();
    if (!current) {
      return;
    }
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
    });
    this.resetForm(project);
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

}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}
