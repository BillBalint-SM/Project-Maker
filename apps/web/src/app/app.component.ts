import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthApiService } from './auth/auth-api.service';
import { NotificationsApiService } from './notifications/notifications-api.service';
import { CustomerRepliesApiService } from './projects/customer-replies-api.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  host: {
    '(document:keydown.escape)': 'closeNavigation()',
  },
})
export class AppComponent implements OnInit {
  private readonly replies = inject(CustomerRepliesApiService);
  private readonly auth = inject(AuthApiService);
  private readonly notifications = inject(NotificationsApiService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private loadedSummaryForUserId: string | null = null;

  readonly currentUser = this.auth.currentUser;
  readonly newReplyCount = signal(0);
  readonly loggingOut = signal(false);
  readonly navigationOpen = signal(false);
  readonly notificationCount = computed(
    () => this.notifications.current()?.totalCount ?? 0,
  );
  private readonly loadReplySummary = effect(() => {
    const user = this.currentUser();
    if (!user) {
      this.loadedSummaryForUserId = null;
      this.newReplyCount.set(0);
      return;
    }
    if (this.loadedSummaryForUserId === user.id) {
      return;
    }
    this.loadedSummaryForUserId = user.id;
    this.replies
      .summary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
    this.notifications
      .load()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => undefined });
  });

  ngOnInit(): void {
    this.replies.summaryChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((summary) => this.newReplyCount.set(summary.newReplyCount));
  }

  toggleNavigation(): void {
    this.navigationOpen.update((open) => !open);
  }

  closeNavigation(): void {
    this.navigationOpen.set(false);
  }

  logout(): void {
    if (this.loggingOut()) {
      return;
    }
    this.closeNavigation();
    this.loggingOut.set(true);
    this.auth
      .logout()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.loggingOut.set(false);
          void this.router.navigate(['/login']);
        },
        error: () => this.loggingOut.set(false),
      });
  }
}
