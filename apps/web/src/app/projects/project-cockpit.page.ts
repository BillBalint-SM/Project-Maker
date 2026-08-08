import { DatePipe, JsonPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
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
  type CreateDiscoveryFollowUpInput,
  type CustomerFollowUpState,
  type DiscoveryFollowUp,
  type DiscoveryFollowUpCategory,
  type ProjectStatus,
  type ProjectWorkspace,
  type UpdateCustomerFollowUpInput,
} from '@project-maker/contracts';

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
  providers: [ConfirmationService],
  templateUrl: './project-cockpit.page.html',
  styleUrl: './project-cockpit.page.scss',
})
export class ProjectCockpitPage implements OnInit {
  private readonly api = inject(ProjectApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly confirmationService = inject(ConfirmationService);
  private readonly router = inject(Router);

  readonly projectId = this.route.snapshot.paramMap.get('projectId') ?? '';
  readonly statusOptions = statusOptions;
  readonly view = signal<CockpitView | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly saving = signal(false);
  readonly transitioning = signal(false);
  readonly followUpSaving = signal(false);
  readonly discoveryFollowUpSaving = signal(false);
  readonly pinging = signal(false);
  readonly reviewSending = signal(false);
  readonly deleting = signal(false);
  readonly auditPage = signal<AuditEventPage | null>(null);
  readonly auditLoading = signal(false);
  readonly auditError = signal<string | null>(null);
  private auditRequestOffset = 0;
  private auditRequestToken = 0;
  readonly discoveryFollowUpCategoryOptions = discoveryFollowUpCategories.map(
    (value) => ({ label: value, value }),
  );

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
      this.saving() ||
      this.discoveryFollowUpSaving() ||
      this.deleting() ||
      this.isArchived()
    ) {
      return;
    }

