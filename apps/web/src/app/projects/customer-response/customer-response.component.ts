import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type {
  CustomerResponseEligiblePrompt,
  CustomerResponseRequest,
  CustomerResponseRequestPreview,
} from '@project-maker/contracts';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { NotificationsApiService } from '../../notifications/notifications-api.service';
import { CustomerResponseApiService } from '../customer-response-api.service';

@Component({
  selector: 'app-customer-response',
  imports: [ButtonModule, DatePipe, MessageModule],
  templateUrl: './customer-response.component.html',
  styleUrl: './customer-response.component.scss',
})
export class CustomerResponseComponent implements OnInit {
  private readonly api = inject(CustomerResponseApiService);
  private readonly notifications = inject(NotificationsApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly projectId = input.required<string>();
  readonly archived = input(false);
  readonly eligible = signal<readonly CustomerResponseEligiblePrompt[]>([]);
  readonly requests = signal<readonly CustomerResponseRequest[]>([]);
  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly preview = signal<CustomerResponseRequestPreview | null>(null);
  readonly loading = signal(true);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);
  readonly feedback = signal<string | null>(null);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    let completed = 0;
    const done = () => { completed += 1; if (completed === 2) this.loading.set(false); };
    this.api.eligible(this.projectId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (eligible) => { this.eligible.set(eligible); done(); },
      error: (error: Error) => { this.error.set(error.message); done(); },
    });
    this.api.list(this.projectId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (requests) => { this.requests.set(requests); done(); },
      error: (error: Error) => { this.error.set(error.message); done(); },
    });
  }

  toggle(prompt: CustomerResponseEligiblePrompt, event: Event): void {
    const key = promptKey(prompt);
    const next = new Set(this.selected());
    if ((event.target as HTMLInputElement).checked) next.add(key); else next.delete(key);
    this.selected.set(next);
    this.preview.set(null);
  }

  createPreview(): void {
    const prompts = this.eligible().filter((prompt) => this.selected().has(promptKey(prompt)))
      .map(({ sourceKind, sourceId }) => ({ sourceKind, sourceId }));
    if (prompts.length === 0 || this.busy()) return;
    this.start();
    this.api.preview(this.projectId(), { prompts }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (preview) => { this.preview.set(preview); this.busy.set(false); },
      error: (error: Error) => this.fail(error),
    });
  }

  confirm(): void {
    const preview = this.preview();
    if (!preview || this.busy()) return;
    this.start();
    this.api.confirm(this.projectId(), preview.previewToken).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.preview.set(null);
        this.selected.set(new Set());
        this.feedback.set('The response request has been recorded and handed to the mail system.');
        this.busy.set(false);
        this.load();
      },
      error: (error: Error) => this.fail(error),
    });
  }

  revoke(request: CustomerResponseRequest): void {
    if (this.busy()) return;
    this.command(this.api.revoke(this.projectId(), request.id), 'The response request has been revoked.');
  }

  retry(request: CustomerResponseRequest): void {
    if (this.busy()) return;
    this.command(this.api.retry(this.projectId(), request.id), 'Sending has been retried.');
  }

  review(request: CustomerResponseRequest): void {
    if (this.busy()) return;
    this.start();
    this.api.review(this.projectId(), request.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.feedback.set('The Customer response has been reviewed.');
        this.busy.set(false);
        this.load();
        this.notifications.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
      },
      error: (error: Error) => this.fail(error),
    });
  }

  keepAsEvidence(request: CustomerResponseRequest, answerId: string): void {
    if (this.busy()) return;
    this.start();
    this.api.evidence(this.projectId(), request.id, answerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.feedback.set('The response has been retained as evidence.');
        this.busy.set(false);
        this.load();
      },
      error: (error: Error) => this.fail(error),
    });
  }

  promptText(request: CustomerResponseRequest, promptId: string): string {
    return request.prompts.find((prompt) => prompt.id === promptId)?.text ?? 'Clarification';
  }

  requestState(request: CustomerResponseRequest): string {
    if (request.state === 'SUBMITTED') return request.submission?.reviewedAt ? 'Reviewed' : 'New response';
    if (request.state === 'REVOKED') return 'Revoked';
    if (new Date(request.expiresAt).getTime() <= Date.now()) return 'Expired';
    return request.deliveryState === 'SENT' ? 'Sent' : request.deliveryState === 'FAILED' ? 'Sending failed' : request.deliveryState === 'UNKNOWN' ? 'Delivery status unknown' : 'Sending';
  }

  private command(operation: ReturnType<CustomerResponseApiService['revoke']>, message: string): void {
    this.start();
    operation.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => { this.feedback.set(message); this.busy.set(false); this.load(); },
      error: (error: Error) => this.fail(error),
    });
  }

  private start(): void { this.busy.set(true); this.error.set(null); this.feedback.set(null); }
  private fail(error: Error): void { this.error.set(error.message); this.busy.set(false); }
}

function promptKey(prompt: CustomerResponseEligiblePrompt): string {
  return `${prompt.sourceKind}:${prompt.sourceId}`;
}
