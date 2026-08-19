import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { CustomerMailboxSyncStatus, ProjectPortfolioEntry } from '@project-maker/contracts';

import { CustomerMailboxSyncApiService } from './customer-mailbox-sync-api.service';
import { CustomerRepliesApiService } from './customer-replies-api.service';
import { ProjectApiService } from './project-api.service';
import { ProjectListPage } from './project-list.page';

describe('ProjectListPage customer mailbox synchronization', () => {
  it('shows mailbox freshness and refreshes through the employee action', async () => {
    const initial: CustomerMailboxSyncStatus = {
      mailboxAddress: 'project-maker@pte.hu',
      state: 'DELAYED',
      baselineEstablished: true,
      lastSuccessfulSyncAt: '2026-08-18T10:00:00.000Z',
      refreshInProgress: false,
    };
    const refreshed: CustomerMailboxSyncStatus = {
      ...initial,
      state: 'CURRENT',
      lastSuccessfulSyncAt: '2026-08-18T12:00:00.000Z',
    };
    const mailboxApi = {
      status: vi.fn().mockReturnValue(of(initial)),
      refresh: vi.fn().mockReturnValue(of(refreshed)),
    };

    await TestBed.configureTestingModule({
      imports: [ProjectListPage],
      providers: [
        provideRouter([]),
        {
          provide: ProjectApiService,
          useValue: { loadPortfolio: vi.fn().mockReturnValue(of([])) },
        },
        { provide: CustomerMailboxSyncApiService, useValue: mailboxApi },
        {
          provide: CustomerRepliesApiService,
          useValue: {
            summary: vi.fn().mockReturnValue(of({ newReplyCount: 0, projectCount: 0, projects: [] })),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProjectListPage);
    await fixture.whenStable();

    expect(
      fixture.nativeElement.querySelector('[data-testid="mailbox-sync-status"]')?.textContent,
    ).toContain('Postafiók-szinkron késik');
    expect(
      fixture.nativeElement.querySelector('[data-testid="active-project-queue-link"]')?.getAttribute('href'),
    ).toBe('/projects/active');

    const refreshHost = fixture.nativeElement.querySelector(
      '[data-testid="refresh-customer-mailbox"]',
    ) as HTMLElement | null;
    (refreshHost?.querySelector('button') ?? refreshHost)?.dispatchEvent(new MouseEvent('click'));
    await fixture.whenStable();

    expect(mailboxApi.refresh).toHaveBeenCalledTimes(1);
    expect(
      fixture.nativeElement.querySelector('[data-testid="mailbox-sync-status"]')?.textContent,
    ).toContain('Postafiók naprakész');
  });

  it('renders the canonical primary task and factual progress without per-Project status calls', async () => {
    const entry: ProjectPortfolioEntry = {
      project: {
        id: '11111111-1111-4111-8111-111111111111',
        name: 'Ügyfélválaszos projekt',
        customerContactName: 'Ügyfél Anna',
        customerContactEmail: 'anna@example.test',
        status: 'DRAFT',
        internalOwnerName: 'PO Péter',
        nextActionOwnerRole: 'INTERNAL_OWNER',
        nextActionOwner: { role: 'INTERNAL_OWNER', displayName: 'PO Péter', complete: true },
        nextAction: 'Egyeztesd a pontosított terjedelmet.',
        dueAt: '2026-08-20T12:00:00.000Z',
        createdAt: '2026-08-18T08:00:00.000Z',
        updatedAt: '2026-08-19T08:00:00.000Z',
      },
      workState: {
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
        nextAction: 'Egyeztesd a pontosított terjedelmet.',
        nextActionOwner: { role: 'INTERNAL_OWNER', displayName: 'PO Péter', complete: true },
        dueAt: '2026-08-20T12:00:00.000Z',
        newReplyCount: 2,
        progress: { kind: 'INTERVIEW_ANSWERS', answeredQuestions: 4, totalQuestions: 9 },
        primaryAction: {
          target: 'CUSTOMER_CORRESPONDENCE',
          label: 'Ügyféllevelezés megnyitása',
        },
      },
    };
    const projectApi = {
      loadPortfolio: vi.fn().mockReturnValue(of([entry])),
      loadPreparationStatus: vi.fn(),
      listProjects: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [ProjectListPage],
      providers: [
        provideRouter([]),
        { provide: ProjectApiService, useValue: projectApi },
        {
          provide: CustomerMailboxSyncApiService,
          useValue: {
            status: vi.fn().mockReturnValue(of({
              mailboxAddress: null,
              state: 'NOT_CONFIGURED',
              baselineEstablished: false,
              lastSuccessfulSyncAt: null,
              refreshInProgress: false,
            } satisfies CustomerMailboxSyncStatus)),
            refresh: vi.fn(),
          },
        },
        {
          provide: CustomerRepliesApiService,
          useValue: {
            summary: vi.fn().mockReturnValue(of({ newReplyCount: 0, projectCount: 0, projects: [] })),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProjectListPage);
    await fixture.whenStable();

    const card = fixture.nativeElement.querySelector(
      '[data-testid="project-card-11111111-1111-4111-8111-111111111111"]',
    ) as HTMLAnchorElement | null;
    expect(projectApi.loadPortfolio).toHaveBeenCalledTimes(1);
    expect(projectApi.listProjects).not.toHaveBeenCalled();
    expect(projectApi.loadPreparationStatus).not.toHaveBeenCalled();
    const destination = new URL(
      card?.getAttribute('href') ?? '',
      'https://project-maker.test',
    );
    expect(destination.pathname).toBe(
      '/projects/11111111-1111-4111-8111-111111111111/customer-correspondences',
    );
    expect(destination.searchParams.get('returnTo')).toBe('/');
    expect(card?.textContent).toContain('Ügyféllevelezés megnyitása');
    expect(card?.textContent).toContain('4 / 9 kérdés megválaszolva');
    expect(card?.textContent).toContain('Új ügyfélválasz');
  });
});
