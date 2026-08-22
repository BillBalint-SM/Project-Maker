import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withRouterConfig } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { ProjectWorkState } from '@project-maker/contracts';

import { ProjectApiService } from '../project-api.service';
import { ProjectContextPage } from './project-context.page';

const projectId = '11111111-1111-4111-8111-111111111111';
const queueUrl =
  '/projects/active?q=Alfa&urgency=OVERDUE&preparation=INTAKE_IN_PROGRESS&cursor=opaque-page-2';

const workState: ProjectWorkState = {
  projectId,
  projectName: 'Alfa átállás',
  urgency: 'OVERDUE',
  urgencyLabel: 'Lejárt a következő lépés',
  preparationStatus: {
    projectId,
    state: 'INTAKE_IN_PROGRESS',
    label: 'Felmérés folyamatban',
    primaryAction: { target: 'INTERVIEW', label: 'Felmérés megnyitása' },
  },
  nextAction: 'Egyeztesd a következő workshopot.',
  nextActionOwner: {
    role: 'INTERNAL_OWNER',
    displayName: 'Kovács Anna',
    complete: true,
  },
  dueAt: '2026-08-20T12:00:00.000Z',
  newReplyCount: 0,
  primaryAction: { target: 'INTERVIEW', label: 'Felmérés megnyitása' },
};

@Component({ template: '<p data-testid="project-panel">Project Status panel</p>' })
class StatusPanel {}

@Component({ template: '<p data-testid="interview-panel">Felmérés panel</p>' })
class InterviewPanel {}

@Component({ template: '<p role="alert">A panel nem tölthető be.</p>' })
class ErrorPanel {}

