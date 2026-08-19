import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import type {
  CustomerMailTriageCommand,
  CustomerMailTriageView,
  MailSystemEventView,
  UnmatchedCustomerMessageView,
} from '@project-maker/contracts';
import { ButtonModule } from 'primeng/button';
import { ProgressSpinnerModule } from 'primeng/progressspinner';

import { CustomerMailTriageApiService } from './customer-mail-triage-api.service';

@Component({
  selector: 'app-customer-mail-triage-page',
  imports: [ButtonModule, DatePipe, ProgressSpinnerModule, RouterLink],
  templateUrl: './customer-mail-triage.page.html',
  styleUrl: './customer-mail-triage.page.scss',
})
export class CustomerMailTriagePage implements OnInit {
  private readonly api = inject(CustomerMailTriageApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly view = signal<CustomerMailTriageView | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly commandError = signal<string | null>(null);
  readonly pendingMessageId = signal<string | null>(null);
  readonly selectedTargets = signal<Readonly<Record<string, string>>>({});

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set(null);
    this.api.view().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (view) => {
        this.view.set(view);
        this.loading.set(false);
      },
      error: (error: Error) => {
        this.loadError.set(error.message);
        this.loading.set(false);
      },
    });
  }

  selectTarget(messageId: string, event: Event): void {
    const correspondenceId = (event.target as HTMLSelectElement).value;
    this.selectedTargets.update((current) => ({ ...current, [messageId]: correspondenceId }));
  }

  link(message: UnmatchedCustomerMessageView): void {
    const correspondenceId = this.selectedTargets()[message.id];
    if (!correspondenceId) {
      this.commandError.set('Az üzenet társításához válassz ügyféllevelezést.');
      return;
    }
    this.runCommand(message, {
      command: 'LINK',
      expectedVersion: message.version,
      correspondenceId,
    });
  }

  dismiss(message: UnmatchedCustomerMessageView): void {
    this.runCommand(message, { command: 'DISMISS', expectedVersion: message.version });
  }

  eventLabel(type: MailSystemEventView['type']): string {
    return type === 'DELIVERY_REPORT' ? 'Kézbesítési jelentés' : 'Automatikus távolléti válasz';
  }

  private runCommand(
    message: UnmatchedCustomerMessageView,
    command: CustomerMailTriageCommand,
  ): void {
    if (this.pendingMessageId()) return;
    this.pendingMessageId.set(message.id);
    this.commandError.set(null);
    this.api.command(message.id, command)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
      next: () => {
        this.view.update((current) => current ? {
          ...current,
          unmatchedMessages: current.unmatchedMessages.filter(({ id }) => id !== message.id),
        } : current);
        this.pendingMessageId.set(null);
      },
      error: (error: Error) => {
        this.commandError.set(error.message);
        this.pendingMessageId.set(null);
      },
      });
  }
}
