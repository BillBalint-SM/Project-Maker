import { DATE_PIPE_DEFAULT_OPTIONS } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
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
      urgencyLabel: 'Új ügyfélválasz',
      preparationStatus: {
        projectId: '11111111-1111-4111-8111-111111111111',
        state: 'INTAKE_IN_PROGRESS',
        label: 'Felmérés folyamatban',
        primaryAction: { target: 'INTERVIEW', label: 'Felmérés megnyitása' },
      },
      nextAction: 'Válasz feldolgozása',
      nextActionOwner: { role: 'INTERNAL_OWNER', displayName: 'Kovács Anna', complete: true },
      dueAt: null,
      newReplyCount: 2,
      primaryAction: { target: 'CUSTOMER_CORRESPONDENCE', label: 'Ügyféllevelezés megnyitása' },
    },
    {
      projectId: '22222222-2222-4222-8222-222222222222',
      projectName: 'Normál projekt',
      urgency: 'IN_PROGRESS',
      urgencyLabel: 'Folyamatban',
      preparationStatus: {
        projectId: '22222222-2222-4222-8222-222222222222',
        state: 'SCHEMA_REQUIRED',
        label: 'Kérdésséma szükséges',
        primaryAction: { target: 'INTERVIEW', label: 'Felmérés megnyitása' },
      },
      nextAction: null,
      nextActionOwner: { role: null, displayName: null, complete: false },
      dueAt: null,
      newReplyCount: 0,
      primaryAction: { target: 'INTERVIEW', label: 'Felmérés megnyitása' },
    },
  ],
};

describe('ActiveProjectQueuePageComponent', () => {
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
    expect(element.textContent).toContain('Új ügyfélválasz');
    expect(element.textContent).toContain('Folyamatban');
    expect(element.textContent).toContain('2 projekt látható az összesen 12 aktív projektből');
    expect(element.textContent).toContain('1 látható, összesen 6 projekt');
    expect(element.querySelector('[data-testid="queue-project-11111111-1111-4111-8111-111111111111"]')?.getAttribute('href'))
      .toBe('/projects/11111111-1111-4111-8111-111111111111/status');
    expect(element.querySelector('[data-testid="queue-action-11111111-1111-4111-8111-111111111111"]')?.getAttribute('href'))
      .toBe('/projects/11111111-1111-4111-8111-111111111111/customer-correspondences');
    expect(element.querySelector('[data-testid="queue-action-22222222-2222-4222-8222-222222222222"]')?.getAttribute('href'))
      .toBe('/projects/22222222-2222-4222-8222-222222222222/interview');
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

  it('recovers a rejected cursor URL to the first page with Hungarian guidance', async () => {
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
      'A korábbi oldal már nem állítható helyre. Az első oldalt mutatjuk.',
    );

    await router.navigateByUrl('/?q=másik-projekt');
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).not.toContain(
      'A korábbi oldal már nem állítható helyre. Az első oldalt mutatjuk.',
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
    expect(fixture.nativeElement.textContent).toContain('A lista elavult lehet.');
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
    expect(fixture.nativeElement.textContent).toContain('Utolsó lekérés: 2026. 08. 19. 09:15');
    expect(fixture.nativeElement.querySelector('[data-testid="queue-live-status"]')?.textContent)
      .toContain('A munkasor frissítve.');
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
    expect(fixture.nativeElement.textContent).toContain('A lista elavult lehet.');

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
    expect(fixture.nativeElement.textContent).not.toContain('A lista elavult lehet.');
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

    expect(fixture.nativeElement.textContent).toContain('Nincs aktív projekt');
    expect(fixture.nativeElement.textContent).not.toContain('Nincs találat');
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

    expect(fixture.nativeElement.textContent).toContain('Nincs találat');
    expect(fixture.nativeElement.textContent).not.toContain('Nincs aktív projekt');
    (fixture.nativeElement.querySelector('[data-testid="queue-clear-filters"]') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(router.url).toBe('/');
    expect(fixture.nativeElement.textContent).toContain('Nincs aktív projekt');
  });
});
