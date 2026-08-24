import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { CustomerMailboxSyncStatus, PortfolioPage, ProjectPortfolioEntry } from '@project-maker/contracts';

import { AuthApiService } from '../auth/auth-api.service';
import { CustomerMailboxSyncApiService } from './customer-mailbox-sync-api.service';
import { CustomerRepliesApiService } from './customer-replies-api.service';
import { DecisionPortfolioApiService } from './decision-portfolio-api.service';
import { ProjectListPage } from './project-list.page';

describe('ProjectListPage', () => {
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
        { provide: DecisionPortfolioApiService, useValue: { portfolio: vi.fn().mockReturnValue(of(emptyPortfolio())) } },
        { provide: AuthApiService, useValue: { currentUser: signal({ id: 'user-1', email: 'po@example.test' }) } },
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
    ).toContain('Correspondence mailbox sync is delayed');
    expect(
      fixture.nativeElement.querySelector('[data-testid="active-project-queue-link"]')?.getAttribute('href'),
    ).toBe('/projects/active');
    expect(
      fixture.nativeElement.querySelector('[data-testid="portfolio-view-switch"]'),
    ).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="journey-field"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="journey-field"]')?.textContent)
      .toContain('No preparation positions yet');
    expect(fixture.nativeElement.querySelector('[data-testid="projects-empty"]')?.textContent)
      .toContain('Create your first project');
    expect(fixture.nativeElement.querySelectorAll('[data-testid="first-project-checklist"] li'))
      .toHaveLength(3);

    const refreshHost = fixture.nativeElement.querySelector(
      '[data-testid="refresh-customer-mailbox"]',
    ) as HTMLElement | null;
    (refreshHost?.querySelector('button') ?? refreshHost)?.dispatchEvent(new MouseEvent('click'));
    await fixture.whenStable();

    expect(mailboxApi.refresh).toHaveBeenCalledTimes(1);
    expect(
      fixture.nativeElement.querySelector('[data-testid="mailbox-sync-status"]')?.textContent,
    ).toContain('Correspondence mailbox is current');
  });

  it('keeps the shared search context when switching from Journey to Queue', async () => {
    const portfolioApi = { portfolio: vi.fn().mockReturnValue(of(emptyPortfolio())) };
    await TestBed.configureTestingModule({
      imports: [ProjectListPage],
      providers: [
        provideRouter([]),
        { provide: DecisionPortfolioApiService, useValue: portfolioApi },
        { provide: AuthApiService, useValue: { currentUser: signal({ id: 'user-1', email: 'po@example.test' }) } },
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
    fixture.componentInstance.filterForm.controls.search.setValue('Alfa project');
    fixture.componentInstance.applyFilters();
    await fixture.whenStable();

    const queueLink = fixture.nativeElement.querySelector(
      '[data-testid="active-project-queue-link"]',
    ) as HTMLAnchorElement | null;
    expect(queueLink?.getAttribute('href')).toBe('/projects/active?q=Alfa%20project');
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
        nextActionOwner: { role: 'INTERNAL_OWNER', displayName: 'Write-model owner', complete: true },
        nextAction: 'Write-model next action.',
        dueAt: '2026-08-20T12:00:00.000Z',
        playbook: { id: 'general', version: 1, name: 'Általános projekt' },
        initiativeId: null,
        createdAt: '2026-08-18T08:00:00.000Z',
        updatedAt: '2026-08-19T08:00:00.000Z',
      },
      workState: {
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
        nextAction: 'Canonical operational next action.',
        nextActionOwner: { role: 'INTERNAL_OWNER', displayName: 'Canonical owner', complete: true },
        dueAt: '2026-08-20T12:00:00.000Z',
        newReplyCount: 2,
        progress: { kind: 'INTERVIEW_ANSWERS', answeredQuestions: 4, totalQuestions: 9 },
        primaryAction: {
          target: 'CUSTOMER_CORRESPONDENCE',
          label: 'Open Customer correspondence',
        },
      },
    };
    const portfolioApi = {
      portfolio: vi.fn().mockReturnValue(of({
        ...emptyPortfolio(),
        items: [{
          ...entry,
          readinessPercentage: null,
          decisionScore: null,
          latestDecision: null,
          latestStatus: {
            id: '22222222-2222-4222-8222-222222222222',
            projectId: entry.project.id,
            version: 1,
            health: 'ON_TRACK',
            summary: 'Historical status snapshot',
            changes: null,
            risks: null,
            nextStep: 'Historical status next step.',
            actorId: '33333333-3333-4333-8333-333333333333',
            createdAt: '2026-08-19T08:00:00.000Z',
            updatedAt: '2026-08-19T08:00:00.000Z',
            editable: true,
          },
          goal: null,
          initiative: null,
        }],
        totalCount: 1,
        pageCount: 1,
      } satisfies PortfolioPage)),
    };
    await TestBed.configureTestingModule({
      imports: [ProjectListPage],
      providers: [
        provideRouter([]),
        { provide: DecisionPortfolioApiService, useValue: portfolioApi },
        { provide: AuthApiService, useValue: { currentUser: signal({ id: 'user-1', email: 'po@example.test' }) } },
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
    expect(portfolioApi.portfolio).toHaveBeenCalledTimes(1);
    const destination = new URL(
      card?.getAttribute('href') ?? '',
      'https://project-maker.test',
    );
    expect(destination.pathname).toBe(
      '/projects/11111111-1111-4111-8111-111111111111/customer-correspondences',
    );
    expect(destination.searchParams.get('returnTo')).toBe('/');
    expect(card?.textContent).toContain('Open Customer correspondence');
    expect(card?.textContent).toContain('4 / 9 questions answered');
    expect(card?.textContent).toContain('New Customer reply');
    expect(card?.textContent).toContain('Canonical owner');
    expect(card?.textContent).toContain('Canonical operational next action.');
    expect(card?.textContent).not.toContain('Write-model owner');
    expect(card?.textContent).not.toContain('Write-model next action.');
    expect(card?.textContent).not.toContain('Historical status next step.');
    expect(
      fixture.nativeElement.querySelector(
        '[data-testid="journey-node-11111111-1111-4111-8111-111111111111"]',
      )?.textContent,
    ).toContain('Ügyfélválaszos projekt');
    expect(fixture.nativeElement.querySelector('[data-testid="journey-detail"]')?.textContent)
      .toContain('Canonical operational next action.');
  });

  it('hides stale Journey data while a refresh is loading or has failed', async () => {
    const initialRequest = new Subject<PortfolioPage>();
    const refreshRequest = new Subject<PortfolioPage>();
    const portfolioApi = {
      portfolio: vi.fn()
        .mockReturnValueOnce(initialRequest)
        .mockReturnValueOnce(refreshRequest),
    };

    await TestBed.configureTestingModule({
      imports: [ProjectListPage],
      providers: [
        provideRouter([]),
        { provide: DecisionPortfolioApiService, useValue: portfolioApi },
        { provide: AuthApiService, useValue: { currentUser: signal({ id: 'user-1', email: 'po@example.test' }) } },
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
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="projects-loading"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="journey-field"]')).toBeNull();

    initialRequest.next(emptyPortfolio());
    initialRequest.complete();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="journey-field"]')).not.toBeNull();

    fixture.componentInstance.loadProjects();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[data-testid="projects-loading"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="journey-field"]')).toBeNull();

    refreshRequest.error(new Error('Portfolio refresh failed'));
    fixture.detectChanges();

    expect(fixture.componentInstance.portfolio()).toEqual(emptyPortfolio());
    expect(fixture.nativeElement.querySelector('[data-testid="projects-error"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="journey-field"]')).toBeNull();
  });
});

function emptyPortfolio(): PortfolioPage {
  return { items: [], totalCount: 0, page: 1, pageSize: 20, pageCount: 0 };
}
