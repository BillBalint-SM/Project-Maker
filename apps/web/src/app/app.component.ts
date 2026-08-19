import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';

import { CustomerRepliesApiService } from './projects/customer-replies-api.service';

@Component({
  selector: 'app-root',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  template: `
    <header class="app-header">
      <div class="header-inner">
        <a class="brand" routerLink="/" aria-label="Project Maker project list">
          <span class="brand-mark" aria-hidden="true">PM</span>
          <span>
            <strong>Project Maker</strong>
            <small>Napi projektmunka egy helyen</small>
          </span>
        </a>
        <nav class="app-nav" aria-label="Application navigation">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }">Projects</a>
          <a routerLink="/" data-testid="global-customer-reply-count">Customer válaszok@if (newReplyCount() > 0) { ({{ newReplyCount() }}) }</a>
          <a routerLink="/settings/questions" routerLinkActive="active">Kérdésbank beállítások</a>
          <a routerLink="/settings/markdown-templates" routerLinkActive="active">Markdown beállítások</a>
        </nav>
      </div>
    </header>
    <main class="app-main">
      <router-outlet />
    </main>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
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
      gap: 1.5rem;
      justify-content: space-between;
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

    .app-nav {
      align-items: center;
      display: flex;
      gap: 0.35rem;
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
      .header-inner {
        align-items: flex-start;
        flex-direction: column;
        gap: 0;
      }

      .app-nav {
        flex-wrap: wrap;
        padding-bottom: 0.65rem;
        width: 100%;
      }
    }
  `,
})
export class AppComponent implements OnInit {
  private readonly replies = inject(CustomerRepliesApiService);
  readonly newReplyCount = signal(0);
  ngOnInit(): void {
    this.replies.summaryChanges.subscribe((summary) => this.newReplyCount.set(summary.newReplyCount));
    this.replies.summary().subscribe({ error: () => undefined });
  }
}
