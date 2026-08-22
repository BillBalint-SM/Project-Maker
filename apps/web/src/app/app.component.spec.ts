import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, Subject, tap, throwError } from 'rxjs';

import { AppComponent } from './app.component';
import { AuthApiService } from './auth/auth-api.service';
import { NotificationsApiService } from './notifications/notifications-api.service';
import { CustomerRepliesApiService } from './projects/customer-replies-api.service';

describe('AppComponent', () => {
  it('updates the Customer-reply badge when correspondence work publishes a later summary', async () => {
    const summaryChanges = new Subject<{ newReplyCount: number; projectCount: number; projects: never[] }>();

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthApiService, useValue: { currentUser: signal({ id: '11111111-1111-4111-8111-111111111111', email: 'po@example.test' }), logout: () => of(undefined) } },
        { provide: CustomerRepliesApiService, useValue: { summaryChanges, summary: () => of({ newReplyCount: 1, projectCount: 1, projects: [] }) } },
        { provide: NotificationsApiService, useValue: { current: signal(null), load: () => of({ items: [], totalCount: 0 }) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    summaryChanges.next({ newReplyCount: 4, projectCount: 2, projects: [] });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="global-customer-reply-count"]')?.textContent).toContain('4');
  });

  it('updates the Notifications badge when the Notifications page changes its current result', async () => {
    const current = signal({ items: [], totalCount: 1 });

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthApiService, useValue: { currentUser: signal({ id: '11111111-1111-4111-8111-111111111111', email: 'po@example.test' }), logout: () => of(undefined) } },
        { provide: CustomerRepliesApiService, useValue: { summaryChanges: of({ newReplyCount: 0, projectCount: 0, projects: [] }), summary: () => of({ newReplyCount: 0, projectCount: 0, projects: [] }) } },
        { provide: NotificationsApiService, useValue: { current, load: () => of({ items: [], totalCount: 1 }) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    current.set({ items: [], totalCount: 6 });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[aria-label="6 active notifications"]')?.textContent).toContain('6');
  });

  it('keeps navigation open when signing out fails so retry remains actionable', async () => {
    const pendingLogout = new Subject<void>();

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthApiService, useValue: { currentUser: signal({ id: '11111111-1111-4111-8111-111111111111', email: 'po@example.test' }), logout: () => pendingLogout } },
        { provide: CustomerRepliesApiService, useValue: { summaryChanges: of({ newReplyCount: 0, projectCount: 0, projects: [] }), summary: () => of({ newReplyCount: 0, projectCount: 0, projects: [] }) } },
        { provide: NotificationsApiService, useValue: { current: signal(null), load: () => of({ items: [], totalCount: 0 }) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const navigationToggle = fixture.nativeElement.querySelector('[data-testid="navigation-toggle"]') as HTMLButtonElement;
    navigationToggle.click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.user-actions button') as HTMLButtonElement).click();
    pendingLogout.error(new Error('Unable to sign out. Check your connection and try again.'));
    await fixture.whenStable();

    expect(navigationToggle.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('[data-testid="navigation-panel"]')?.classList.contains('open')).toBe(true);
  });

  it('shows a retry for a failed Customer-reply summary without reloading Notifications', async () => {
    const summary = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('Customer replies are currently unavailable.')))
      .mockReturnValueOnce(of({ newReplyCount: 4, projectCount: 1, projects: [] }));
    const notificationLoad = vi.fn().mockReturnValue(of({ items: [], totalCount: 2 }));

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthApiService,
          useValue: {
            currentUser: signal({ id: '11111111-1111-4111-8111-111111111111', email: 'po@example.test' }),
            logout: () => of(undefined),
          },
        },
        {
          provide: CustomerRepliesApiService,
          useValue: { summaryChanges: of({ newReplyCount: 0, projectCount: 0, projects: [] }), summary },
        },
        { provide: NotificationsApiService, useValue: { current: signal(null), load: notificationLoad } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();

    const alert = fixture.nativeElement.querySelector('[data-testid="customer-reply-load-error"]') as HTMLElement | null;
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toContain('Customer replies are currently unavailable.');

    (fixture.nativeElement.querySelector('[data-testid="retry-customer-reply-summary"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(summary).toHaveBeenCalledTimes(2);
    expect(notificationLoad).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('[data-testid="global-customer-reply-count"]')?.textContent).toContain('4');
  });

  it('retries Notifications independently after its first load fails', async () => {
    const summary = vi.fn().mockReturnValue(of({ newReplyCount: 3, projectCount: 1, projects: [] }));
    const current = signal<{ items: never[]; totalCount: number } | null>(null);
    const notificationLoad = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('Notifications are currently unavailable.')))
      .mockReturnValueOnce(of({ items: [], totalCount: 5 }).pipe(tap((notifications) => current.set(notifications))));

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        {
          provide: AuthApiService,
          useValue: {
            currentUser: signal({ id: '11111111-1111-4111-8111-111111111111', email: 'po@example.test' }),
            logout: () => of(undefined),
          },
        },
        { provide: CustomerRepliesApiService, useValue: { summaryChanges: of({ newReplyCount: 0, projectCount: 0, projects: [] }), summary } },
        { provide: NotificationsApiService, useValue: { current, load: notificationLoad } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid="notification-load-error"]')?.getAttribute('role')).toBe('alert');

    (fixture.nativeElement.querySelector('[data-testid="retry-notifications"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(notificationLoad).toHaveBeenCalledTimes(2);
    expect(summary).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.querySelector('[aria-label="5 active notifications"]')?.textContent).toContain('5');
  });

  it('does not present a late Customer-reply result from a previous signed-in user', async () => {
    const currentUser = signal({ id: '11111111-1111-4111-8111-111111111111', email: 'first@example.test' });
    const staleSummary = new Subject<{ newReplyCount: number; projectCount: number; projects: never[] }>();
    const summary = vi
      .fn()
      .mockReturnValueOnce(staleSummary)
      .mockReturnValueOnce(of({ newReplyCount: 2, projectCount: 1, projects: [] }));

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthApiService, useValue: { currentUser, logout: () => of(undefined) } },
        { provide: CustomerRepliesApiService, useValue: { summaryChanges: of({ newReplyCount: 0, projectCount: 0, projects: [] }), summary } },
        { provide: NotificationsApiService, useValue: { current: signal(null), load: () => of({ items: [], totalCount: 0 }) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    currentUser.set({ id: '22222222-2222-4222-8222-222222222222', email: 'second@example.test' });
    await fixture.whenStable();

    staleSummary.next({ newReplyCount: 9, projectCount: 1, projects: [] });
    fixture.detectChanges();

    expect(summary).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.querySelector('[data-testid="global-customer-reply-count"]')?.textContent).toContain('2');
  });

  it('keeps the signed-in session after logout failure and permits one retry', async () => {
    const currentUser = signal({ id: '11111111-1111-4111-8111-111111111111', email: 'po@example.test' });
    const pendingLogout = new Subject<void>();
    const logout = vi.fn().mockReturnValueOnce(pendingLogout).mockReturnValueOnce(of(undefined));

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([{ path: 'login', children: [] }]),
        { provide: AuthApiService, useValue: { currentUser, logout } },
        { provide: CustomerRepliesApiService, useValue: { summaryChanges: of({ newReplyCount: 0, projectCount: 0, projects: [] }), summary: () => of({ newReplyCount: 0, projectCount: 0, projects: [] }) } },
        { provide: NotificationsApiService, useValue: { current: signal(null), load: () => of({ items: [], totalCount: 0 }) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const signOut = () => fixture.nativeElement.querySelector('.user-actions button') as HTMLButtonElement;

    signOut().click();
    signOut().click();
    expect(logout).toHaveBeenCalledTimes(1);

    pendingLogout.error(new Error('Unable to sign out. Check your connection and try again.'));
    await fixture.whenStable();

    expect(currentUser()?.email).toBe('po@example.test');
    expect(fixture.nativeElement.querySelector('[data-testid="logout-error"]')?.getAttribute('role')).toBe('alert');
    expect(signOut().textContent?.trim()).toBe('Retry sign out');

    signOut().click();
    await fixture.whenStable();
    expect(logout).toHaveBeenCalledTimes(2);
  });

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
