import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import type { NotificationList } from '@project-maker/contracts';
import { ButtonModule } from 'primeng/button';
import { MessageModule } from 'primeng/message';

import { NotificationsApiService } from './notifications-api.service';

@Component({
  selector: 'app-notifications-page',
  imports: [ButtonModule, DatePipe, MessageModule, RouterLink],
  templateUrl: './notifications.page.html',
  styleUrl: './notifications.page.scss',
})
export class NotificationsPage implements OnInit {
  private readonly api = inject(NotificationsApiService);
  private readonly destroyRef = inject(DestroyRef);
  readonly result = signal<NotificationList | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.api.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (result) => { this.result.set(result); this.loading.set(false); },
      error: (error: Error) => { this.error.set(error.message); this.loading.set(false); },
    });
  }

  kindLabel(kind: string): string {
    const labels: Record<string, string> = {
      PROJECT_OVERDUE: 'Overdue action',
      PROJECT_DUE: 'Upcoming action',
      CUSTOMER_REPLY: 'New Customer reply',
      CUSTOMER_RESPONSE: 'New Customer clarification',
      CUSTOMER_DELIVERY_FAILURE: 'Customer delivery requires attention',
    };
    return labels[kind] ?? kind;
  }
}
