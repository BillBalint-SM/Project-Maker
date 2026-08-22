import { DatePipe, DOCUMENT } from '@angular/common';
import { afterNextRender, Component, effect, inject, Injector, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';
import type { CorrespondenceMailboxIdentity, HandoffVersionStatus, InterviewCustomerHandoffDetail, InterviewCustomerHandoffPreview, InterviewCustomerHandoffSummary } from '@project-maker/contracts';

import { InterviewHandoffApiService } from './interview-handoff-api.service';

@Component({
  selector: 'app-interview-handoff',
  imports: [ButtonModule, CardModule, ConfirmDialog, DatePipe, FormsModule, MessageModule, TextareaModule],
  providers: [ConfirmationService],
  templateUrl: './interview-handoff.component.html',
  styleUrl: './interview-handoff.component.scss',
})
export class InterviewHandoffComponent {
  private readonly api = inject(InterviewHandoffApiService);
  private readonly confirmation = inject(ConfirmationService);
  private readonly document = inject(DOCUMENT);
  private readonly injector = inject(Injector);
  readonly projectId = input.required<string>();
  readonly roundId = input.required<string>();
  readonly openPreview = input(false);
  readonly readOnly = input(false);
  readonly contentRevision = input(0);
  readonly openPreviewConsumed = output<void>();
  readonly editableChange = output<boolean>();
  readonly history = signal<readonly InterviewCustomerHandoffSummary[]>([]);
  readonly previewData = signal<InterviewCustomerHandoffPreview | null>(null);
  readonly selectedDetail = signal<InterviewCustomerHandoffDetail | null>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  readonly senderIdentity = signal<CorrespondenceMailboxIdentity | null>(null);
  summary = '';

  constructor() {
    effect(() => { this.projectId(); this.roundId(); this.readOnly(); this.load(); });
    effect(() => { this.contentRevision(); this.previewData.set(null); });
    effect(() => {
      if (this.openPreview() && !this.readOnly() && this.activeDraft()?.state === 'DRAFT') {
        this.openPreviewConsumed.emit();
        this.preview();
      }
    });
  }

  activeDraft(): InterviewCustomerHandoffSummary | null { return this.history().find((item) => item.state !== 'SENT') ?? null; }
  load(focusVersion?: number): void {
    this.api.senderIdentity(this.projectId(), this.roundId()).subscribe({ next: (identity) => this.senderIdentity.set(identity), error: (error: Error) => this.error.set(error.message) });
    this.api.list(this.projectId(), this.roundId()).subscribe({ next: (items) => { this.history.set(items); const active = this.activeDraft(); this.summary = active?.modificationSummary ?? ''; this.editableChange.emit(active?.state === 'DRAFT' && !this.readOnly()); if (focusVersion !== undefined) this.focusVersionAfterNextRender(focusVersion); }, error: (error: Error) => this.error.set(error.message) });
  }
  startVersion(): void { if (this.readOnly()) return; this.run(this.api.start(this.projectId(), this.roundId()), () => this.load()); }
  changeSummary(value: string): void { this.summary = value; this.previewData.set(null); }
  saveSummary(): void { const active = this.activeDraft(); if (!active || this.readOnly()) return; this.run(this.api.update(this.projectId(), this.roundId(), active.id, this.summary), () => { this.previewData.set(null); this.load(); }); }
  preview(): void { const active = this.activeDraft(); if (!active || active.state !== 'DRAFT' || this.readOnly()) return; this.busy.set(true); this.error.set(null); this.api.preview(this.projectId(), this.roundId(), active.id).subscribe({ next: (value) => { this.previewData.set(value); this.busy.set(false); }, error: (error: Error) => { this.error.set(error.message); this.busy.set(false); } }); }
  confirmSend(trigger: HTMLElement): void { const preview = this.previewData(); if (!preview || this.readOnly()) return; this.confirmation.confirm({ key: 'interview-handoff-send', target: trigger, message: `Send version ${preview.version} to ${preview.recipientName} (${preview.recipientEmail})?`, header: 'Send interview summary', acceptLabel: 'Send to Customer', rejectLabel: 'Cancel', reject: () => this.focusElementAfterNextRender(trigger), accept: () => this.run(this.api.send(this.projectId(), this.roundId(), preview), (detail) => { this.previewData.set(null); this.load(detail.version); }, () => { this.previewData.set(null); this.focusPreviewButtonAfterNextRender(); }) }); }
  inspect(id: string): void { this.run(this.api.get(this.projectId(), this.roundId(), id), (detail) => this.selectedDetail.set(detail)); }
  retry(active: InterviewCustomerHandoffSummary): void { if (this.readOnly() || active.state !== 'FAILED') return; this.run(this.api.retry(this.projectId(), this.roundId(), active.id, false), (detail) => this.load(detail.version)); }
  confirmUnknownRetry(active: InterviewCustomerHandoffSummary, trigger: HTMLElement): void {
    if (this.readOnly() || active.state !== 'UNKNOWN') return;
    this.confirmation.confirm({ key: 'interview-handoff-send', target: trigger, header: 'Confirm uncertain delivery retry', message: 'The mail gateway cannot confirm the prior delivery. Have you checked the Sent mailbox and accepted the risk of sending a duplicate?', acceptLabel: 'Retry after verification', rejectLabel: 'Cancel', reject: () => this.focusElementAfterNextRender(trigger), accept: () => this.run(this.api.retry(this.projectId(), this.roundId(), active.id, true), (detail) => this.load(detail.version)) });
  }
  resume(active: InterviewCustomerHandoffSummary): void { if (this.readOnly()) return; this.run(this.api.resume(this.projectId(), this.roundId(), active.id), () => this.load()); }
  stateLabel(state: HandoffVersionStatus): string { return ({ DRAFT: 'Draft', SENDING: 'Sending', SENT: 'Accepted by mail gateway', FAILED: 'Failed', UNKNOWN: 'Verification required' })[state]; }
  private focusVersionAfterNextRender(version: number): void { afterNextRender(() => this.document.querySelector<HTMLElement>(`[data-testid="handoff-version-heading-${version}"]`)?.focus(), { injector: this.injector }); }
  private focusElementAfterNextRender(element: HTMLElement): void { afterNextRender(() => element.isConnected && element.focus(), { injector: this.injector }); }
  private focusPreviewButtonAfterNextRender(): void { afterNextRender(() => this.document.querySelector<HTMLElement>('[data-testid="handoff-preview-button"] button')?.focus(), { injector: this.injector }); }
  private run<T>(request: import('rxjs').Observable<T>, next: (value: T) => void, onError?: () => void): void { if (this.busy()) return; this.busy.set(true); this.error.set(null); request.subscribe({ next: (value) => { this.busy.set(false); next(value); }, error: (error: Error) => { this.busy.set(false); this.error.set(error.message); onError?.(); } }); }
}