    const value = this.workspaceForm.getRawValue();
    this.saving.set(true);
    this.actionError.set(null);
    this.feedback.set(null);
    this.api
      .updateWorkspace(this.projectId, {
        status: value.status,
        ballOwner: emptyToNull(value.ballOwner),
        nextAction: emptyToNull(value.nextAction),
        dueAt: value.dueAt?.toISOString() ?? null,
      })
      .subscribe({
        next: (project) => {
          this.applyWorkspaceResponse(project);
          this.feedback.set('Workspace saved.');
          this.saving.set(false);
          this.refreshAuditEvents();
        },
        error: (error: Error) => {
          this.actionError.set(error.message);
          this.saving.set(false);
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
    this.followUpSaving.set(true);
    this.actionError.set(null);
    this.feedback.set(null);
    this.api.updateFollowUp(this.projectId, input).subscribe({
      next: (followUp) => {
        this.applyFollowUpResponse(followUp);
        this.feedback.set('Customer follow-up settings saved.');
        this.followUpSaving.set(false);
        this.refreshAuditEvents();
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.followUpSaving.set(false);
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
    this.discoveryFollowUpSaving.set(true);
    this.actionError.set(null);
    this.feedback.set(null);
    this.api.createDiscoveryFollowUp(this.projectId, input).subscribe({
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
        this.discoveryFollowUpSaving.set(false);
        this.refreshAuditEvents();
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.discoveryFollowUpSaving.set(false);
      },
    });
  }

  sendFollowUpPing(): void {
    if (this.deleting() || this.emailActionsDisabled() || !this.view()) {
      return;
    }

    this.pinging.set(true);
    this.actionError.set(null);
    this.feedback.set(null);
    this.api.sendFollowUpPing(this.projectId, {}).subscribe({
      next: (followUp) => {
        this.applyFollowUpStatus(followUp);
        this.feedback.set('Customer follow-up ping sent.');
        this.pinging.set(false);
        this.refreshAuditEvents();
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.pinging.set(false);
        this.refreshAuditEvents();
      },
    });
  }

  sendCustomerReviewEmail(): void {
    if (this.deleting() || this.emailActionsDisabled() || !this.view()) {
      return;
    }

    this.reviewSending.set(true);
    this.actionError.set(null);
    this.feedback.set(null);
    this.api.sendCustomerReviewEmail(this.projectId, {}).subscribe({
      next: (delivery) => {
        this.feedback.set(
          `Customer review email sent using Markdown revision v${delivery.revisionVersion}.`,
        );
        this.reviewSending.set(false);
        this.refreshAuditEvents();
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.reviewSending.set(false);
        this.refreshAuditEvents();
      },
    });
  }

  archiveProject(): void {
    if (
      this.transitioning() ||
      this.deleting() ||
      this.isArchived() ||
      this.discoveryFollowUpSaving() ||
      this.pinging() ||
      this.reviewSending()
    ) {
      return;
    }
    this.transitioning.set(true);
    this.actionError.set(null);
    this.feedback.set(null);
    this.api.archiveProject(this.projectId).subscribe({
      next: (project) => {
        this.applyWorkspaceResponse(project);
        this.feedback.set('Project archived.');
        this.transitioning.set(false);
        this.refreshAuditEvents();
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.transitioning.set(false);
      },
    });
  }

  restoreProject(): void {
    if (
      this.transitioning() ||
      this.deleting() ||
      this.discoveryFollowUpSaving() ||
      !this.isArchived()
    ) {
      return;
    }
    this.transitioning.set(true);
    this.actionError.set(null);
    this.feedback.set(null);
    this.api.restoreProject(this.projectId).subscribe({
      next: (project) => {
        this.applyWorkspaceResponse(project);
        this.feedback.set('Project restored to DRAFT.');
        this.transitioning.set(false);
        this.refreshAuditEvents();
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.transitioning.set(false);
      },
    });
  }

  isArchived(): boolean {
    return this.view()?.cockpit.status === 'ARCHIVED';
  }

  requestProjectDeletion(): void {
    if (
      !this.isDeletableDraft() ||
      this.deleting() ||
      this.transitioning() ||
      this.saving() ||
      this.followUpSaving() ||
      this.discoveryFollowUpSaving() ||
      this.pinging() ||
      this.reviewSending()
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
      this.deleting() ||
      this.transitioning() ||
      this.saving() ||
      this.followUpSaving() ||
      this.discoveryFollowUpSaving() ||
      this.pinging() ||
      this.reviewSending()
    ) {
      return;
    }
    this.deleting.set(true);
    this.actionError.set(null);
    this.feedback.set(null);
    this.api.deleteProject(this.projectId).subscribe({
      next: () => {
        this.deleting.set(false);
        void this.router.navigate(['/']);
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.deleting.set(false);
      },
    });
  }

  isDeletableDraft(): boolean {
    return this.view()?.cockpit.status === 'DRAFT';
  }

  followUpControlsDisabled(): boolean {
    return (
      this.followUpSaving() ||
      this.pinging() ||
      this.reviewSending() ||
      this.discoveryFollowUpSaving() ||
      this.saving() ||
      this.transitioning() ||
      this.deleting() ||
      this.isArchived()
    );
  }

  emailActionsDisabled(): boolean {
    return this.followUpControlsDisabled() || this.followUpForm.dirty;
  }

  discoveryFollowUpControlsDisabled(): boolean {
    return (
      this.discoveryFollowUpSaving() ||
      this.saving() ||
      this.followUpSaving() ||
      this.pinging() ||
      this.reviewSending() ||
      this.transitioning() ||
      this.deleting() ||
      this.isArchived()
    );
  }

  private setView(view: CockpitView): void {
    this.view.set(view);
    this.resetForm(view.project);
    this.resetFollowUpForm(view.followUp);
    this.resetDiscoveryFollowUpForm();
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
      discoveryFollowUps: current.discoveryFollowUps,
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

  private resetDiscoveryFollowUpForm(): void {
    this.discoveryFollowUpForm.reset({
      category: null,
      question: '',
      owner: '',
      dueDate: null,
      nextStep: '',
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
