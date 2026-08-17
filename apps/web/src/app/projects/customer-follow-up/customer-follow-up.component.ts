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
  CustomerFollowUpPingPreview,
  CustomerFollowUpReferenceOption,
  CustomerFollowUpState,
  UpdateCustomerFollowUpInput,
} from '@project-maker/contracts';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { DatePickerModule } from 'primeng/datepicker';
import { InputTextModule } from 'primeng/inputtext';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TextareaModule } from 'primeng/textarea';

import {
  COCKPIT_OPERATION_POLICY,
  releaseCockpitOperationOnFinalize,
} from '../cockpit-operation-policy';
import { CustomerFollowUpApiService } from './customer-follow-up-api.service';

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
  private readonly operationPolicy = inject(COCKPIT_OPERATION_POLICY);
  private readonly destroyRef = inject(DestroyRef);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);

  readonly projectId = input.required<string>();
  readonly archived = input.required<boolean>();
  readonly committedChange = output<void>();
  readonly state = signal<CustomerFollowUpState | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly draftFeedback = signal<string | null>(null);
  readonly sendResult = signal<string | null>(null);
  readonly preview = signal<CustomerFollowUpPingPreview | null>(null);
  readonly referenceOptions = signal<readonly CustomerFollowUpReferenceOption[]>([]);
  readonly saving = computed(
    () => this.operationPolicy.activeOperation() === 'customer-follow-up-save',
  );
  readonly previewing = computed(
    () => this.operationPolicy.activeOperation() === 'customer-follow-up-preview',
  );
  readonly pinging = computed(
    () => this.operationPolicy.activeOperation() === 'customer-follow-up-ping',
  );
  private previewFocusReturn: HTMLElement | null = null;

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
          this.loadReferenceOptions();
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
    const lease = this.operationPolicy.tryAcquire('customer-follow-up-save');
    if (!lease) {
      return;
    }
    this.actionError.set(null);
    this.api
      .updateSettings(this.projectId(), input)
      .pipe(
        releaseCockpitOperationOnFinalize(lease),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (state) => {
          this.applyState(state);
          this.draftFeedback.set('Customer follow-up settings saved.');
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
    const lease = this.operationPolicy.tryAcquire('customer-follow-up-save');
    if (!lease) {
      return;
    }
    this.actionError.set(null);
    this.draftFeedback.set(null);
    this.api
      .updateDraft(this.projectId(), {
        messageDraft: value.messageDraft,
        referencedFollowUpId: value.referencedFollowUpId || null,
        expectedVersion: current.draftVersion,
      })
      .pipe(
        releaseCockpitOperationOnFinalize(lease),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (state) => {
          this.applyState(state);
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
    const lease = this.operationPolicy.tryAcquire('customer-follow-up-preview');
    if (!lease) {
      return;
    }
    this.actionError.set(null);
    this.api
      .preview(this.projectId(), { expectedVersion: current.draftVersion })
      .pipe(
        releaseCockpitOperationOnFinalize(lease),
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

  sendPing(): void {
    const currentPreview = this.preview();
    if (!currentPreview || this.controlsDisabled()) {
      return;
    }
    const lease = this.operationPolicy.tryAcquire('customer-follow-up-ping');
    if (!lease) {
      return;
    }
    this.actionError.set(null);
    this.sendResult.set(null);
    this.api
      .send(this.projectId(), { previewToken: currentPreview.previewToken })
      .pipe(
        releaseCockpitOperationOnFinalize(lease),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.preview.set(null);
          this.sendResult.set('Ping elküldve az ügyfélnek.');
          this.reloadState();
          this.focusAfterNextRender('[data-testid="follow-up-send-result"]');
          this.committedChange.emit();
        },
        error: (error: Error) => {
          this.preview.set(null);
          this.actionError.set(error.message);
          this.committedChange.emit();
        },
      });
  }

  controlsDisabled(): boolean {
    return this.operationPolicy.busy() || this.archived();
  }

  reloadState(): void {
    this.api
      .load(this.projectId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (state) => {
          this.applyState(state);
          this.actionError.set(null);
          this.loadReferenceOptions();
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

  private applyState(state: CustomerFollowUpState): void {
    this.state.set(state);
    this.settingsForm.reset({
      enabled: state.enabled,
      intervalMinutes: state.intervalMinutes,
      expiresAt: state.expiresAt ? new Date(state.expiresAt) : null,
    });
    this.draftForm.reset(
      {
        messageDraft: state.messageDraft ?? '',
        referencedFollowUpId: state.referencedFollowUpId,
      },
      { emitEvent: false },
    );
  }

  private focusAfterNextRender(selector: string): void {
    afterNextRender(() => this.document.querySelector<HTMLElement>(selector)?.focus(), {
      injector: this.injector,
    });
  }
}
