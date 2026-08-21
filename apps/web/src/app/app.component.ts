import { Component, computed, DestroyRef, effect, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { AuthApiService } from './auth/auth-api.service';
import { NotificationsApiService } from './notifications/notifications-api.service';
import { CustomerRepliesApiService } from './projects/customer-replies-api.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <a class="skip-link" href="#main-content">Ugrás a fő tartalomra</a>
    @if (currentUser(); as user) {
    <header class="app-header">
      <div class="header-inner">
        <a class="brand" routerLink="/" aria-label="Project Maker projektportfólió">
          <span class="brand-mark" aria-hidden="true">PM</span>
          <span>
            <strong>Project Maker</strong>
            <small>Napi projektmunka egy helyen</small>
          </span>
        </a>
        <nav class="app-nav" aria-label="Fő navigáció">
          <ul>
            <li>
              <a data-nav-label data-testid="global-portfolio-link" routerLink="/" routerLinkActive="active" ariaCurrentWhenActive="page" [routerLinkActiveOptions]="{ exact: true }">Projektportfólió</a>
            </li>
            <li>
              <a data-nav-label data-testid="global-roadmap-link" routerLink="/roadmap" routerLinkActive="active" ariaCurrentWhenActive="page">Roadmap</a>
            </li>
            <li class="queue-nav-item">
              <a data-nav-label data-testid="global-notifications-link" routerLink="/notifications" routerLinkActive="active" ariaCurrentWhenActive="page">Értesítések</a>
              @if (notificationCount() > 0) {
                <a class="reply-count" routerLink="/notifications" [attr.aria-label]="notificationCount() + ' aktuális értesítés'">{{ notificationCount() }}</a>
              }
            </li>
            <li>
              <a data-nav-label routerLink="/projects/new" routerLinkActive="active" ariaCurrentWhenActive="page">Új projekt</a>
            </li>
            <li class="queue-nav-item">
              <a data-nav-label routerLink="/projects/active" routerLinkActive="active" ariaCurrentWhenActive="page">Aktív munkasor</a>
              @if (newReplyCount() > 0) {
                <a
                  class="reply-count"
                  routerLink="/projects/active"
                  [queryParams]="{ urgency: 'CUSTOMER_REPLY' }"
                  data-testid="global-customer-reply-count"
                  [attr.aria-label]="newReplyCount() + ' új ügyfélválasz megnyitása'"
                >{{ newReplyCount() }}</a>
              }
            </li>
            <li>
              <a data-nav-label routerLink="/follow-ups" routerLinkActive="active" ariaCurrentWhenActive="page">Tisztázandó tételek</a>
            </li>
            <li>
              <a data-nav-label routerLink="/settings/markdown-templates" routerLinkActive="active" ariaCurrentWhenActive="page">Specifikációs sablonok</a>
            </li>
            <li>
              <a data-nav-label routerLink="/settings/git-setups" routerLinkActive="active" ariaCurrentWhenActive="page">Git setupok</a>
            </li>
            <li>
              <a data-nav-label routerLink="/settings/questions" routerLinkActive="active" ariaCurrentWhenActive="page">Kérdésbank</a>
            </li>
          </ul>
        </nav>
        <div class="user-actions">
          <a routerLink="/account" routerLinkActive="active" ariaCurrentWhenActive="page">
            {{ user.email }}
          </a>
          <button type="button" [disabled]="loggingOut()" (click)="logout()">
            Kijelentkezés
          </button>
        </div>
      </div>
    </header>
    }
    <main id="main-content" class="app-main" tabindex="-1">
      <router-outlet />
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
    }

    .skip-link {
      background: var(--pm-deep-navy);
      color: white;
      left: 1rem;
      padding: 0.65rem 0.9rem;
      position: fixed;
      top: -5rem;
      z-index: 20;
    }

    .skip-link:focus {
      top: 1rem;
    }

    .app-header {
      border-bottom: 1px solid var(--p-content-border-color);
      background: color-mix(in srgb, white 92%, var(--pm-cyan));
      backdrop-filter: blur(0.75rem);
      position: sticky;
      top: 0;
      z-index: 10;
    }

    .header-inner {
      align-items: center;
      display: flex;
      gap: 1rem;
      margin: 0 auto;
      max-width: 76rem;
      padding: 0 1.5rem;
    }

    .brand {
      align-items: center;
      color: var(--p-text-color);
      display: flex;
      gap: 0.75rem;
      padding: 0.85rem 0;
      text-decoration: none;
    }

    .app-nav ul {
      align-items: center;
      display: flex;
      gap: 0.35rem;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .app-nav {
      margin-left: auto;
    }

    .user-actions {
      align-items: center;
      display: flex;
      gap: 0.4rem;
    }

    .user-actions a,
    .user-actions button {
      background: transparent;
      border: 0;
      border-radius: 0.55rem;
      color: var(--p-text-muted-color);
      cursor: pointer;
      font-size: 0.8rem;
      padding: 0.55rem 0.65rem;
      text-decoration: none;
    }

    .user-actions a.active,
    .user-actions a:hover,
    .user-actions button:hover {
      background: var(--p-primary-50);
      color: var(--p-primary-color);
    }

    .app-nav li {
      align-items: center;
      display: flex;
      min-width: 0;
    }

    .app-nav a {
      border-radius: 0.55rem;
      color: var(--p-text-muted-color);
      padding: 0.55rem 0.75rem;
      text-decoration: none;
    }

    .app-nav a:hover,
    .app-nav a.active {
      background: var(--p-primary-50);
      color: var(--p-primary-color);
    }

    .queue-nav-item {
      background: color-mix(in srgb, var(--p-primary-50) 55%, transparent);
      border-radius: 0.55rem;
    }

    .reply-count {
      align-items: center;
      background: var(--p-primary-color);
      border-radius: 999px !important;
      color: var(--p-primary-contrast-color) !important;
      display: inline-flex;
      font-size: 0.75rem;
      font-weight: 800;
      justify-content: center;
      margin-right: 0.35rem;
      min-height: 1.55rem;
      min-width: 1.55rem;
      padding: 0.2rem 0.45rem !important;
    }

    .brand-mark {
      align-items: center;
      background: var(--p-primary-color);
      border-radius: 0.7rem;
      color: var(--p-primary-contrast-color);
      display: inline-flex;
      font-size: 0.78rem;
      font-weight: 800;
      height: 2.25rem;
      justify-content: center;
      letter-spacing: 0.04em;
      width: 2.25rem;
    }

    .brand strong,
    .brand small {
      display: block;
    }

    .brand small {
      color: var(--p-text-muted-color);
      font-size: 0.75rem;
      margin-top: 0.1rem;
    }

    .app-main {
      margin: 0 auto;
      max-width: 76rem;
      padding: 2.5rem 1.5rem 4rem;
    }

    @media (max-width: 42rem) {
      .app-header {
        position: static;
      }

      .header-inner {
        align-items: flex-start;
        flex-direction: column;
        gap: 0;
      }

      .app-nav,
      .app-nav ul {
        flex-wrap: wrap;
        padding-bottom: 0.65rem;
        width: 100%;
      }

      .app-nav {
        margin-left: 0;
      }

      .user-actions {
        border-top: 1px solid var(--p-content-border-color);
        justify-content: space-between;
        padding: 0.45rem 0 0.65rem;
        width: 100%;
      }
    }
  `,
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
  readonly notificationCount = computed(() => this.notifications.current()?.totalCount ?? 0);
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
    this.notifications.load().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({ error: () => undefined });
  });

  ngOnInit(): void {
    this.replies.summaryChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((summary) => this.newReplyCount.set(summary.newReplyCount));
  }

  logout(): void {
    if (this.loggingOut()) {
      return;
    }
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
