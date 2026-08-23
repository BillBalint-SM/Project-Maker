import {
  Component,
  DestroyRef,
  ElementRef,
  effect,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { Subscription } from 'rxjs';

import { AuthApiService } from './auth/auth-api.service';
import { NotificationsApiService } from './notifications/notifications-api.service';
import { CustomerRepliesApiService } from './projects/customer-replies-api.service';
import { ThemeToggleComponent } from './theme/theme-toggle.component';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet, ThemeToggleComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  host: {
    '(document:keydown.escape)': 'handleNavigationEscape()',
  },
})
export class AppComponent implements OnInit {
  private readonly replies = inject(CustomerRepliesApiService);
  private readonly auth = inject(AuthApiService);
  private readonly notifications = inject(NotificationsApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private loadedSummaryForUserId: string | null = null;
  private loadedNotificationsForUserId: string | null = null;
  private summaryRequestForUserId: string | null = null;
  private notificationRequestForUserId: string | null = null;
  private summaryLoadSubscription: Subscription | null = null;
  private notificationLoadSubscription: Subscription | null = null;
  private activeUserId: string | null = null;

  readonly currentUser = this.auth.currentUser;
  readonly newReplyCount = signal(0);
  readonly notificationCount = signal(0);
  readonly loggingOut = signal(false);
  readonly customerReplyLoadError = signal<string | null>(null);
  readonly notificationLoadError = signal<string | null>(null);
  readonly logoutError = signal<string | null>(null);
  readonly navigationOpen = signal(false);
  private readonly navigationToggleElement = viewChild<ElementRef<HTMLButtonElement>>('navigationToggle');
  private readonly loadReplySummary = effect(() => {
    const user = this.currentUser();
    const nextUserId = user?.id ?? null;
    if (this.activeUserId !== nextUserId) {
      const previousUserWasActive = this.activeUserId !== null;
      this.cancelUserLoads();
      this.activeUserId = nextUserId;
      if (previousUserWasActive) this.notifications.clearCurrent();
      this.loadedSummaryForUserId = null;
      this.loadedNotificationsForUserId = null;
      this.newReplyCount.set(0);
      this.notificationCount.set(0);
      this.customerReplyLoadError.set(null);
      this.notificationLoadError.set(null);
    }
    if (!user) {
      return;
    }

    this.loadCustomerReplySummary(user.id);
    this.loadNotifications(user.id);
  });
  private readonly clearRecoveredNotificationError = effect(() => {
    const user = this.currentUser();
    const snapshot = this.notifications.current();
    if (user && snapshot?.userId === user.id) {
      this.notificationCount.set(snapshot.notifications.totalCount);
      this.notificationLoadError.set(null);
    }
  });

  ngOnInit(): void {
    this.replies.summaryChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((update) => {
        if (this.currentUser()?.id === update.userId) {
          this.newReplyCount.set(update.summary.newReplyCount);
          this.customerReplyLoadError.set(null);
        }
      });
  }

  retryCustomerReplySummary(): void {
    const user = this.currentUser();
    if (user) {
      this.loadCustomerReplySummary(user.id, true);
    }
  }

  private loadCustomerReplySummary(userId: string, retry = false): void {
    if (
      this.currentUser()?.id !== userId ||
      this.summaryRequestForUserId === userId ||
      (!retry && this.loadedSummaryForUserId === userId)
    ) {
      return;
    }
    this.summaryRequestForUserId = userId;
    this.customerReplyLoadError.set(null);
    this.summaryLoadSubscription = this.replies
      .summary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (summary) => {
          if (this.currentUser()?.id === userId) {
            this.loadedSummaryForUserId = userId;
            this.newReplyCount.set(summary.newReplyCount);
          }
          if (this.summaryRequestForUserId === userId) {
            this.summaryRequestForUserId = null;
          }
        },
        error: (error: unknown) => {
          if (this.currentUser()?.id === userId) {
            this.customerReplyLoadError.set(errorMessage(error, 'Customer replies are currently unavailable.'));
          }
          if (this.summaryRequestForUserId === userId) {
            this.summaryRequestForUserId = null;
          }
        },
      });
  }

  retryNotifications(): void {
    const user = this.currentUser();
    if (user) {
      this.loadNotifications(user.id, true);
    }
  }

  private loadNotifications(userId: string, retry = false): void {
    if (
      this.currentUser()?.id !== userId ||
      this.notificationRequestForUserId === userId ||
      (!retry && this.loadedNotificationsForUserId === userId)
    ) {
      return;
    }
    this.notificationRequestForUserId = userId;
    this.notificationLoadError.set(null);
    this.notificationLoadSubscription = this.notifications
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (notifications) => {
          if (this.currentUser()?.id === userId) {
            this.loadedNotificationsForUserId = userId;
          }
          if (this.notificationRequestForUserId === userId) {
            this.notificationRequestForUserId = null;
          }
        },
        error: (error: unknown) => {
          if (this.currentUser()?.id === userId) {
            this.notificationLoadError.set(errorMessage(error, 'Notifications are currently unavailable.'));
          }
          if (this.notificationRequestForUserId === userId) {
            this.notificationRequestForUserId = null;
          }
        },
      });
  }

  private cancelUserLoads(): void {
    this.summaryLoadSubscription?.unsubscribe();
    this.notificationLoadSubscription?.unsubscribe();
    this.summaryLoadSubscription = null;
    this.notificationLoadSubscription = null;
    this.summaryRequestForUserId = null;
    this.notificationRequestForUserId = null;
  }

  toggleNavigation(): void {
    this.navigationOpen.update((open) => !open);
  }

  closeNavigation(): void {
    this.navigationOpen.set(false);
  }

  handleNavigationEscape(): void {
    if (!this.navigationOpen()) {
      return;
    }
    this.closeNavigation();
    queueMicrotask(() => this.navigationToggleElement()?.nativeElement.focus());
  }

  handleHeaderFocusOut(event: FocusEvent): void {
    if (!this.navigationOpen()) {
      return;
    }
    const header = event.currentTarget as HTMLElement | null;
    const nextTarget = event.relatedTarget as Node | null;
    if (header && (!nextTarget || !header.contains(nextTarget))) {
      this.closeNavigation();
    }
  }

  logout(): void {
    if (this.loggingOut()) {
      return;
    }
    this.loggingOut.set(true);
    this.logoutError.set(null);
    this.auth
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loggingOut.set(false);
          this.closeNavigation();
          void this.router.navigate(['/login']);
        },
        error: () => {
          this.loggingOut.set(false);
          this.logoutError.set(logoutFailureMessage);
        },
      });
  }
}

const logoutFailureMessage = 'Unable to sign out. Check your connection and try again.';

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}
