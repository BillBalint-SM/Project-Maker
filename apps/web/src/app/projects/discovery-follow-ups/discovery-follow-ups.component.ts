import { Component, computed, DestroyRef, effect, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
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
  type DiscoveryFollowUp,
  type DiscoveryFollowUpCategory,
  type ProjectStatus,
  type ResolveDiscoveryFollowUpInput,
} from '@project-maker/contracts';
import { finalize } from 'rxjs';

import {
  COCKPIT_OPERATION_POLICY,
  releaseCockpitOperationOnFinalize,
} from '../cockpit-operation-policy';
import { DiscoveryFollowUpsApiService } from './discovery-follow-ups-api.service';

@Component({
  selector: 'app-discovery-follow-ups',
  standalone: true,
  imports: [
    ButtonModule,
    CardModule,
    DatePickerModule,
    InputTextModule,
    MessageModule,
    ProgressSpinnerModule,
    ReactiveFormsModule,
    SelectModule,
    TagModule,
    TextareaModule,
  ],
  providers: [DiscoveryFollowUpsApiService],
  templateUrl: './discovery-follow-ups.component.html',
  styleUrl: './discovery-follow-ups.component.scss',
})
export class DiscoveryFollowUpsComponent implements OnInit {
  readonly projectId = input.required<string>();
  readonly projectStatus = input.required<ProjectStatus>();
  readonly committedChange = output<void>();

  private readonly api = inject(DiscoveryFollowUpsApiService);
  private readonly operationPolicy = inject(COCKPIT_OPERATION_POLICY);
  private readonly destroyRef = inject(DestroyRef);

  readonly followUps = signal<readonly DiscoveryFollowUp[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);
  readonly openedResolutionId = signal<string | null>(null);
  readonly savingResolutionId = signal<string | null>(null);

  readonly categoryOptions = discoveryFollowUpCategories.map(
    (value) => ({ label: value, value }),
  );
  readonly resolvedStatusOptions = resolvedDiscoveryFollowUpStatuses.map(
    (value) => ({ label: value, value }),
  );
  readonly mutationDisabled = computed(
    () =>
      this.projectStatus() === 'ARCHIVED' ||
      this.operationPolicy.busy(),
  );
  readonly creating = computed(
    () => this.operationPolicy.activeOperation() === 'discovery-create',
  );

  readonly creationForm = new FormGroup({
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

  readonly resolutionForm = new FormGroup({
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

  constructor() {
    effect(() => {
      if (this.projectStatus() === 'ARCHIVED') {
        this.openedResolutionId.set(null);
        this.resetResolutionForm();
      }
    });
  }

  ngOnInit(): void {
    this.loadFollowUps();
  }

  loadFollowUps(): void {
    this.loading.set(true);
    this.loadError.set(null);

    this.api
      .list(this.projectId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (followUps) => {
          this.followUps.set(sortDiscoveryFollowUps(followUps));
          this.loading.set(false);
        },
        error: (error: Error) => {
          this.loadError.set(error.message);
          this.loading.set(false);
        },
      });
  }

  createFollowUp(): void {
    this.creationForm.markAllAsTouched();
    const value = this.creationForm.getRawValue();
    if (
      this.mutationDisabled() ||
      !value.category ||
      !value.dueDate ||
      this.creationForm.invalid
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
      .create(this.projectId(), input)
      .pipe(
        releaseCockpitOperationOnFinalize(lease),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (created) => {
          this.followUps.update((current) =>
            sortDiscoveryFollowUps([...current, created]),
          );
          this.resetCreationForm();
          this.feedback.set('Discovery follow-up created.');
          this.committedChange.emit();
        },
        error: (error: Error) => {
          this.actionError.set(error.message);
        },
      });
  }

  openResolution(followUpId: string): void {
    const followUp = this.followUps().find(
      (candidate) => candidate.id === followUpId,
    );
    if (
      !followUp ||
      this.isResolved(followUp) ||
      this.openedResolutionId() !== null ||
      this.resolutionControlsDisabled()
    ) {
      return;
    }

    this.actionError.set(null);
    this.openedResolutionId.set(followUpId);
    this.resetResolutionForm();
  }

  cancelResolution(): void {
    if (this.savingResolutionId() !== null) {
      return;
    }

    this.openedResolutionId.set(null);
    this.resetResolutionForm();
  }

  resolveFollowUp(followUpId: string): void {
    this.resolutionForm.markAllAsTouched();
    const followUp = this.followUps().find(
      (candidate) => candidate.id === followUpId,
    );
    const value = this.resolutionForm.getRawValue();
    if (
      !followUp ||
      this.openedResolutionId() !== followUpId ||
      this.isResolved(followUp) ||
      !value.status ||
      !resolvedDiscoveryFollowUpStatuses.includes(value.status) ||
      this.resolutionForm.invalid ||
      this.resolutionControlsDisabled()
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

    this.savingResolutionId.set(followUpId);
    this.actionError.set(null);
    this.feedback.set(null);
    this.api
      .resolve(this.projectId(), followUpId, input)
      .pipe(
        finalize(() => this.savingResolutionId.set(null)),
        releaseCockpitOperationOnFinalize(lease),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (resolved) => {
          this.followUps.update((current) =>
            sortDiscoveryFollowUps(
              current.map((candidate) =>
                candidate.id === resolved.id ? resolved : candidate,
              ),
            ),
          );
          this.openedResolutionId.set(null);
          this.resetResolutionForm();
          this.feedback.set('Discovery follow-up resolved.');
          this.committedChange.emit();
        },
        error: (error: Error) => {
          this.actionError.set(error.message);
        },
      });
  }

  isResolved(followUp: DiscoveryFollowUp): boolean {
    return resolvedDiscoveryFollowUpStatuses.includes(followUp.status);
  }

  isResolutionOpen(followUpId: string): boolean {
    return this.openedResolutionId() === followUpId;
  }

  isResolutionSaving(followUpId: string): boolean {
    return (
      this.operationPolicy.activeOperation() === 'discovery-resolve' &&
      this.savingResolutionId() === followUpId
    );
  }

  resolutionControlsDisabled(): boolean {
    return this.mutationDisabled();
  }

  resolveControlDisabled(): boolean {
    return this.mutationDisabled() || this.openedResolutionId() !== null;
  }

  private resetCreationForm(): void {
    this.creationForm.reset({
      category: null,
      question: '',
      owner: '',
      dueDate: null,
      nextStep: '',
    });
  }

  private resetResolutionForm(): void {
    this.resolutionForm.reset({
      status: null,
      decisionOrAnswer: '',
    });
  }
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
