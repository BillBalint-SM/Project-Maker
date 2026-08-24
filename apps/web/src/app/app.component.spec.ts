import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, Subject, tap, throwError } from 'rxjs';

import { AppComponent } from './app.component';
import { AuthApiService } from './auth/auth-api.service';
import { NotificationsApiService } from './notifications/notifications-api.service';
import { CustomerRepliesApiService } from './projects/customer-replies-api.service';

const firstUserId = '11111111-1111-4111-8111-111111111111';
const secondUserId = '22222222-2222-4222-8222-222222222222';

function replyUpdate(newReplyCount: number, userId = firstUserId) {
  return {
    userId,
    summary: {
      newReplyCount,
      projectCount: newReplyCount > 0 ? 1 : 0,
      projects: [] as never[],
    },
  };
}

function notificationSnapshot(totalCount: number, userId = firstUserId) {
  return { userId, notifications: { items: [] as never[], totalCount } };
}

describe('AppComponent', () => {
  it('updates the Customer-reply badge when correspondence work publishes a later summary', async () => {
    const summaryChanges = new Subject<ReturnType<typeof replyUpdate>>();

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
    summaryChanges.next(replyUpdate(4));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="global-customer-reply-count"]')?.textContent).toContain('4');
  });

  it('updates the Notifications badge when the Notifications page changes its current result', async () => {
    const current = signal(notificationSnapshot(1));

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthApiService, useValue: { currentUser: signal({ id: '11111111-1111-4111-8111-111111111111', email: 'po@example.test' }), logout: () => of(undefined) } },
        { provide: CustomerRepliesApiService, useValue: { summaryChanges: of(replyUpdate(0)), summary: () => of({ newReplyCount: 0, projectCount: 0, projects: [] }) } },
        { provide: NotificationsApiService, useValue: { current, load: () => of({ items: [], totalCount: 1 }) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    current.set(notificationSnapshot(6));
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
        { provide: CustomerRepliesApiService, useValue: { summaryChanges: of(replyUpdate(0)), summary: () => of({ newReplyCount: 0, projectCount: 0, projects: [] }) } },
        { provide: NotificationsApiService, useValue: { current: signal(null), load: () => of({ items: [], totalCount: 0 }) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const navigationToggle = fixture.nativeElement.querySelector('[data-testid="navigation-toggle"]') as HTMLButtonElement;
    navigationToggle.click();
    fixture.detectChanges();
    const logoutButton = fixture.nativeElement.querySelector('.user-actions button') as HTMLButtonElement;
    logoutButton.focus();
    logoutButton.click();
    fixture.componentInstance.handleHeaderFocusOut(new FocusEvent('focusout'));
    pendingLogout.error(new Error('Unable to sign out. Check your connection and try again.'));
    await fixture.whenStable();

    expect(navigationToggle.getAttribute('aria-expanded')).toBe('true');
    expect(fixture.nativeElement.querySelector('[data-testid="navigation-panel"]')?.classList.contains('open')).toBe(true);
    expect(document.activeElement).toBe(logoutButton);
  });

  it('gives the navigation menu toggle an explicit state-aware accessible name', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthApiService, useValue: { currentUser: signal({ id: firstUserId, email: 'po@example.test' }), logout: () => of(undefined) } },
        { provide: CustomerRepliesApiService, useValue: { summaryChanges: of(replyUpdate(0)), summary: () => of({ newReplyCount: 0, projectCount: 0, projects: [] }) } },
        { provide: NotificationsApiService, useValue: { current: signal(null), load: () => of({ items: [], totalCount: 0 }) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const toggle = fixture.nativeElement.querySelector('[data-testid="navigation-toggle"]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-label')).toBe('Open navigation menu');
    expect(toggle.textContent).toContain('Navigate');

    toggle.click();
    fixture.detectChanges();
    expect(toggle.getAttribute('aria-label')).toBe('Close navigation menu');
  });

  it('opens Journey navigation with Control K and moves focus to the first destination', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthApiService, useValue: { currentUser: signal({ id: firstUserId, email: 'po@example.test' }), logout: () => of(undefined) } },
        { provide: CustomerRepliesApiService, useValue: { summaryChanges: of(replyUpdate(0)), summary: () => of({ newReplyCount: 0, projectCount: 0, projects: [] }) } },
        { provide: NotificationsApiService, useValue: { current: signal(null), load: () => of({ items: [], totalCount: 0 }) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, cancelable: true });
    document.dispatchEvent(event);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(event.defaultPrevented).toBe(true);
    expect(fixture.nativeElement.querySelector('[data-testid="navigation-panel"]')?.classList.contains('open')).toBe(true);
    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('[data-testid="global-portfolio-link"]'),
    );
  });

  it('moves focus to main content after a route activation beyond the initial route', async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthApiService, useValue: { currentUser: signal({ id: firstUserId, email: 'po@example.test' }), logout: () => of(undefined) } },
        { provide: CustomerRepliesApiService, useValue: { summaryChanges: of(replyUpdate(0)), summary: () => of({ newReplyCount: 0, projectCount: 0, projects: [] }) } },
        { provide: NotificationsApiService, useValue: { current: signal(null), load: () => of({ items: [], totalCount: 0 }) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    fixture.componentInstance.handleRouteActivate();
    fixture.componentInstance.handleRouteActivate();
    fixture.detectChanges();
    await fixture.whenStable();

    expect(document.activeElement).toBe(
      fixture.nativeElement.querySelector('#main-content'),
    );
  });

  it('shows a retry for a failed Customer-reply summary without reloading Notifications', async () => {
    const summaryChanges = new Subject<ReturnType<typeof replyUpdate>>();
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
          useValue: { summaryChanges, summary },
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
    const current = signal<ReturnType<typeof notificationSnapshot> | null>(null);
    const notificationLoad = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('Notifications are currently unavailable.')))
      .mockReturnValueOnce(of({ items: [], totalCount: 5 }).pipe(tap(() => current.set(notificationSnapshot(5)))));

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
        { provide: CustomerRepliesApiService, useValue: { summaryChanges: of(replyUpdate(0)), summary } },
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

  it('accepts a later feature-local Customer-reply summary after the shell load fails', async () => {
    const summaryChanges = new Subject<ReturnType<typeof replyUpdate>>();
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthApiService, useValue: { currentUser: signal({ id: '11111111-1111-4111-8111-111111111111', email: 'po@example.test' }), logout: () => of(undefined) } },
        { provide: CustomerRepliesApiService, useValue: { summaryChanges, summary: () => throwError(() => new Error('Customer replies are currently unavailable.')) } },
        { provide: NotificationsApiService, useValue: { current: signal(null), load: () => of({ items: [], totalCount: 0 }) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-testid="customer-reply-load-error"]')).not.toBeNull();

    summaryChanges.next(replyUpdate(2));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="global-customer-reply-count"]')?.textContent).toContain('2');
    expect(fixture.nativeElement.querySelector('[data-testid="customer-reply-load-error"]')).toBeNull();
  });

  it('accepts a later feature-local Notifications result after the shell load fails', async () => {
    const current = signal<ReturnType<typeof notificationSnapshot> | null>(null);
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthApiService, useValue: { currentUser: signal({ id: '11111111-1111-4111-8111-111111111111', email: 'po@example.test' }), logout: () => of(undefined) } },
        { provide: CustomerRepliesApiService, useValue: { summaryChanges: of(replyUpdate(0)), summary: () => of({ newReplyCount: 0, projectCount: 0, projects: [] }) } },
        { provide: NotificationsApiService, useValue: { current, load: () => throwError(() => new Error('Notifications are currently unavailable.')) } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-testid="notification-load-error"]')).not.toBeNull();

    current.set(notificationSnapshot(3));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[aria-label="3 active notifications"]')?.textContent).toContain('3');
    expect(fixture.nativeElement.querySelector('[data-testid="notification-load-error"]')).toBeNull();
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
        { provide: CustomerRepliesApiService, useValue: { summaryChanges: of(replyUpdate(0)), summary } },
        { provide: NotificationsApiService, useValue: { current: signal(null), clearCurrent: vi.fn(), load: () => of({ items: [], totalCount: 0 }) } },
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

  it('ignores a feature-local Customer-reply update from the previous signed-in user', async () => {
    const currentUser = signal({ id: '11111111-1111-4111-8111-111111111111', email: 'first@example.test' });
    const summaryChanges = new Subject<ReturnType<typeof replyUpdate>>();
    const summary = vi
      .fn()
      .mockReturnValueOnce(of({ newReplyCount: 1, projectCount: 1, projects: [] }))
      .mockReturnValueOnce(of({ newReplyCount: 2, projectCount: 1, projects: [] }));

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthApiService, useValue: { currentUser, logout: () => of(undefined) } },
        { provide: CustomerRepliesApiService, useValue: { summaryChanges, summary } },
        { provide: NotificationsApiService, useValue: { current: signal(null), clearCurrent: vi.fn(), load: () => of({ items: [], totalCount: 0 }) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    currentUser.set({ id: '22222222-2222-4222-8222-222222222222', email: 'second@example.test' });
    await fixture.whenStable();

    summaryChanges.next(replyUpdate(9, firstUserId));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="global-customer-reply-count"]')?.textContent).toContain('2');
  });

  it('ignores a feature-local Notifications result from the previous signed-in user', async () => {
    const currentUser = signal({ id: '11111111-1111-4111-8111-111111111111', email: 'first@example.test' });
    const current = signal<ReturnType<typeof notificationSnapshot> | null>(null);
    const notificationLoad = vi
      .fn()
      .mockReturnValueOnce(of({ items: [], totalCount: 1 }).pipe(tap(() => current.set(notificationSnapshot(1, firstUserId)))))
      .mockReturnValueOnce(of({ items: [], totalCount: 2 }).pipe(tap(() => current.set(notificationSnapshot(2, secondUserId)))));

    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [
        provideRouter([]),
        { provide: AuthApiService, useValue: { currentUser, logout: () => of(undefined) } },
        { provide: CustomerRepliesApiService, useValue: { summaryChanges: of(replyUpdate(0)), summary: () => of({ newReplyCount: 0, projectCount: 0, projects: [] }) } },
        { provide: NotificationsApiService, useValue: { current, clearCurrent: () => current.set(null), load: notificationLoad } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    currentUser.set({ id: '22222222-2222-4222-8222-222222222222', email: 'second@example.test' });
    await fixture.whenStable();

    current.set(notificationSnapshot(9, firstUserId));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[aria-label="2 active notifications"]')?.textContent).toContain('2');
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
        { provide: CustomerRepliesApiService, useValue: { summaryChanges: of(replyUpdate(0)), summary: () => of({ newReplyCount: 0, projectCount: 0, projects: [] }) } },
        { provide: NotificationsApiService, useValue: { current: signal(null), load: () => of({ items: [], totalCount: 0 }) } },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(AppComponent);
    await fixture.whenStable();
    const signOut = () => fixture.nativeElement.querySelector('.user-actions button') as HTMLButtonElement;

    signOut().click();
    signOut().click();
    expect(logout).toHaveBeenCalledTimes(1);

    pendingLogout.error(new Error('ECONNRESET at internal-auth-node-7'));
    await fixture.whenStable();

    expect(currentUser()?.email).toBe('po@example.test');
    const logoutError = fixture.nativeElement.querySelector('[data-testid="logout-error"]') as HTMLElement | null;
    expect(logoutError?.getAttribute('role')).toBe('alert');
    expect(logoutError?.textContent?.trim()).toBe('Unable to sign out. Check your connection and try again.');
    expect(logoutError?.textContent).not.toContain('ECONNRESET');
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
            summaryChanges: of(replyUpdate(3)),
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
      'Question Templates',
    ]);
    expect(
      fixture.nativeElement.querySelector('.workspace-map-link')?.getAttribute('href'),
    ).toBe('/workspace-map');

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
    await fixture.whenStable();

    expect(navigationToggle?.getAttribute('aria-expanded')).toBe('false');
    expect(navigationPanel?.classList.contains('open')).toBe(false);
    expect(document.activeElement).toBe(navigationToggle);
  });
});
