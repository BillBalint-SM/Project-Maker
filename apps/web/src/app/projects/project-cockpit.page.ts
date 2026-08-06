import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import type {
  CustomerFollowUpState,
  ProjectStatus,
  ProjectWorkspace,
  UpdateCustomerFollowUpInput,
} from '@project-maker/contracts';

import type { CockpitView, StatusOption } from './project-api.models';
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
    DatePipe,
    DatePickerModule,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    ReactiveFormsModule,
    RouterLink,
    SelectModule,
    TagModule,
    TextareaModule,
  ],
  templateUrl: './project-cockpit.page.html',
  styleUrl: './project-cockpit.page.scss',
})
export class ProjectCockpitPage implements OnInit {
  private readonly api = inject(ProjectApiService);
  private readonly route = inject(ActivatedRoute);

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
  readonly pinging = signal(false);
  readonly reviewSending = signal(false);

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
    this.api.loadCockpit(this.projectId).subscribe({
      next: (view) => {
        this.setView(view);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  saveWorkspace(): void {
    this.workspaceForm.markAllAsTouched();
    if (this.workspaceForm.invalid || this.saving() || this.isArchived()) {
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
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.followUpSaving.set(false);
      },
    });
  }

  sendFollowUpPing(): void {
    if (this.emailActionsDisabled() || !this.view()) {
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
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.pinging.set(false);
      },
    });
  }

  sendCustomerReviewEmail(): void {
    if (this.emailActionsDisabled() || !this.view()) {
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
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.reviewSending.set(false);
      },
    });
  }

  archiveProject(): void {
    if (this.transitioning() || this.isArchived() || this.pinging() || this.reviewSending()) {
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
      },
      error: (error: Error) => {
        this.actionError.set(error.message);
        this.transitioning.set(false);
      },
    });
  }

  restoreProject(): void {
    if (this.transitioning() || !this.isArchived()) {
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

  followUpControlsDisabled(): boolean {
    return (
      this.followUpSaving() ||
      this.pinging() ||
      this.reviewSending() ||
      this.saving() ||
      this.transitioning() ||
      this.isArchived()
    );
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
