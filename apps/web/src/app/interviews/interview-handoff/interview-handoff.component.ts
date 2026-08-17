import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmationService } from 'primeng/api';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { ConfirmDialog } from 'primeng/confirmdialog';
import { MessageModule } from 'primeng/message';
import { TextareaModule } from 'primeng/textarea';
import type { InterviewCustomerHandoffPreview, InterviewCustomerHandoffSummary } from '@project-maker/contracts';

import { InterviewHandoffApiService } from './interview-handoff-api.service';

@Component({
  selector: 'app-interview-handoff',
  imports: [ButtonModule, CardModule, ConfirmDialog, FormsModule, MessageModule, TextareaModule],
  providers: [ConfirmationService],
  templateUrl: './interview-handoff.component.html',
  styleUrl: './interview-handoff.component.scss',
})
export class InterviewHandoffComponent {
  private readonly api = inject(InterviewHandoffApiService);
  private readonly confirmation = inject(ConfirmationService);
  readonly projectId = input.required<string>();
  readonly roundId = input.required<string>();
  readonly openPreview = input(false);
  readonly editableChange = output<boolean>();
  readonly history = signal<readonly InterviewCustomerHandoffSummary[]>([]);
  readonly previewData = signal<InterviewCustomerHandoffPreview | null>(null);
  readonly selectedContent = signal<string | null>(null);
  readonly error = signal<string | null>(null);
  readonly busy = signal(false);
  summary = '';

  constructor() {
    effect(() => { this.projectId(); this.roundId(); this.load(); });
    effect(() => { if (this.openPreview() && this.activeDraft()) this.preview(); });
  }

  activeDraft(): InterviewCustomerHandoffSummary | null { return this.history().find((item) => item.state !== 'SENT') ?? null; }
  load(): void {
    this.api.list(this.projectId(), this.roundId()).subscribe({ next: (items) => { this.history.set(items); const active = this.activeDraft(); this.summary = active?.modificationSummary ?? ''; this.editableChange.emit(active?.state === 'DRAFT'); }, error: (error: Error) => this.error.set(error.message) });
  }
  startVersion(): void { this.run(this.api.start(this.projectId(), this.roundId()), () => this.load()); }
  saveSummary(): void { const active = this.activeDraft(); if (!active) return; this.run(this.api.update(this.projectId(), this.roundId(), active.id, this.summary), () => this.load()); }
  preview(): void { const active = this.activeDraft(); if (!active) return; this.busy.set(true); this.error.set(null); this.api.preview(this.projectId(), this.roundId(), active.id).subscribe({ next: (value) => { this.previewData.set(value); this.busy.set(false); }, error: (error: Error) => { this.error.set(error.message); this.busy.set(false); } }); }
  confirmSend(trigger: HTMLElement): void { const preview = this.previewData(); if (!preview) return; this.confirmation.confirm({ key: 'interview-handoff-send', target: trigger, message: `${preview.recipientName} (${preview.recipientEmail}) részére küldöd a ${preview.version}. verziót.`, header: 'Interjú-összefoglaló küldése', acceptLabel: 'Küldés az ügyfélnek', rejectLabel: 'Mégse', accept: () => this.run(this.api.send(this.projectId(), this.roundId(), preview), () => { this.previewData.set(null); this.load(); }) }); }
  inspect(id: string): void { this.run(this.api.get(this.projectId(), this.roundId(), id), (detail) => this.selectedContent.set(detail.textContent)); }
  retry(active: InterviewCustomerHandoffSummary): void { this.run(this.api.retry(this.projectId(), this.roundId(), active.id, active.state === 'UNKNOWN'), () => this.load()); }
  resume(active: InterviewCustomerHandoffSummary): void { this.run(this.api.resume(this.projectId(), this.roundId(), active.id), () => this.load()); }
  private run<T>(request: import('rxjs').Observable<T>, next: (value: T) => void): void { if (this.busy()) return; this.busy.set(true); this.error.set(null); request.subscribe({ next: (value) => { this.busy.set(false); next(value); }, error: (error: Error) => { this.busy.set(false); this.error.set(error.message); } }); }
}