describe('ProjectContextPage', () => {
  it('preserves a validated Active queue origin across shared navigation and the primary task', async () => {
    const api = { loadWorkState: vi.fn().mockReturnValue(of(workState)) };
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            {
              path: 'projects/:projectId',
              component: ProjectContextPage,
              children: [{ path: 'status', component: StatusPanel }],
            },
          ],
          withRouterConfig({ paramsInheritanceStrategy: 'always' }),
        ),
        { provide: ProjectApiService, useValue: api },
      ],
    }).compileComponents();

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl(
      `/projects/${projectId}/status?returnTo=${encodeURIComponent(queueUrl)}`,
    );
    await harness.fixture.whenStable();

    const root = harness.fixture.nativeElement as HTMLElement;
    const backLink = root.querySelector(
      '[data-testid="project-context-return"]',
    ) as HTMLAnchorElement | null;
    const primaryAction = root.querySelector(
      '[data-testid="project-context-primary-action"]',
    ) as HTMLAnchorElement | null;
    const statusLink = root.querySelector(
      '[data-testid="project-context-nav-status"]',
    ) as HTMLAnchorElement | null;
    const interviewLink = root.querySelector(
      '[data-testid="project-context-nav-interview"]',
    ) as HTMLAnchorElement | null;

    expect(api.loadWorkState).toHaveBeenCalledWith(projectId);
    expect(root.textContent).toContain('Alfa átállás');
    expect(root.textContent).toContain('Felmérés folyamatban');
    expect(backLink?.getAttribute('href')).toBe(queueUrl);
    expect(backLink?.textContent).toContain('Back to Active Project Queue');
    expect(statusLink?.getAttribute('aria-current')).toBe('page');
    expect(interviewLink?.getAttribute('aria-current')).toBeNull();
    expect(projectReturnTarget(primaryAction)).toBe(queueUrl);
    expect(projectReturnTarget(interviewLink)).toBe(queueUrl);
    expect(root.querySelector('[data-testid="project-panel"]')).not.toBeNull();
  });

  it.each([
    ['missing', null],
    ['malformed', '/projects/active?q=%'],
    ['external', 'https://example.test/projects/active?q=Alfa'],
    ['unsupported queue filter', '/projects/active?urgency=NOT_A_REAL_URGENCY'],
  ])('defaults a %s return target safely to the Portfolio', async (_case, returnTo) => {
    const api = { loadWorkState: vi.fn().mockReturnValue(of(workState)) };
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            {
              path: 'projects/:projectId',
              component: ProjectContextPage,
              children: [{ path: 'status', component: StatusPanel }],
            },
          ],
          withRouterConfig({ paramsInheritanceStrategy: 'always' }),
        ),
        { provide: ProjectApiService, useValue: api },
      ],
    }).compileComponents();
    const harness = await RouterTestingHarness.create();
    const query = returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : '';

    await harness.navigateByUrl(`/projects/${projectId}/status${query}`);
    await harness.fixture.whenStable();

    const root = harness.fixture.nativeElement as HTMLElement;
    const backLink = root.querySelector(
      '[data-testid="project-context-return"]',
    ) as HTMLAnchorElement | null;
    const interviewLink = root.querySelector(
      '[data-testid="project-context-nav-interview"]',
    ) as HTMLAnchorElement | null;
    expect(backLink?.getAttribute('href')).toBe('/');
    expect(backLink?.textContent).toContain('Back to Portfolio Overview');
    expect(projectReturnTarget(interviewLink)).toBe('/');
  });

  it('refreshes the canonical header after switching Project task contexts', async () => {
    const refreshedWorkState: ProjectWorkState = {
      ...workState,
      urgency: 'IN_PROGRESS',
      urgencyLabel: 'Folyamatban',
      preparationStatus: {
        ...workState.preparationStatus,
        state: 'DECISION_REVIEW_REQUIRED',
        label: 'Döntési értékelés szükséges',
        primaryAction: {
          target: 'DECISION_REVIEW',
          label: 'Döntési értékelés megnyitása',
        },
      },
      primaryAction: {
        target: 'DECISION_REVIEW',
        label: 'Döntési értékelés megnyitása',
      },
    };
    const api = {
      loadWorkState: vi
        .fn()
        .mockReturnValueOnce(of(workState))
        .mockReturnValueOnce(of(refreshedWorkState)),
    };
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            {
              path: 'projects/:projectId',
              component: ProjectContextPage,
              children: [
                { path: 'status', component: StatusPanel },
                { path: 'interview', component: InterviewPanel },
              ],
            },
          ],
          withRouterConfig({ paramsInheritanceStrategy: 'always' }),
        ),
        { provide: ProjectApiService, useValue: api },
      ],
    }).compileComponents();
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl(
      `/projects/${projectId}/status?returnTo=${encodeURIComponent(queueUrl)}`,
    );
    await harness.fixture.whenStable();
    await harness.navigateByUrl(
      `/projects/${projectId}/interview?returnTo=${encodeURIComponent(queueUrl)}`,
    );
    await harness.fixture.whenStable();

    const root = harness.fixture.nativeElement as HTMLElement;
    expect(api.loadWorkState).toHaveBeenCalledTimes(2);
    expect(root.textContent).toContain('Döntési értékelés szükséges');
    expect(root.querySelector('[data-testid="project-context-primary-action"]')?.textContent)
      .toContain('Döntési értékelés megnyitása');
    expect(
      (root.querySelector('[data-testid="project-context-return"]') as HTMLAnchorElement | null)
        ?.getAttribute('href'),
    ).toBe(queueUrl);
  });

  it('keeps the shared Project shell usable when the active page panel fails', async () => {
    const api = { loadWorkState: vi.fn().mockReturnValue(of(workState)) };
    await TestBed.configureTestingModule({
      providers: [
        provideRouter(
          [
            {
              path: 'projects/:projectId',
              component: ProjectContextPage,
              children: [{ path: 'status', component: ErrorPanel }],
            },
          ],
          withRouterConfig({ paramsInheritanceStrategy: 'always' }),
        ),
        { provide: ProjectApiService, useValue: api },
      ],
    }).compileComponents();
    const harness = await RouterTestingHarness.create();

    await harness.navigateByUrl(`/projects/${projectId}/status`);
    await harness.fixture.whenStable();

    const root = harness.fixture.nativeElement as HTMLElement;
    expect(root.querySelector('[data-testid="project-context-name"]')?.textContent).toContain(
      'Alfa átállás',
    );
    expect(root.querySelector('[role="alert"]')?.textContent).toContain(
      'A panel nem tölthető be.',
    );
    expect(root.querySelectorAll('[data-testid^="project-context-nav-"]')).toHaveLength(8);
  });
});

function projectReturnTarget(link: HTMLAnchorElement | null): string | null {
  const href = link?.getAttribute('href');
  return href ? new URL(href, 'https://project-maker.test').searchParams.get('returnTo') : null;
}
