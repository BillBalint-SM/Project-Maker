import { DATE_PIPE_DEFAULT_OPTIONS } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import type { ActiveProjectQueuePage } from '@project-maker/contracts';
import { of, Subject, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  ActiveProjectQueueApiService,
  ActiveProjectQueueCursorRequestError,
} from './active-project-queue-api.service';
import { ActiveProjectQueuePageComponent } from './active-project-queue.page';

const page: ActiveProjectQueuePage = {
  retrievedAt: '2026-08-19T08:00:00.000Z',
  totalCount: 12,
  groupCounts: { CUSTOMER_REPLY: 6, OVERDUE: 0, DUE_SOON: 0, IN_PROGRESS: 6 },
  previousCursor: 'previous-token',
  nextCursor: 'next-token',
  items: [
    {
      projectId: '11111111-1111-4111-8111-111111111111',
      projectName: 'Ügyfélválaszos projekt',
      urgency: 'CUSTOMER_REPLY',
      urgencyLabel: 'New Customer reply',
      preparationStatus: {
        projectId: '11111111-1111-4111-8111-111111111111',
        state: 'INTAKE_IN_PROGRESS',
        label: 'Initial Intake in progress',
        primaryAction: { target: 'INTERVIEW', label: 'Open Initial Intake' },
      },
      nextAction: 'Válasz feldolgozása',
      nextActionOwner: { role: 'INTERNAL_OWNER', displayName: 'Kovács Anna', complete: true },
      dueAt: null,
      newReplyCount: 2,
      progress: { kind: 'INTERVIEW_ANSWERS', answeredQuestions: 4, totalQuestions: 9 },
      primaryAction: { target: 'CUSTOMER_CORRESPONDENCE', label: 'Open Customer correspondence' },
    },
    {
      projectId: '22222222-2222-4222-8222-222222222222',
      projectName: 'Normál projekt',
      urgency: 'IN_PROGRESS',
      urgencyLabel: 'In progress',
      preparationStatus: {
        projectId: '22222222-2222-4222-8222-222222222222',
        state: 'SCHEMA_REQUIRED',
        label: 'Question schema required',
        primaryAction: { target: 'INTERVIEW', label: 'Open Initial Intake' },
      },
      nextAction: null,
      nextActionOwner: { role: null, displayName: null, complete: false },
      dueAt: null,
      newReplyCount: 0,
      primaryAction: { target: 'INTERVIEW', label: 'Open Initial Intake' },
    },
  ],
};

