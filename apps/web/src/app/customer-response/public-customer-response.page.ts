import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import type { PublicCustomerResponseRequest } from '@project-maker/contracts';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';
import { ProgressSpinnerModule } from 'primeng/progressspinner';
import { TextareaModule } from 'primeng/textarea';

import { CustomerResponseApiService } from '../projects/customer-response-api.service';

interface ResponseDraft {
  readonly idempotencyKey: string;
  readonly answers: Readonly<Record<string, string>>;
}

@Component({
  selector: 'app-public-customer-response-page',
  imports: [ButtonModule, DatePipe, MessageModule, ProgressSpinnerModule, TextareaModule],
  templateUrl: './public-customer-response.page.html',
  styleUrl: './public-customer-response.page.scss',
})
export class PublicCustomerResponsePage implements OnInit {
  private readonly api = inject(CustomerResponseApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly request = signal<PublicCustomerResponseRequest | null>(null);
  readonly answers = signal<Readonly<Record<string, string>>>({});
  readonly idempotencyKey = signal<string>(crypto.randomUUID());
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly submitted = signal(false);
  readonly error = signal<string | null>(null);

  ngOnInit(): void {
    const token = this.route.snapshot.fragment;
    if (token) {
      window.history.replaceState({}, '', window.location.pathname + window.location.search);
      this.api.exchange(token).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: () => this.load(),
        error: (error: Error) => this.fail(error),
      });
      return;
    }
    this.load();
  }

  updateAnswer(promptId: string, event: Event): void {
    this.answers.update((answers) => ({
      ...answers,
      [promptId]: (event.target as HTMLTextAreaElement).value,
    }));
    this.saveDraft();
  }

  canSubmit(): boolean {
    const current = this.request();
    return Boolean(current) && current!.prompts.every((prompt) => (this.answers()[prompt.id] ?? '').trim().length > 0);
  }

  submit(): void {
    const current = this.request();
    if (!current || !this.canSubmit() || this.submitting()) return;
    this.submitting.set(true);
    this.error.set(null);
    this.api.submit({
      idempotencyKey: this.idempotencyKey(),
      answers: current.prompts.map((prompt) => ({
        promptId: prompt.id,
        answer: this.answers()[prompt.id]!.trim(),
      })),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.submitting.set(false);
        this.submitted.set(true);
        this.removeDraft(current.requestId);
      },
      error: (error: Error) => {
        this.submitting.set(false);
        this.error.set(error.message);
      },
    });
  }

  private load(): void {
    this.api.publicRequest().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (request) => {
        this.request.set(request);
        this.restoreDraft(request);
        this.loading.set(false);
      },
      error: (error: Error) => this.fail(error),
    });
  }

  private restoreDraft(request: PublicCustomerResponseRequest): void {
    try {
      const raw = window.localStorage.getItem(draftKey(request.requestId));
      if (!raw) return;
      const draft = JSON.parse(raw) as ResponseDraft;
      if (typeof draft.idempotencyKey === 'string' && typeof draft.answers === 'object' && draft.answers !== null) {
        this.idempotencyKey.set(draft.idempotencyKey);
        this.answers.set(draft.answers);
      }
    } catch { this.removeDraft(request.requestId); }
  }

  private saveDraft(): void {
    const requestId = this.request()?.requestId;
    if (!requestId) return;
    try {
      window.localStorage.setItem(draftKey(requestId), JSON.stringify({
        idempotencyKey: this.idempotencyKey(), answers: this.answers(),
      } satisfies ResponseDraft));
    } catch { /* The form still works without local recovery. */ }
  }

  private removeDraft(requestId: string): void {
    try { window.localStorage.removeItem(draftKey(requestId)); } catch { /* no-op */ }
  }

  private fail(error: Error): void {
    this.error.set(error.message);
    this.loading.set(false);
  }
}

function draftKey(requestId: string): string { return `project-maker:customer-response:${requestId}`; }
