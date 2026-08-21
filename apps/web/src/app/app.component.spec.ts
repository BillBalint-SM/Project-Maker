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
  it('renders the accepted Hungarian global navigation and reply entry point', async () => {
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
            load: () => of({ items: [], totalCount: 0, limit: 25 }),
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
      'Projektportfólió',
      'Roadmap',
      'Értesítések',
      'Új projekt',
      'Aktív munkasor',
      'Tisztázandó tételek',
      'Specifikációs sablonok',
      'Git setupok',
      'Kérdésbank',
    ]);

    const replyEntry = fixture.nativeElement.querySelector(
      '[data-testid="global-customer-reply-count"]',
    ) as HTMLAnchorElement | null;
    expect(replyEntry?.getAttribute('href')).toBe(
      '/projects/active?urgency=CUSTOMER_REPLY',
    );
    expect(replyEntry?.textContent).toContain('3');
    expect(replyEntry?.getAttribute('aria-label')).toBe(
      '3 új ügyfélválasz megnyitása',
    );
  });
});
