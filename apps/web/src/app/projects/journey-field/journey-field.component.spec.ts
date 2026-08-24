import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { PortfolioRow } from '@project-maker/contracts';
import { describe, expect, it } from 'vitest';

import { JourneyFieldComponent } from './journey-field.component';

describe('JourneyFieldComponent', () => {
  it('places projects by canonical preparation state and reveals their canonical next action', async () => {
    await TestBed.configureTestingModule({
      imports: [JourneyFieldComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    const fixture = TestBed.createComponent(JourneyFieldComponent);
    fixture.componentRef.setInput('entries', [journeyEntry]);
    fixture.componentRef.setInput('page', 1);
    fixture.componentRef.setInput('pageCount', 2);
    fixture.componentRef.setInput('totalCount', 21);
    fixture.componentRef.setInput('search', 'Alpha owner');
    await fixture.whenStable();

    const element = fixture.nativeElement as HTMLElement;
    expect(element.querySelector('[data-state="INTAKE_IN_PROGRESS"]')?.textContent)
      .toContain('Journey Alpha');
    expect(element.querySelector('[data-testid="journey-detail"]')?.textContent)
      .toContain('Confirm Customer context');
    expect(element.textContent).toContain('21 across the current filter');
    const action = element.querySelector('.journey-detail__action') as HTMLAnchorElement | null;
    expect(action?.getAttribute('href')).toBe(
      '/projects/11111111-1111-4111-8111-111111111111/interview?returnTo=%2F',
    );
    expect(
      (element.querySelector(
        '[aria-label="Open Initial Intake in progress projects in Queue"]',
      ) as HTMLAnchorElement | null)?.getAttribute('href'),
    ).toBe('/projects/active?q=Alpha%20owner&preparation=INTAKE_IN_PROGRESS');
  });
});

const journeyEntry: PortfolioRow = {
  project: {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Journey Alpha',
    customerContactName: 'Customer contact',
    customerContactEmail: 'customer@example.test',
    status: 'DRAFT',
    internalOwnerName: 'Project owner',
    nextActionOwnerRole: 'INTERNAL_OWNER',
    nextActionOwner: { role: 'INTERNAL_OWNER', displayName: 'Project owner', complete: true },
    nextAction: 'Confirm Customer context',
    dueAt: '2026-08-27T08:00:00.000Z',
    playbook: { id: 'general', version: 1, name: 'General project' },
    initiativeId: null,
    createdAt: '2026-08-20T08:00:00.000Z',
    updatedAt: '2026-08-24T08:00:00.000Z',
  },
  workState: {
    projectId: '11111111-1111-4111-8111-111111111111',
    projectName: 'Journey Alpha',
    urgency: 'IN_PROGRESS',
    urgencyLabel: 'In progress',
    preparationStatus: {
      projectId: '11111111-1111-4111-8111-111111111111',
      state: 'INTAKE_IN_PROGRESS',
      label: 'Initial Intake in progress',
      primaryAction: { target: 'INTERVIEW', label: 'Open Initial Intake' },
    },
    nextAction: 'Confirm Customer context',
    nextActionOwner: { role: 'INTERNAL_OWNER', displayName: 'Project owner', complete: true },
    dueAt: '2026-08-27T08:00:00.000Z',
    newReplyCount: 0,
    progress: { kind: 'INTERVIEW_ANSWERS', answeredQuestions: 3, totalQuestions: 7 },
    primaryAction: { target: 'INTERVIEW', label: 'Open Initial Intake' },
  },
  readinessPercentage: null,
  decisionScore: null,
  latestDecision: null,
  latestStatus: null,
  goal: null,
  initiative: null,
};
