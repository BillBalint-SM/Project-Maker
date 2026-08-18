import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { ActiveProjectQueuePage } from '@project-maker/contracts';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ActiveProjectQueueApiService } from './active-project-queue-api.service';
import { ActiveProjectQueuePageComponent } from './active-project-queue.page';

const page: ActiveProjectQueuePage = {
  retrievedAt: '2026-08-19T08:00:00.000Z',
  totalCount: 12,
  groupCounts: { CUSTOMER_REPLY: 6, OVERDUE: 0, DUE_SOON: 0, IN_PROGRESS: 6 },
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
    const api = { firstPage: vi.fn().mockReturnValue(of(page)) };
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
    expect(api.firstPage).toHaveBeenCalledTimes(1);
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
});
