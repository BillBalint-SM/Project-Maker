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
  generalPlaybookV1,
  resolvedDiscoveryFollowUpStatuses,
  type CreateDiscoveryFollowUpInput,
  type DiscoveryFollowUp,
  type DiscoveryFollowUpCategory,
  type ProjectStatus,
  type ResolveDiscoveryFollowUpInput,
  type UpdateDiscoveryFollowUpInput,
} from '@project-maker/contracts';
import { finalize } from 'rxjs';

import {
  COCKPIT_OPERATION_POLICY,
  releaseCockpitOperationOnFinalize,
} from '../cockpit-operation-policy';
import {
  DiscoveryFollowUpsApiError,
  DiscoveryFollowUpsApiService,
} from './discovery-follow-ups-api.service';

interface EditConflictRefreshSnapshot {
  readonly followUpId: string;
  readonly generation: number;
  readonly followUp: DiscoveryFollowUp;
}

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
  readonly openedEditId = signal<string | null>(null);
  readonly savingEditId = signal<string | null>(null);
  readonly editBaseline = signal<DiscoveryFollowUp | null>(null);
  readonly editConflictId = signal<string | null>(null);
  readonly refreshingEditConflict = signal(false);
  readonly refreshedEditConflict = signal<EditConflictRefreshSnapshot | null>(
    null,
  );
  private editConflictRefreshGeneration = 0;

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

  readonly editForm = new FormGroup({
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

  constructor() {
    effect(() => {
      if (this.projectStatus() === 'ARCHIVED') {
        this.openedResolutionId.set(null);
        this.resetResolutionForm();
        this.clearEditState();
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

  openEdit(followUpId: string): void {
    const followUp = this.followUps().find(
      (candidate) => candidate.id === followUpId,
    );
    if (
      !followUp ||
      !this.isCanonicalOpen(followUp) ||
      this.editActionDisabled()
    ) {
      return;
    }

    this.actionError.set(null);
    this.prefillEditForm(followUp);
    this.openedEditId.set(followUpId);
    this.editBaseline.set(followUp);
    this.editConflictId.set(null);
    this.refreshedEditConflict.set(null);
  }

  cancelEdit(): void {
    if (this.savingEditId() !== null) {
      return;
    }

    this.clearEditState();
  }

  saveEdit(followUpId: string): void {
    this.editForm.markAllAsTouched();
    const followUp = this.followUps().find(
      (candidate) => candidate.id === followUpId,
    );
    const baseline = this.editBaseline();
    const value = this.editForm.getRawValue();
    if (
      !followUp ||
      !baseline ||
      this.openedEditId() !== followUpId ||
      baseline.id !== followUpId ||
      followUp.version !== baseline.version ||
      !this.isCanonicalOpen(followUp) ||
      !value.category ||
      !value.dueDate ||
      this.editForm.invalid ||
      !this.hasEditChanges() ||
      this.editControlDisabled()
    ) {
      return;
    }

    const input: UpdateDiscoveryFollowUpInput = {
      category: value.category,
      question: value.question.trim(),
      owner: value.owner.trim(),
      dueDate: toLocalDateOnly(value.dueDate),
      nextStep: value.nextStep.trim(),
      expectedVersion: baseline.version,
    };
    const lease = this.operationPolicy.tryAcquire('discovery-update');
    if (!lease) {
      return;
    }

    this.savingEditId.set(followUpId);
    this.actionError.set(null);
    this.feedback.set(null);
    this.api
      .update(this.projectId(), followUpId, input)
      .pipe(
        finalize(() => this.savingEditId.set(null)),
        releaseCockpitOperationOnFinalize(lease),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (updated) => {
          this.followUps.update((current) =>
            sortDiscoveryFollowUps(
              current.map((candidate) =>
                candidate.id === updated.id ? updated : candidate,
              ),
            ),
          );
          this.clearEditState();
          this.feedback.set('Discovery follow-up updated.');
          this.committedChange.emit();
        },
        error: (error: Error) => {
          if (
            error instanceof DiscoveryFollowUpsApiError &&
            error.operation === 'update' &&
            error.status === 409
          ) {
            this.editConflictId.set(followUpId);
            this.actionError.set(
              'This discovery follow-up changed on the server. Your draft is kept and reload is required before saving.',
            );
            this.refreshAfterEditConflict(followUpId);
            return;
          }

          this.actionError.set(error.message);
        },
      });
  }

  refreshAfterEditConflict(followUpId: string): void {
    if (
      this.openedEditId() !== followUpId ||
      this.editConflictId() !== followUpId ||
      this.refreshingEditConflict()
    ) {
      return;
    }

    const generation = this.editConflictRefreshGeneration + 1;
    this.editConflictRefreshGeneration = generation;
    this.refreshingEditConflict.set(true);
    this.refreshedEditConflict.set(null);
    this.api
      .list(this.projectId())
      .pipe(
        finalize(() => {
          if (this.isCurrentEditConflictRefresh(followUpId, generation)) {
            this.refreshingEditConflict.set(false);
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (followUps) => {
          if (!this.isCurrentEditConflictRefresh(followUpId, generation)) {
            return;
          }

          const refreshedFollowUp = followUps.find(
            (candidate) => candidate.id === followUpId,
          );
          this.followUps.set(sortDiscoveryFollowUps(followUps));
          if (!refreshedFollowUp) {
            this.actionError.set(
              'The current discovery follow-up could not be found after refresh. Retry the refresh before saving.',
            );
            return;
          }

          if (!this.isCanonicalOpen(refreshedFollowUp)) {
            this.actionError.set(
              'This discovery follow-up cannot be edited because it is terminal. Cancel this draft.',
            );
          }

          this.refreshedEditConflict.set({
            followUpId,
            generation,
            followUp: refreshedFollowUp,
          });
        },
        error: (error: Error) => {
          if (!this.isCurrentEditConflictRefresh(followUpId, generation)) {
            return;
          }

          this.actionError.set(error.message);
        },
      });
  }

  retryEditConflictRefresh(followUpId: string): void {
    this.refreshAfterEditConflict(followUpId);
  }

  reloadEditFromCurrent(): void {
    const followUpId = this.openedEditId();
    const snapshot = this.refreshedEditConflict();
    if (
      followUpId === null ||
      !snapshot ||
      snapshot.followUpId !== followUpId ||
      !this.isCurrentEditConflictRefresh(followUpId, snapshot.generation) ||
      this.projectStatus() === 'ARCHIVED' ||
      !this.isCanonicalOpen(snapshot.followUp) ||
      this.refreshingEditConflict()
    ) {
      return;
    }

    this.prefillEditForm(snapshot.followUp);
    this.editBaseline.set(snapshot.followUp);
    this.editConflictId.set(null);
    this.refreshedEditConflict.set(null);
    this.actionError.set(null);
  }

  openResolution(followUpId: string): void {
    const followUp = this.followUps().find(
      (candidate) => candidate.id === followUpId,
    );
    if (
      !followUp ||
      !this.isCanonicalOpen(followUp) ||
      this.openedResolutionId() !== null ||
      this.openedEditId() !== null ||
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
      !this.isCanonicalOpen(followUp) ||
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

  isCanonicalOpen(followUp: DiscoveryFollowUp): boolean {
    return followUp.status === generalPlaybookV1.statuses.followUp[0];
  }

  isEditOpen(followUpId: string): boolean {
    return this.openedEditId() === followUpId;
  }

  isEditSaving(followUpId: string): boolean {
    return (
      this.operationPolicy.activeOperation() === 'discovery-update' &&
      this.savingEditId() === followUpId
    );
  }

  hasEditChanges(): boolean {
    const baseline = this.editBaseline();
    const value = this.editForm.getRawValue();
    if (!baseline || !value.category || !value.dueDate) {
      return false;
    }

    return (
      value.category !== baseline.category ||
      value.question.trim() !== baseline.question ||
      value.owner.trim() !== baseline.owner ||
      toLocalDateOnly(value.dueDate) !== baseline.dueDate ||
      value.nextStep.trim() !== baseline.nextStep
    );
  }

  editControlDisabled(): boolean {
    const followUpId = this.openedEditId();
    const followUp = this.followUps().find(
      (candidate) => candidate.id === followUpId,
    );

    return (
      this.mutationDisabled() ||
      this.savingEditId() !== null ||
      this.editConflictId() !== null ||
      this.refreshingEditConflict() ||
      (followUpId !== null &&
        (!followUp || !this.isCanonicalOpen(followUp)))
    );
  }

  editActionDisabled(): boolean {
    return (
      this.mutationDisabled() ||
      this.openedEditId() !== null ||
      this.openedResolutionId() !== null
    );
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
    return (
      this.mutationDisabled() ||
      this.openedResolutionId() !== null ||
      this.openedEditId() !== null
    );
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

  private prefillEditForm(followUp: DiscoveryFollowUp): void {
    this.editForm.reset({
      category: followUp.category,
      question: followUp.question,
      owner: followUp.owner,
      dueDate: fromLocalDateOnly(followUp.dueDate),
      nextStep: followUp.nextStep,
    });
  }

  private resetEditForm(): void {
    this.editForm.reset({
      category: null,
      question: '',
      owner: '',
      dueDate: null,
      nextStep: '',
    });
  }

  private clearEditState(): void {
    this.invalidateEditConflictRefresh();
    this.openedEditId.set(null);
    this.editBaseline.set(null);
    this.editConflictId.set(null);
    this.resetEditForm();
  }

  canReloadEditFromCurrent(followUpId: string): boolean {
    const snapshot = this.refreshedEditConflict();
    return (
      this.openedEditId() === followUpId &&
      this.editConflictId() === followUpId &&
      snapshot !== null &&
      snapshot.followUpId === followUpId &&
      this.isCurrentEditConflictRefresh(followUpId, snapshot.generation) &&
      this.isCanonicalOpen(snapshot.followUp) &&
      !this.refreshingEditConflict()
    );
  }

  hasTerminalEditConflict(followUpId: string): boolean {
    const snapshot = this.refreshedEditConflict();
    return (
      this.openedEditId() === followUpId &&
      this.editConflictId() === followUpId &&
      snapshot !== null &&
      snapshot.followUpId === followUpId &&
      this.isCurrentEditConflictRefresh(followUpId, snapshot.generation) &&
      !this.isCanonicalOpen(snapshot.followUp) &&
      !this.refreshingEditConflict()
    );
  }

  private isCurrentEditConflictRefresh(
    followUpId: string,
    generation: number,
  ): boolean {
    return (
      this.editConflictRefreshGeneration === generation &&
      this.openedEditId() === followUpId &&
      this.editConflictId() === followUpId
    );
  }

  private invalidateEditConflictRefresh(): void {
    this.editConflictRefreshGeneration += 1;
    this.refreshingEditConflict.set(false);
    this.refreshedEditConflict.set(null);
  }
}

function toLocalDateOnly(value: Date): string {
  const year = String(value.getFullYear()).padStart(4, '0');
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return year + '-' + month + '-' + day;
}

function fromLocalDateOnly(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
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
