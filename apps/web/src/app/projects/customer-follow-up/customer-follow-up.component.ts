import { DOCUMENT, DatePipe } from '@angular/common';
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
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import type {
  CorrespondenceMailboxIdentity,
  CustomerFollowUpPingPreview,
  CustomerFollowUpManualAttempt,
  CustomerFollowUpReferenceOption,
  CustomerFollowUpState,
  FollowUpDeliveryStatus,
  UpdateCustomerFollowUpInput,
} from '@project-maker/contracts';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TextareaModule } from 'primeng/textarea';
import { finalize } from 'rxjs';

import { ProjectCommandPending } from '../project-command-pending';
import {
  CustomerFollowUpApiError,
  CustomerFollowUpApiService,
} from './customer-follow-up-api.service';

@Component({
  selector: 'app-customer-follow-up',
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
    TextareaModule,
  ],
  templateUrl: './customer-follow-up.component.html',
  styleUrl: './customer-follow-up.component.scss',
})
export class CustomerFollowUpComponent implements OnInit {
  private readonly api = inject(CustomerFollowUpApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  readonly projectId = input.required<string>();
  readonly archived = input.required<boolean>();
  readonly mode = input<'work' | 'settings'>('work');
  readonly committedChange = output<void>();
  readonly state = signal<CustomerFollowUpState | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly draftFeedback = signal<string | null>(null);
  readonly sendResult = signal<string | null>(null);
  readonly preview = signal<CustomerFollowUpPingPreview | null>(null);
  readonly retryConfirmation = signal<CustomerFollowUpManualAttempt | null>(null);
  readonly referenceOptions = signal<readonly CustomerFollowUpReferenceOption[]>([]);
  readonly senderIdentity = signal<CorrespondenceMailboxIdentity | null>(null);
  private readonly pending = new ProjectCommandPending();
  readonly savingDraft = computed(() => this.pending.isPending('save-draft'));
  readonly savingSettings = computed(() => this.pending.isPending('save-settings'));
  readonly previewing = computed(() => this.pending.isPending('preview'));
  readonly pinging = computed(() => this.pending.isPending('send') || this.pending.isPending('retry'));
  readonly scheduleValidationPaused = computed(() => {
    const current = this.state();
    const attemptState = current?.latestManualAttempt?.state;
    return current?.enabled === true
      && current.nextPingAt === null
      && attemptState !== 'SENDING'
      && attemptState !== 'UNKNOWN';
  });
  private previewFocusReturn: HTMLElement | null = null;
  private retryFocusReturn: HTMLElement | null = null;
  private recoveredPendingRefreshHandle: ReturnType<typeof setTimeout> | null = null;

  readonly settingsForm = new FormGroup({
    enabled: new FormControl(false, { nonNullable: true }),
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

  readonly draftForm = new FormGroup({
    messageDraft: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(10_000)],
    }),
    referencedFollowUpId: new FormControl<string | null>(null),
  });

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.clearRecoveredPendingRefresh();
    });
    let initialized = false;
    let wasArchived = false;
    effect(() => {
      const archived = this.archived();
      if (!initialized) {
        initialized = true;
        wasArchived = archived;
        return;
      }
      if (archived) {
        this.preview.set(null);
      } else if (wasArchived) {
        this.reload();
      }
      wasArchived = archived;
    });
  }

  ngOnInit(): void {
    this.draftForm.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.preview.set(null);
        this.sendResult.set(null);
      });
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api
      .load(this.projectId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (state) => {
          this.applyState(state);
          this.loading.set(false);
          if (this.mode() === 'work') {
            this.loadReferenceOptions();
            this.loadSenderIdentity();
          }
        },
        error: (error: Error) => {
          this.loadError.set(error.message);
          this.loading.set(false);
        },
      });
  }

  saveSettings(): void {
    this.settingsForm.markAllAsTouched();
    if (this.settingsForm.invalid || this.controlsDisabled() || !this.state()) {
      return;
    }
    const value = this.settingsForm.getRawValue();
    const input: UpdateCustomerFollowUpInput = {
      enabled: value.enabled,
      intervalMinutes: value.intervalMinutes,
      expiresAt: value.expiresAt?.toISOString() ?? null,
    };
    if (!this.pending.begin('save-settings')) return;
    this.actionError.set(null);
    this.api
      .updateSettings(this.projectId(), input)
      .pipe(
        finalize(() => this.pending.end('save-settings')),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (state) => {
          this.applyState(state, { preserveDraft: this.draftForm.dirty });
          this.draftFeedback.set('Az automatikus ügyfél-emlékeztető beállításai mentve lettek.');
          this.committedChange.emit();
        },
        error: (error: Error) => this.actionError.set(error.message),
      });
  }

  saveDraft(): void {
    this.draftForm.markAllAsTouched();
    const current = this.state();
    if (!current || this.draftForm.invalid || this.controlsDisabled()) {
      return;
    }
    const value = this.draftForm.getRawValue();
    if (!this.pending.begin('save-draft')) return;
    this.actionError.set(null);
    this.draftFeedback.set(null);
    this.api
      .updateDraft(this.projectId(), {
        messageDraft: value.messageDraft,
        referencedFollowUpId: value.referencedFollowUpId || null,
        expectedVersion: current.draftVersion,
      })
      .pipe(
        finalize(() => this.pending.end('save-draft')),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (state) => {
          this.applyState(state, { preserveSettings: this.settingsForm.dirty });
          this.draftFeedback.set('Piszkozat mentve.');
          this.committedChange.emit();
        },
        error: (error: Error) => this.actionError.set(error.message),
      });
  }

  previewPing(): void {
    const current = this.state();
    if (!current || this.draftForm.dirty || this.controlsDisabled() || !current.messageDraft) {
      return;
    }
    const trigger = this.document.querySelector<HTMLElement>(
      '[data-testid="preview-follow-up-ping-button"] button',
    );
    if (!this.pending.begin('preview')) return;
    this.actionError.set(null);
    this.api
      .preview(this.projectId(), {
        expectedVersion: current.draftVersion,
      })
      .pipe(
        finalize(() => this.pending.end('preview')),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (preview) => {
          this.preview.set(preview);
          this.previewFocusReturn = trigger;
          this.focusAfterNextRender('[data-testid="cancel-follow-up-preview-button"] button');
        },
        error: (error: Error) => this.actionError.set(error.message),
      });
  }

  cancelPreview(): void {
    const focusReturn = this.previewFocusReturn;
    this.preview.set(null);
    this.previewFocusReturn = null;
    if (focusReturn) {
      afterNextRender(() => focusReturn.isConnected && focusReturn.focus(), {
        injector: this.injector,
      });
    }
  }

  sendPing(acknowledgeDuplicateRisk = false): void {
    const currentPreview = this.preview();
    if (!currentPreview || this.controlsDisabled()) {
      return;
    }
    const uncertainAttempt = this.state()?.latestManualAttempt?.state === 'UNKNOWN'
      ? this.state()?.latestManualAttempt
      : null;
    if (uncertainAttempt && !acknowledgeDuplicateRisk) return;
    if (!this.pending.begin('send')) return;
    this.actionError.set(null);
    this.sendResult.set(null);
    this.api
      .send(this.projectId(), {
        previewToken: currentPreview.previewToken,
        ...(uncertainAttempt
          ? { acknowledgeDuplicateRiskForAttemptId: uncertainAttempt.attemptId }
          : {}),
      })
      .pipe(
        finalize(() => this.pending.end('send')),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.preview.set(null);
          this.sendResult.set('Átadva a levelezőrendszernek.');
          this.reloadState();
          this.focusAfterNextRender('[data-testid="follow-up-send-result"]');
          this.committedChange.emit();
        },
        error: (error: Error) => {
          if (
            error instanceof CustomerFollowUpApiError &&
            error.code === 'FOLLOW_UP_DELIVERY_UNKNOWN'
          ) {
            this.preview.set(null);
            this.actionError.set(error.message);
            this.reloadState(undefined, true);
            this.committedChange.emit();
            return;
          }
          if (
            error instanceof CustomerFollowUpApiError &&
            error.code === 'FOLLOW_UP_DELIVERY_FAILED'
          ) {
            this.preview.set(null);
            this.actionError.set(error.message);
            this.reloadState(undefined, true);
            this.committedChange.emit();
            return;
          }
          this.preview.set(null);
          this.actionError.set(error.message);
          this.committedChange.emit();
        },
      });
  }

  openRetryConfirmation(attempt: CustomerFollowUpManualAttempt): void {
    if (this.controlsDisabled()) return;
    const testId = attempt.state === 'UNKNOWN'
      ? 'retry-unknown-follow-up-ping-button'
      : 'retry-failed-follow-up-ping-button';
    this.retryFocusReturn = this.document.querySelector<HTMLElement>(
      `[data-testid="${testId}"] button`,
    );
    this.retryConfirmation.set(attempt);
    this.focusAfterNextRender('[data-testid="cancel-follow-up-retry-button"] button');
  }

  cancelRetry(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();
    const focusReturn = this.retryFocusReturn;
    this.retryConfirmation.set(null);
    this.retryFocusReturn = null;
    if (focusReturn) {
      afterNextRender(() => focusReturn.isConnected && focusReturn.focus(), {
        injector: this.injector,
      });
    }
  }

  retryPing(): void {
    const attempt = this.retryConfirmation();
    if (!attempt || this.controlsDisabled()) return;
    if (!this.pending.begin('retry')) return;
    this.actionError.set(null);
    this.sendResult.set(null);
    this.api.retry(this.projectId(), {
      attemptId: attempt.attemptId,
      acknowledgeDuplicateRisk: attempt.state === 'UNKNOWN',
    }).pipe(
      finalize(() => this.pending.end('retry')),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: () => {
        this.retryConfirmation.set(null);
        this.retryFocusReturn = null;
        this.sendResult.set('Átadva a levelezőrendszernek.');
        this.reloadState();
        this.focusAfterNextRender('[data-testid="follow-up-send-result"]');
        this.committedChange.emit();
      },
      error: (error: Error) => {
        this.retryConfirmation.set(null);
        this.retryFocusReturn = null;
        this.actionError.set(error.message);
        this.reloadState(undefined, true);
        this.committedChange.emit();
      },
    });
  }

  controlsDisabled(): boolean {
    return this.archived()
      || this.state()?.latestManualAttempt?.state === 'SENDING';
  }

  deliveryStatusLabel(status: FollowUpDeliveryStatus): string {
    return {
      NEVER: 'Még nem történt küldés',
      SENT: 'Sikeresen elküldve',
      FAILED: 'Sikertelen küldés',
    }[status];
  }

  deliveryErrorLabel(code: string | null): string {
    if (!code) return 'Nincs jelzett hiba';
    if (code === 'SMTP_DELIVERY_UNKNOWN') {
      return 'A kézbesítés eredménye bizonytalan.';
    }
    return 'A levelezőrendszer elutasította a küldést.';
  }

  reloadState(focusSelector?: string, preserveActionError = false): void {
    this.api
      .load(this.projectId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (state) => {
          this.applyState(state);
          if (!preserveActionError) this.actionError.set(null);
          if (this.mode() === 'work') {
            this.loadReferenceOptions();
            this.loadSenderIdentity();
          }
          if (focusSelector) this.focusAfterNextRender(focusSelector);
        },
        error: (error: Error) => this.actionError.set(error.message),
      });
  }

  private loadReferenceOptions(): void {
    this.api
      .listReferenceOptions(this.projectId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (options) => this.referenceOptions.set(options),
        error: (error: Error) => this.actionError.set(error.message),
      });
  }

  private loadSenderIdentity(): void {
    this.api.senderIdentity(this.projectId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (identity) => this.senderIdentity.set(identity),
        error: (error: Error) => this.actionError.set(error.message),
      });
  }

  private applyState(
    state: CustomerFollowUpState,
    options: {
      readonly preserveDraft?: boolean;
      readonly preserveSettings?: boolean;
    } = {},
  ): void {
    this.state.set(state);
    this.synchronizeRecoveredPendingLease(state);
    if (!options.preserveSettings) {
      this.settingsForm.reset({
        enabled: state.enabled,
        intervalMinutes: state.intervalMinutes,
        expiresAt: state.expiresAt ? new Date(state.expiresAt) : null,
      });
    }
    if (!options.preserveDraft) {
      this.draftForm.reset(
        {
          messageDraft: state.messageDraft ?? '',
          referencedFollowUpId: state.referencedFollowUpId,
        },
        { emitEvent: false },
      );
    }
  }

  private synchronizeRecoveredPendingLease(state: CustomerFollowUpState): void {
    if (state.latestManualAttempt?.state === 'SENDING') {
      this.scheduleRecoveredPendingRefresh();
      return;
    }
    this.clearRecoveredPendingRefresh();
  }

  private scheduleRecoveredPendingRefresh(): void {
    if (this.recoveredPendingRefreshHandle !== null) return;
    this.recoveredPendingRefreshHandle = setTimeout(() => {
      this.recoveredPendingRefreshHandle = null;
      this.api.load(this.projectId())
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (state) => this.applyState(state, {
            preserveDraft: true,
            preserveSettings: true,
          }),
          error: (error: Error) => {
            this.actionError.set(error.message);
            if (this.state()?.latestManualAttempt?.state === 'SENDING') {
              this.scheduleRecoveredPendingRefresh();
            }
          },
        });
    }, 1_000);
  }

  private clearRecoveredPendingRefresh(): void {
    if (this.recoveredPendingRefreshHandle === null) return;
    clearTimeout(this.recoveredPendingRefreshHandle);
    this.recoveredPendingRefreshHandle = null;
  }

  private focusAfterNextRender(selector: string): void {
    afterNextRender(() => this.document.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
