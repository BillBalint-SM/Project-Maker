import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { OpenDiscoveryFollowUpQueueItem } from '@project-maker/contracts';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import {
  DiscoveryFollowUpsApiError,
  DiscoveryFollowUpsApiService,
} from './discovery-follow-ups/discovery-follow-ups-api.service';
import { OpenDiscoveryFollowUpsPage } from './open-discovery-follow-ups.page';

const openItem: OpenDiscoveryFollowUpQueueItem = {
  id: '11111111-1111-4111-8111-111111111111',
  projectId: '22222222-2222-4222-8222-222222222222',
  projectName: 'Hallgatói portál megújítása',
  category: 'BUSINESS',
  question: 'Ki hagyja jóvá az új ügyfélutat?',
  owner: 'Termékgazda',
  dueDate: '2026-08-21',
  nextStep: 'Jóváhagyó kijelölése.',
};

describe('OpenDiscoveryFollowUpsPage', () => {
  it('renders the cross-project work queue with a precise return path', async () => {
    const api = { listOpen: vi.fn().mockReturnValue(of([openItem])) };
    await TestBed.configureTestingModule({
      imports: [OpenDiscoveryFollowUpsPage],
      providers: [
        provideRouter([]),
        { provide: DiscoveryFollowUpsApiService, useValue: api },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OpenDiscoveryFollowUpsPage);
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Tisztázandó tételek');
    expect(root.querySelectorAll('[data-testid="open-follow-up-row"]')).toHaveLength(1);
    expect(root.textContent).toContain('Hallgatói portál megújítása');
    expect(root.textContent).toContain('Üzleti');
    const action = root.querySelector('[data-testid="open-follow-up-action"]') as HTMLAnchorElement;
    const destination = new URL(action.getAttribute('href') ?? '', 'https://project-maker.test');
    expect(destination.pathname).toBe(
      '/projects/22222222-2222-4222-8222-222222222222/readiness',
    );
    expect(destination.searchParams.get('returnTo')).toBe('/follow-ups');
    expect(destination.hash).toBe('#discovery-follow-ups');
  });

  it('explains an empty queue and contains a safe recovery action on failure', async () => {
    const api = {
      listOpen: vi
        .fn()
        .mockReturnValue(of([]))
        .mockReturnValueOnce(of([]))
        .mockReturnValueOnce(
          throwError(
            () =>
              new DiscoveryFollowUpsApiError(
                'A tisztázandó tételek nem tölthetők be.',
                'load',
                503,
              ),
          ),
        ),
    };
    await TestBed.configureTestingModule({
      imports: [OpenDiscoveryFollowUpsPage],
      providers: [
        provideRouter([]),
        { provide: DiscoveryFollowUpsApiService, useValue: api },
      ],
    }).compileComponents();

    const emptyFixture = TestBed.createComponent(OpenDiscoveryFollowUpsPage);
    await emptyFixture.whenStable();
    expect(emptyFixture.nativeElement.textContent).toContain('Nincs nyitott tisztázandó tétel');
    expect(emptyFixture.nativeElement.querySelector('[data-testid="follow-ups-empty-portfolio"]')).not.toBeNull();

    const errorFixture = TestBed.createComponent(OpenDiscoveryFollowUpsPage);
    await errorFixture.whenStable();
    expect(errorFixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'A tisztázandó tételek nem tölthetők be.',
    );
    const retry = errorFixture.nativeElement.querySelector(
      '[data-testid="follow-ups-retry"]',
    ) as HTMLButtonElement;
    retry.click();
    await errorFixture.whenStable();
    expect(api.listOpen).toHaveBeenCalledTimes(3);
  });

  it('does not expose an unexpected internal failure', async () => {
    const api = {
      listOpen: vi.fn().mockReturnValue(
        throwError(() => new Error('PostgreSQL connection password=secret')),
      ),
    };
    await TestBed.configureTestingModule({
      imports: [OpenDiscoveryFollowUpsPage],
      providers: [
        provideRouter([]),
        { provide: DiscoveryFollowUpsApiService, useValue: api },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(OpenDiscoveryFollowUpsPage);
    await fixture.whenStable();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain(
      'A tisztázandó tételek nem tölthetők be. Próbáld meg újra.',
    );
    expect(alert.textContent).not.toContain('PostgreSQL');
    expect(alert.textContent).not.toContain('password');
  });
});
