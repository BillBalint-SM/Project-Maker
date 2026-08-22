import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { of } from 'rxjs';

import { AppComponent } from './app.component';
import { AuthApiService } from './auth/auth-api.service';
import { NotificationsApiService } from './notifications/notifications-api.service';
import { CustomerRepliesApiService } from './projects/customer-replies-api.service';

describe('AppComponent', () => {
  it('renders the global navigation and Customer-reply entry point', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthApiService,
          useValue: {
            currentUser: signal({
              id: '11111111-1111-4111-8111-111111111111',
              email: 'po@example.test',
            }),
            logout: () => of(undefined),
          },
        },
        {
          provide: CustomerRepliesApiService,
          useValue: {
            summaryChanges: of({ newReplyCount: 3, projectCount: 1, projects: [] }),
            summary: () => of({ newReplyCount: 3, projectCount: 1, projects: [] }),
          },
        },
        {
          provide: NotificationsApiService,
          useValue: {
            current: signal(null),
            load: () => of({ items: [], totalCount: 0 }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();

    const brand = fixture.nativeElement.querySelector('.brand strong') as
      | HTMLElement
      | null;
    expect(brand?.textContent?.trim()).toBe('Project Maker');
    const navigationLabels = Array.from(
      fixture.nativeElement.querySelectorAll('[data-nav-label]') as NodeListOf<HTMLElement>,
    ).map((item) => item.textContent?.trim());
    expect(navigationLabels).toEqual([
      'Portfolio',
      'Roadmap',
      'Notifications',
      'New project',
      'Active project queue',
      'Discovery follow-ups',
      'Specification templates',
      'Git connections',
      'Question Bank',
    ]);

    const replyEntry = fixture.nativeElement.querySelector(
      '[data-testid="global-customer-reply-count"]',
    ) as HTMLAnchorElement | null;
    expect(replyEntry?.getAttribute('href')).toBe(
      '/projects/active?urgency=CUSTOMER_REPLY',
    );
    expect(replyEntry?.textContent).toContain('3');
    expect(replyEntry?.getAttribute('aria-label')).toBe(
      'Open 3 new Customer replies',
    );

    const navigationToggle = fixture.nativeElement.querySelector(
      '[data-testid="navigation-toggle"]',
    ) as HTMLButtonElement | null;
    const navigationPanel = fixture.nativeElement.querySelector(
      '[data-testid="navigation-panel"]',
    ) as HTMLElement | null;

    expect(navigationToggle?.getAttribute('aria-expanded')).toBe('false');
    expect(navigationPanel?.classList.contains('open')).toBe(false);

    navigationToggle?.click();
    fixture.detectChanges();

    expect(navigationToggle?.getAttribute('aria-expanded')).toBe('true');
    expect(navigationPanel?.classList.contains('open')).toBe(true);

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(navigationToggle?.getAttribute('aria-expanded')).toBe('false');
    expect(navigationPanel?.classList.contains('open')).toBe(false);
  });
});