describe('ActiveProjectQueuePageComponent', () => {
  it('carries the exact filtered and paged queue URL into Project links', async () => {
    const api = { getPage: vi.fn().mockReturnValue(of(page)) };
    await TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'projects/active', component: ActiveProjectQueuePageComponent },
        ]),
        { provide: ActiveProjectQueueApiService, useValue: api },
      ],
    }).compileComponents();
    const sourceUrl =
      '/projects/active?q=Alfa&urgency=CUSTOMER_REPLY&preparation=INTAKE_IN_PROGRESS&cursor=opaque-page-2';
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl(sourceUrl, ActiveProjectQueuePageComponent);
    await harness.fixture.whenStable();

    const root = harness.routeNativeElement as HTMLElement;
    const projectLink = root.querySelector(
      '[data-testid="queue-project-11111111-1111-4111-8111-111111111111"]',
    ) as HTMLAnchorElement | null;
    const actionLink = root.querySelector(
      '[data-testid="queue-action-11111111-1111-4111-8111-111111111111"]',
    ) as HTMLAnchorElement | null;
    expect(returnTarget(projectLink)).toBe(sourceUrl);
    expect(returnTarget(actionLink)).toBe(sourceUrl);
    expect(
      (root.querySelector('[data-testid="journey-view-link"]') as HTMLAnchorElement | null)
        ?.getAttribute('href'),
    ).toBe('/?q=Alfa');
    expect(
      (root.querySelector('[data-testid="queue-view-link"]') as HTMLAnchorElement | null)
        ?.getAttribute('href'),
    ).toBe(sourceUrl);
  });

  it('renders semantic urgency groups and routes each public action correctly', async () => {
    const api = { getPage: vi.fn().mockReturnValue(of(page)) };
    await TestBed.configureTestingModule({
      imports: [ActiveProjectQueuePageComponent],
      providers: [
        provideRouter([]),
        { provide: ActiveProjectQueueApiService, useValue: api },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ActiveProjectQueuePageComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    expect(api.getPage).toHaveBeenCalledWith({
      search: undefined,
      urgencies: [],
      preparationStates: [],
      cursor: undefined,
    });
    expect(element.querySelectorAll('[data-testid="active-queue-group"]')).toHaveLength(2);
    expect(element.querySelector('[data-testid="active-queue-table"]')?.tagName).toBe('TABLE');
    expect(element.querySelector('.view-switch a')?.getAttribute('href')).toBe('/');
    expect(element.textContent).toContain('New Customer reply');
    expect(element.textContent).toContain('4 / 9 questions answered');
    expect(element.textContent).toContain('In progress');
    expect(element.textContent).toContain('2 of 12 active projects shown');
    expect(element.textContent).toContain('1 shown of 6 projects');
    const projectLink = element.querySelector(
      '[data-testid="queue-project-11111111-1111-4111-8111-111111111111"]',
    ) as HTMLAnchorElement | null;
    const customerAction = element.querySelector(
      '[data-testid="queue-action-11111111-1111-4111-8111-111111111111"]',
    ) as HTMLAnchorElement | null;
    const interviewAction = element.querySelector(
      '[data-testid="queue-action-22222222-2222-4222-8222-222222222222"]',
    ) as HTMLAnchorElement | null;
    expect(linkPath(projectLink)).toBe(
      '/projects/11111111-1111-4111-8111-111111111111/status',
    );
    expect(linkPath(customerAction)).toBe(
      '/projects/11111111-1111-4111-8111-111111111111/customer-correspondences',
    );
    expect(linkPath(interviewAction)).toBe(
      '/projects/22222222-2222-4222-8222-222222222222/interview',
    );
    expect(returnTarget(projectLink)).toBe('/');
    expect(returnTarget(customerAction)).toBe('/');
    expect(returnTarget(interviewAction)).toBe('/');
  });

  it('restores known URL filters and debounces a trimmed search into replace-navigation', async () => {
    vi.useFakeTimers();
    try {
      const api = { getPage: vi.fn().mockReturnValue(of(page)) };
      await TestBed.configureTestingModule({
        imports: [ActiveProjectQueuePageComponent],
        providers: [
          provideRouter([]),
          { provide: ActiveProjectQueueApiService, useValue: api },
        ],
      }).compileComponents();
      const router = TestBed.inject(Router);
      await router.navigateByUrl('/?q=%20%C3%81rv%C3%ADz%20&urgency=OVERDUE&urgency=UNKNOWN&preparation=SCHEMA_REQUIRED');
      const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

      const fixture = TestBed.createComponent(ActiveProjectQueuePageComponent);
      fixture.detectChanges();
      await vi.runAllTimersAsync();
      fixture.detectChanges();

      expect(api.getPage).toHaveBeenCalledWith({
        search: 'Árvíz',
        urgencies: ['OVERDUE'],
        preparationStates: ['SCHEMA_REQUIRED'],
        cursor: undefined,
      });
      const input = fixture.nativeElement.querySelector('[data-testid="queue-search"]') as HTMLInputElement;
      expect(input.value).toBe('Árvíz');
      input.value = '  új keresés  ';
      input.dispatchEvent(new Event('input'));
      fixture.detectChanges();
      await vi.advanceTimersByTimeAsync(299);
      expect(navigate).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
        queryParams: {
          q: 'új keresés',
          urgency: ['OVERDUE'],
          preparation: ['SCHEMA_REQUIRED'],
        },
        replaceUrl: true,
      }));
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps the newest URL intent when an older request completes later', async () => {
    const first = new Subject<ActiveProjectQueuePage>();
    const second = new Subject<ActiveProjectQueuePage>();
    const api = {
      getPage: vi.fn().mockImplementation((query: { search?: string }) =>
        query.search === 'első' ? first : second),
    };
    await TestBed.configureTestingModule({
      imports: [ActiveProjectQueuePageComponent],
      providers: [
        provideRouter([]),
        { provide: ActiveProjectQueueApiService, useValue: api },
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?q=els%C5%91');
    const fixture = TestBed.createComponent(ActiveProjectQueuePageComponent);
    fixture.detectChanges();
    await router.navigateByUrl('/?q=m%C3%A1sodik');
    fixture.detectChanges();

    const newestPage = { ...page, items: [{ ...page.items[0], projectName: 'Második eredmény' }] };
    second.next(newestPage);
    fixture.detectChanges();
    first.next({ ...page, items: [{ ...page.items[0], projectName: 'Elavult eredmény' }] });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Második eredmény');
    expect(fixture.nativeElement.textContent).not.toContain('Elavult eredmény');
  });

  it('adds cursor navigation to browser history while preserving the active filters', async () => {
    const api = { getPage: vi.fn().mockReturnValue(of(page)) };
    await TestBed.configureTestingModule({
      imports: [ActiveProjectQueuePageComponent],
      providers: [
        provideRouter([]),
        { provide: ActiveProjectQueueApiService, useValue: api },
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?q=projekt&urgency=OVERDUE');
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    const fixture = TestBed.createComponent(ActiveProjectQueuePageComponent);
    await fixture.whenStable();

    (fixture.nativeElement.querySelector('[data-testid="queue-next-page"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith([], expect.objectContaining({
      queryParams: {
        q: 'projekt',
        urgency: ['OVERDUE'],
        preparation: null,
        cursor: 'next-token',
      },
      replaceUrl: false,
    }));
  });

  it('does not let an older debounced search intent discard a newer page cursor', async () => {
    const api = { getPage: vi.fn().mockReturnValue(of(page)) };
    await TestBed.configureTestingModule({
      imports: [ActiveProjectQueuePageComponent],
      providers: [
        provideRouter([]),
        { provide: ActiveProjectQueueApiService, useValue: api },
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?q=projekt&urgency=OVERDUE');
    const fixture = TestBed.createComponent(ActiveProjectQueuePageComponent);
    await fixture.whenStable();

    fixture.componentInstance.search.setValue('projekt ');
    (
      fixture.nativeElement.querySelector(
        '[data-testid="queue-next-page"]',
      ) as HTMLButtonElement
    ).click();
    await fixture.whenStable();
    expect(router.url).toBe('/?q=projekt&urgency=OVERDUE&cursor=next-token');

    await new Promise((resolve) => setTimeout(resolve, 350));
    await fixture.whenStable();

    expect(router.url).toBe('/?q=projekt&urgency=OVERDUE&cursor=next-token');
  });

  it('recovers a rejected cursor URL to the first page with clear guidance', async () => {
    const firstPage = { ...page, previousCursor: null, nextCursor: null };
    const api = {
      getPage: vi.fn().mockImplementation((query: { cursor?: string }) =>
        query.cursor
          ? throwError(() => new ActiveProjectQueueCursorRequestError('OBSOLETE_CURSOR'))
          : of(firstPage)),
    };
    await TestBed.configureTestingModule({
      imports: [ActiveProjectQueuePageComponent],
      providers: [
        provideRouter([]),
        { provide: ActiveProjectQueueApiService, useValue: api },
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?q=projekt&cursor=obsolete-token');
    const fixture = TestBed.createComponent(ActiveProjectQueuePageComponent);
    await fixture.whenStable();

    expect(router.url).toBe('/?q=projekt');
    expect(api.getPage).toHaveBeenLastCalledWith({
      search: 'projekt',
      urgencies: [],
      preparationStates: [],
      cursor: undefined,
    });
    expect(fixture.nativeElement.textContent).toContain(
      'The previous page is no longer available. Showing the first page.',
    );

    await router.navigateByUrl('/?q=másik-projekt');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain(
      'The previous page is no longer available. Showing the first page.',
    );
  });

  it('keeps the last page and refresh focus when a first-page refresh fails', async () => {
    const refresh = new Subject<ActiveProjectQueuePage>();
    const api = {
      getPage: vi.fn().mockImplementation((query: { cursor?: string }) =>
        query.cursor ? of(page) : refresh),
    };
    await TestBed.configureTestingModule({
      imports: [ActiveProjectQueuePageComponent],
      providers: [
        provideRouter([]),
        { provide: ActiveProjectQueueApiService, useValue: api },
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?q=projekt&cursor=current-page');
    const fixture = TestBed.createComponent(ActiveProjectQueuePageComponent);
    await fixture.whenStable();
    const refreshButton = fixture.nativeElement.querySelector(
      '[data-testid="queue-refresh"]',
    ) as HTMLButtonElement;

    refreshButton.focus();
    refreshButton.click();
    await fixture.whenStable();
    refresh.error(new Error('Átmeneti hiba'));
    await fixture.whenStable();

    expect(router.url).toBe('/?q=projekt');
    expect(api.getPage).toHaveBeenLastCalledWith({
      search: 'projekt',
      urgencies: [],
      preparationStates: [],
      cursor: undefined,
    });
    expect(fixture.nativeElement.textContent).toContain('Ügyfélválaszos projekt');
    expect(fixture.nativeElement.textContent).toContain('The list may be stale.');
    expect(document.activeElement).toBe(refreshButton);
  });

  it('announces a successful explicit refresh and updates its retrieval time without polling', async () => {
    const refresh = new Subject<ActiveProjectQueuePage>();
    const refreshedPage = { ...page, retrievedAt: '2026-08-19T09:15:00.000Z' };
    const api = { getPage: vi.fn().mockReturnValueOnce(of(page)).mockReturnValueOnce(refresh) };
    await TestBed.configureTestingModule({
      imports: [ActiveProjectQueuePageComponent],
      providers: [
        provideRouter([]),
        { provide: ActiveProjectQueueApiService, useValue: api },
        { provide: DATE_PIPE_DEFAULT_OPTIONS, useValue: { timezone: 'UTC' } },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(ActiveProjectQueuePageComponent);
    await fixture.whenStable();
    const refreshButton = fixture.nativeElement.querySelector(
      '[data-testid="queue-refresh"]',
    ) as HTMLButtonElement;

    expect(api.getPage).toHaveBeenCalledTimes(1);
    refreshButton.focus();
    refreshButton.click();
    refresh.next(refreshedPage);
    await fixture.whenStable();

    expect(api.getPage).toHaveBeenCalledTimes(2);
    expect(fixture.nativeElement.textContent).toContain('Last retrieved: 2026-08-19 09:15');
    expect(fixture.nativeElement.querySelector('[data-testid="queue-live-status"]')?.textContent)
      .toContain('The list has been refreshed.');
    expect(document.activeElement).toBe(refreshButton);
  });

  it('retries the failed paging query while preserving the visible page and filters', async () => {
    let pagingAttempts = 0;
    const recoveredPage = {
      ...page,
      previousCursor: 'back-token',
      nextCursor: null,
      items: [{ ...page.items[1], projectName: 'Helyreállított oldal' }],
    };
    const api = {
      getPage: vi.fn().mockImplementation((query: { cursor?: string }) => {
        if (!query.cursor) return of(page);
        pagingAttempts += 1;
        return pagingAttempts === 1
          ? throwError(() => new Error('Átmeneti lapozási hiba'))
          : of(recoveredPage);
      }),
    };
    await TestBed.configureTestingModule({
      imports: [ActiveProjectQueuePageComponent],
      providers: [
        provideRouter([]),
        { provide: ActiveProjectQueueApiService, useValue: api },
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?q=projekt&urgency=OVERDUE');
    const fixture = TestBed.createComponent(ActiveProjectQueuePageComponent);
    await fixture.whenStable();

    (fixture.nativeElement.querySelector('[data-testid="queue-next-page"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(router.url).toBe('/?q=projekt&urgency=OVERDUE&cursor=next-token');
    expect(fixture.nativeElement.textContent).toContain('Ügyfélválaszos projekt');
    expect(fixture.nativeElement.textContent).toContain('The list may be stale.');

    (fixture.nativeElement.querySelector('[data-testid="queue-update-retry"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(api.getPage).toHaveBeenLastCalledWith({
      search: 'projekt',
      urgencies: ['OVERDUE'],
      preparationStates: [],
      cursor: 'next-token',
    });
    expect(router.url).toBe('/?q=projekt&urgency=OVERDUE&cursor=next-token');
    expect(fixture.nativeElement.textContent).toContain('Helyreállított oldal');
    expect(fixture.nativeElement.textContent).not.toContain('The list may be stale.');
  });

  it('retires an older failed request when a newer route query becomes active', async () => {
    const newestRequest = new Subject<ActiveProjectQueuePage>();
    const api = {
      getPage: vi.fn().mockImplementation((query: { search?: string }) => {
        if (query.search === 'hibás') return throwError(() => new Error('Átmeneti hiba'));
        if (query.search === 'új') return newestRequest;
        return of(page);
      }),
    };
    await TestBed.configureTestingModule({
      imports: [ActiveProjectQueuePageComponent],
      providers: [
        provideRouter([]),
        { provide: ActiveProjectQueueApiService, useValue: api },
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    const fixture = TestBed.createComponent(ActiveProjectQueuePageComponent);
    await fixture.whenStable();
    await router.navigateByUrl('/?q=hibás');
    await fixture.whenStable();
    expect(fixture.nativeElement.querySelector('[data-testid="queue-update-retry"]')).not.toBeNull();

    await router.navigateByUrl('/?q=új');
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid="queue-update-retry"]')).toBeNull();
    expect(api.getPage).toHaveBeenLastCalledWith({
      search: 'új',
      urgencies: [],
      preparationStates: [],
      cursor: undefined,
    });
    newestRequest.next({
      ...page,
      items: [{ ...page.items[1], projectName: 'Legújabb kérés' }],
    });
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Legújabb kérés');
  });

  it('replaces an initially unavailable queue with retry guidance and retries the same query', async () => {
    const api = {
      getPage: vi.fn()
        .mockReturnValueOnce(throwError(() => new Error('A szolgáltatás átmenetileg nem érhető el.')))
        .mockReturnValueOnce(of(page)),
    };
    await TestBed.configureTestingModule({
      imports: [ActiveProjectQueuePageComponent],
      providers: [
        provideRouter([]),
        { provide: ActiveProjectQueueApiService, useValue: api },
      ],
    }).compileComponents();
    await TestBed.inject(Router).navigateByUrl('/?q=projekt&urgency=DUE_SOON');
    const fixture = TestBed.createComponent(ActiveProjectQueuePageComponent);
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid="active-queue-error"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Ügyfélválaszos projekt');

    (fixture.nativeElement.querySelector('[data-testid="queue-initial-retry"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(api.getPage).toHaveBeenLastCalledWith({
      search: 'projekt',
      urgencies: ['DUE_SOON'],
      preparationStates: [],
      cursor: undefined,
    });
    expect(fixture.nativeElement.textContent).toContain('Ügyfélválaszos projekt');
    expect(fixture.nativeElement.querySelector('[data-testid="active-queue-error"]')).toBeNull();
  });

  it('preserves the genuine empty-portfolio state when no filters are active', async () => {
    const api = { getPage: vi.fn().mockReturnValue(of({ ...page, totalCount: 0, items: [] })) };
    await TestBed.configureTestingModule({
      imports: [ActiveProjectQueuePageComponent],
      providers: [
        provideRouter([]),
        { provide: ActiveProjectQueueApiService, useValue: api },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ActiveProjectQueuePageComponent);
    await fixture.whenStable();

    expect(fixture.nativeElement.textContent).toContain('No active projects');
    expect(fixture.nativeElement.textContent).not.toContain('No results');
    const links = [...fixture.nativeElement.querySelectorAll('[data-testid="active-queue-empty"] a')]
      .map((link: Element) => link.getAttribute('href'));
    expect(links).toContain('/');
    expect(links).toContain('/projects/new');
  });

  it('distinguishes a filtered queue with no matching projects', async () => {
    const api = { getPage: vi.fn().mockReturnValue(of({ ...page, totalCount: 0, items: [] })) };
    await TestBed.configureTestingModule({
      imports: [ActiveProjectQueuePageComponent],
      providers: [
        provideRouter([]),
        { provide: ActiveProjectQueueApiService, useValue: api },
      ],
    }).compileComponents();
    const router = TestBed.inject(Router);
    await router.navigateByUrl('/?q=nincs-ilyen-projekt&urgency=OVERDUE&cursor=old-page');

    const fixture = TestBed.createComponent(ActiveProjectQueuePageComponent);
    await fixture.whenStable();

    expect(
      fixture.nativeElement.querySelector('[data-testid="active-queue-empty"] h2')?.textContent,
    ).toContain('No results');
    (fixture.nativeElement.querySelector('[data-testid="queue-clear-filters"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(router.url).toBe('/');
    expect(fixture.nativeElement.textContent).toContain('No active projects');
  });
});

function returnTarget(link: HTMLAnchorElement | null): string | null {
  const href = link?.getAttribute('href');
  return href ? new URL(href, 'https://project-maker.test').searchParams.get('returnTo') : null;
}

function linkPath(link: HTMLAnchorElement | null): string | null {
  const href = link?.getAttribute('href');
  return href ? new URL(href, 'https://project-maker.test').pathname : null;
}
