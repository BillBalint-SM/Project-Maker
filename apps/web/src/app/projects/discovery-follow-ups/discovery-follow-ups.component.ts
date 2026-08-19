import { DOCUMENT } from '@angular/common';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  Injector,
  input,
  OnInit,
  output,
  signal,
  viewChild,
} from '@angular/core';
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
import type { OverlayOptions } from 'primeng/api';
import { Overlay } from 'primeng/overlay';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { TextareaModule } from 'primeng/textarea';
import { ZIndexUtils } from 'primeng/utils';
import {
  generalPlaybookV1,
  resolvedDiscoveryFollowUpStatuses,
  type CreateDiscoveryFollowUpInput,
  type DiscoveryFollowUp,
  type DiscoveryFollowUpCategory,
  type DiscoveryFollowUpSourceOption,
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
import {
  discoveryFollowUpCategoryLabel,
  discoveryFollowUpCategoryOptions,
} from './discovery-follow-up-label';

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
    Overlay,
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
  readonly reviewFollowUpId = input<string | null>(null);
  readonly reviewFollowUpVersion = input<string | null>(null);
  readonly reviewCorrespondenceId = input<string | null>(null);
  readonly committedChange = output<void>();

  private readonly api = inject(DiscoveryFollowUpsApiService);
  private readonly operationPolicy = inject(COCKPIT_OPERATION_POLICY);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

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
  readonly sourceOptions = signal<readonly DiscoveryFollowUpSourceOption[]>([]);
  readonly sourceOptionsLoading = signal(true);
  readonly sourceOptionsError = signal<string | null>(null);
  readonly openedSourceLinkId = signal<string | null>(null);
  readonly savingSourceLinkId = signal<string | null>(null);
  readonly sourceLinkBaseline = signal<DiscoveryFollowUp | null>(null);
  readonly pendingSourceRemoval = signal<DiscoveryFollowUp | null>(null);
  readonly sourceRemovalOverlay = viewChild<Overlay>('sourceRemovalOverlay');
  readonly sourceRemovalOverlayTarget = signal<string | null>(null);
  readonly sourceRemovalOverlayOptions: OverlayOptions = {
    hideOnEscape: false,
    listener: (_event, options) => options?.type !== 'outside',
  };
  private editConflictRefreshGeneration = 0;
  private sourceRemovalTrigger: HTMLButtonElement | null = null;
  private sourceRemovalRow: HTMLElement | null = null;

  readonly categoryOptions = discoveryFollowUpCategoryOptions;
  readonly categoryLabel = discoveryFollowUpCategoryLabel;
  readonly resolvedStatusOptions = resolvedDiscoveryFollowUpStatuses.map(
    (value) => ({ label: value, value }),
  );
  readonly sourceOptionChoices = computed(() =>
    this.sourceOptions().map((option) => ({
      label:
        '#' +
        option.order +
        ' · ' +
        option.topic +
        ' · ' +
        option.controlPoint +
        ' — ' +
        option.text,
      value: option.snapshotId,
    })),
  );
  readonly mutationDisabled = computed(
    () =>
      this.projectStatus() === 'ARCHIVED' ||
      this.operationPolicy.busy() ||
      this.pendingSourceRemoval() !== null,
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
    sourceSnapshotId: new FormControl<string | null>(null),
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

  readonly sourceLinkForm = new FormGroup({
    sourceSnapshotId: new FormControl<string | null>(null, {
      validators: [Validators.required],
    }),
  });

  constructor() {
    effect(() => {
      if (this.projectStatus() === 'ARCHIVED') {
        this.openedResolutionId.set(null);
        this.resetResolutionForm();
        this.clearEditState();
        this.clearSourceLinkState();
        this.pendingSourceRemoval.set(null);
        this.clearSourceRemovalFocusTargets();
      }
    });
    effect((onCleanup) => {
      if (this.pendingSourceRemoval() === null) {
        return;
      }

      const eventTarget = this.document.defaultView;
      if (!eventTarget) {
        return;
      }
      const handleKeydown = (event: KeyboardEvent): void => {
        this.cancelSourceLinkRemovalOnEscape(event);
      };
      eventTarget.addEventListener('keydown', handleKeydown, true);
      onCleanup(() => {
        eventTarget.removeEventListener('keydown', handleKeydown, true);
      });
    });
  }

  ngOnInit(): void {
    this.loadFollowUps();
    this.loadSourceOptions();
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
          const reviewFollowUpId = this.reviewFollowUpId();
          if (reviewFollowUpId && followUps.some((followUp) => followUp.id === reviewFollowUpId)) {
            afterNextRender(() => {
              const item = this.document.querySelector<HTMLElement>(`[data-follow-up-id="${reviewFollowUpId}"]`);
              item?.scrollIntoView({ block: 'center' });
              item?.focus();
            }, { injector: this.injector });
          }
        },
        error: (error: Error) => {
          this.loadError.set(error.message);
          this.loading.set(false);
        },
      });
  }

  loadSourceOptions(): void {
    this.sourceOptionsLoading.set(true);
    this.sourceOptionsError.set(null);
    this.creationForm.controls.sourceSnapshotId.disable({ emitEvent: false });
    this.api
      .listSourceOptions(this.projectId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (options) => {
          this.sourceOptions.set(options);
          this.creationForm.controls.sourceSnapshotId.enable({
            emitEvent: false,
          });
          this.sourceOptionsLoading.set(false);
        },
        error: (error: Error) => {
          this.sourceOptionsError.set(error.message);
          this.sourceOptionsLoading.set(false);
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
      ...(value.sourceSnapshotId === null
        ? {}
        : { sourceSnapshotId: value.sourceSnapshotId }),
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
          this.feedback.set('Az utánkövetés létrejött.');
          this.committedChange.emit();
        },
        error: (error: Error) => {
          this.actionError.set(error.message);
        },
      });
  }

  openSourceLink(followUpId: string): void {
    const followUp = this.followUps().find(
      (candidate) => candidate.id === followUpId,
    );
    if (
      !followUp ||
      !this.isCanonicalOpen(followUp) ||
      this.sourceLinkActionDisabled() ||
      this.sourceOptionsLoading() ||
      this.sourceOptionsError() !== null ||
      this.sourceOptions().length === 0
    ) {
      return;
    }

    this.actionError.set(null);
    this.sourceLinkForm.reset({ sourceSnapshotId: null });
    this.sourceLinkBaseline.set(followUp);
    this.openedSourceLinkId.set(followUpId);
  }

  saveSourceLink(followUpId: string): void {
    const baseline = this.sourceLinkBaseline();
    const selectedSourceId =
      this.sourceLinkForm.getRawValue().sourceSnapshotId;
    if (
      !baseline ||
      baseline.id !== followUpId ||
      selectedSourceId === null ||
      this.mutationDisabled() ||
      this.savingSourceLinkId() !== null
    ) {
      return;
    }

    const lease = this.operationPolicy.tryAcquire('discovery-source-link');
    if (!lease) {
      return;
    }

    this.savingSourceLinkId.set(followUpId);
    this.actionError.set(null);
    this.feedback.set(null);
    this.api
      .setSourceLink(this.projectId(), followUpId, {
        sourceSnapshotId: selectedSourceId,
        expectedVersion: baseline.version,
      })
      .pipe(
        finalize(() => this.savingSourceLinkId.set(null)),
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
          this.clearSourceLinkState();
          this.feedback.set('Az utánkövetés forrása frissült.');
          this.committedChange.emit();
        },
        error: (error: Error) => {
          this.actionError.set(error.message);
          if (isSourceLinkConflict(error)) {
            this.refreshSourceOptionsAfterLinkConflict();
          }
        },
      });
  }

  confirmSourceLinkRemoval(
    followUp: DiscoveryFollowUp,
    event: MouseEvent,
  ): void {
    if (
      !this.isCanonicalOpen(followUp) ||
      followUp.source === null ||
      this.sourceLinkActionDisabled()
    ) {
      return;
    }

    const trigger = event.currentTarget;
    if (!(trigger instanceof HTMLButtonElement)) {
      throw new Error(
        'Could not open source removal confirmation because its trigger is not a button.',
      );
    }
    const row = trigger.closest<HTMLElement>(
      '[data-testid="discovery-follow-up-item"]',
    );
    if (!row) {
      throw new Error(
        'Could not open source removal confirmation because its follow-up row was not found.',
      );
    }

    this.actionError.set(null);
    this.sourceRemovalTrigger = trigger;
    this.sourceRemovalRow = row;
    this.sourceRemovalOverlayTarget.set(this.sourceRemovalTriggerId(followUp.id));
    this.pendingSourceRemoval.set(followUp);
  }

  cancelSourceLinkRemoval(): void {
    const trigger = this.sourceRemovalTrigger;
    const row = this.sourceRemovalRow;

    this.pendingSourceRemoval.set(null);
    this.clearSourceRemovalFocusTargets();
    this.restoreSourceRemovalFocusAfterNextRender(trigger, row);
  }

  acceptSourceLinkRemoval(): void {
    const baseline = this.pendingSourceRemoval();
    if (!baseline) {
      return;
    }
    const row = this.sourceRemovalRow;
    if (!row) {
      throw new Error(
        'Could not remove the discovery follow-up source because its follow-up row was not captured.',
      );
    }

    const current = this.followUps().find(
      (candidate) => candidate.id === baseline.id,
    );
    if (
      this.projectStatus() === 'ARCHIVED' ||
      this.operationPolicy.busy() ||
      this.openedEditId() !== null ||
      this.openedResolutionId() !== null ||
      this.openedSourceLinkId() !== null ||
      this.savingSourceLinkId() !== null
    ) {
      this.actionError.set(
        'A forrás nem távolítható el, amíg egy másik projektművelet folyamatban van. Várd meg a befejezését, majd próbáld meg ismét.',
      );
      return;
    }
    if (
      !current ||
      !this.isCanonicalOpen(current) ||
      current.source === null
    ) {
      this.actionError.set(
        'A forráshivatkozás nem törölhető, mert az utánkövetés már nem nyitott vagy nincs hozzárendelt forrása. Frissítsd az utánkövetéseket, majd próbáld újra.',
      );
      return;
    }

    const lease = this.operationPolicy.tryAcquire('discovery-source-link');
    if (!lease) {
      this.actionError.set(
        'A forrás nem távolítható el, amíg egy másik projektművelet folyamatban van. Várd meg a befejezését, majd próbáld meg ismét.',
      );
      return;
    }

    this.pendingSourceRemoval.set(null);
    this.clearSourceRemovalFocusTargets();
    this.focusAfterNextRender(row, 'discovery follow-up row');
    this.savingSourceLinkId.set(baseline.id);
    this.actionError.set(null);
    this.feedback.set(null);
    this.api
      .setSourceLink(this.projectId(), baseline.id, {
        sourceSnapshotId: null,
        expectedVersion: baseline.version,
      })
      .pipe(
        finalize(() => this.savingSourceLinkId.set(null)),
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
          this.feedback.set('Az utánkövetés forráshivatkozása törölve.');
          this.committedChange.emit();
        },
        error: (error: Error) => this.actionError.set(error.message),
      });
  }

  clearSourceLinkState(): void {
    this.openedSourceLinkId.set(null);
    this.savingSourceLinkId.set(null);
    this.sourceLinkBaseline.set(null);
    this.sourceLinkForm.reset({ sourceSnapshotId: null });
  }

  private refreshSourceOptionsAfterLinkConflict(): void {
    this.sourceOptions.set([]);
    this.sourceLinkForm.reset({ sourceSnapshotId: null });
    this.loadSourceOptions();
  }

  sourceRemovalTriggerId(followUpId: string): string {
    return 'discovery-follow-up-source-remove-' + followUpId;
  }

  focusSourceRemovalCancelAfterEnter(): void {
    const cancel = this.document.querySelector<HTMLButtonElement>(
      '[data-testid="cancel-discovery-follow-up-source-remove-button"] button',
    );
    if (!cancel) {
      throw new Error(
        'Could not focus source removal cancel because it is not available.',
      );
    }

    cancel.focus();
    if (this.document.activeElement !== cancel) {
      throw new Error('Could not focus source removal cancel.');
    }
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
          this.feedback.set('Az utánkövetés módosításai mentve.');
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
              'Az utánkövetés időközben megváltozott. A piszkozat megmaradt; mentés előtt töltsd be az aktuális verziót.',
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
              'Az utánkövetés frissítés után nem található. Mentés előtt próbáld újra a frissítést.',
            );
            return;
          }

          if (!this.isCanonicalOpen(refreshedFollowUp)) {
            this.actionError.set(
              'A lezárt utánkövetés már nem szerkeszthető. Vesd el ezt a piszkozatot.',
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
      this.openedSourceLinkId() !== null ||
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
          this.feedback.set('Az utánkövetés lezárva.');
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
      this.openedResolutionId() !== null ||
      this.openedSourceLinkId() !== null
    );
  }

  sourceLinkActionDisabled(): boolean {
    return (
      this.mutationDisabled() ||
      this.openedEditId() !== null ||
      this.openedResolutionId() !== null ||
      this.openedSourceLinkId() !== null
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
      this.openedEditId() !== null ||
      this.openedSourceLinkId() !== null
    );
  }

  private resetCreationForm(): void {
    this.creationForm.reset({
      category: null,
      question: '',
      owner: '',
      dueDate: null,
      sourceSnapshotId: null,
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

  private clearSourceRemovalFocusTargets(): void {
    this.sourceRemovalTrigger = null;
    this.sourceRemovalRow = null;
    this.sourceRemovalOverlayTarget.set(null);
  }

  private cancelSourceLinkRemovalOnEscape(event: KeyboardEvent): void {
    if (
      event.key !== 'Escape' ||
      this.pendingSourceRemoval() === null ||
      !this.isSourceRemovalOverlayTopmost()
    ) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    this.cancelSourceLinkRemoval();
  }

  private isSourceRemovalOverlayTopmost(): boolean {
    const overlayElement = this.sourceRemovalOverlay()?.overlayEl();
    return (
      overlayElement instanceof HTMLElement &&
      ZIndexUtils.get(overlayElement) === ZIndexUtils.getCurrent()
    );
  }

  private restoreSourceRemovalFocusAfterNextRender(
    trigger: HTMLButtonElement | null,
    row: HTMLElement | null,
  ): void {
    afterNextRender(
      () => {
        if (trigger?.isConnected && !trigger.disabled) {
          trigger.focus();
          if (this.document.activeElement === trigger) {
            return;
          }
        }

        if (row?.isConnected && row.tabIndex === -1) {
          row.focus();
          if (this.document.activeElement === row) {
            return;
          }
        }

        throw new Error(
          'Could not restore source removal focus because neither the trigger nor its follow-up row is available and focusable.',
        );
      },
      { injector: this.injector },
    );
  }

  private focusAfterNextRender(
    target: HTMLElement,
    targetDescription: string,
  ): void {
    afterNextRender(
      () => {
        if (!target.isConnected) {
          throw new Error(
            'Could not restore focus to the ' +
              targetDescription +
              ' because it is no longer available.',
          );
        }

        target.focus();
        if (this.document.activeElement !== target) {
          throw new Error(
            'Could not restore focus to the ' + targetDescription + '.',
          );
        }
      },
      { injector: this.injector },
    );
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

function isSourceLinkConflict(error: Error): boolean {
  return (
    error instanceof DiscoveryFollowUpsApiError &&
    error.operation === 'set-source-link' &&
    error.status === 409
  );
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
