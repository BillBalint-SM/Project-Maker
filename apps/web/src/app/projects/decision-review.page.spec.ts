import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import type { ProjectWorkspace } from '@project-maker/contracts';
import { Observable, of, Subject, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { DecisionPortfolioApiService } from './decision-portfolio-api.service';
import { DecisionReviewPage } from './decision-review.page';
import { ProjectApiService } from './project-api.service';

const projectId = '11111111-1111-4111-8111-111111111111';

describe('DecisionReviewPage', () => {
  it('fails closed while Project availability is unknown, then exposes the form only for an active Project', async () => {
    const workspace = new Subject<ProjectWorkspace>();
    const { fixture } = await createPage(workspace);

    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid="formal-decision-availability-loading"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="formal-decision-form"]')).toBeNull();

    workspace.next(projectFixture('DRAFT'));
    workspace.complete();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid="formal-decision-form"]')).not.toBeNull();
  });

  it('shows an accessible availability error with Retry and never posts while metadata fails', async () => {
    const { fixture, portfolio, projects } = await createPage(throwError(() => new Error('Metadata unavailable')));

    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid="formal-decision-availability-error"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="retry-formal-decision-availability"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="formal-decision-form"]')).toBeNull();
    fixture.componentInstance.saveDecision();
    expect(portfolio.createDecision).not.toHaveBeenCalled();
    (fixture.nativeElement.querySelector('[data-testid="retry-formal-decision-availability"] button') as HTMLButtonElement).click();
    await fixture.whenStable();
    expect(projects.loadProjectWorkspace).toHaveBeenCalledTimes(2);
  });

  it('resolves a failed availability retry to the archived explanation without exposing or posting the form', async () => {
    const { fixture, portfolio, projects } = await createPage(of(projectFixture('DRAFT')));
    projects.loadProjectWorkspace.mockReset()
      .mockReturnValueOnce(throwError(() => new Error('Metadata unavailable')))
      .mockReturnValueOnce(of(projectFixture('ARCHIVED')));

    fixture.detectChanges();
    await fixture.whenStable();
    (fixture.nativeElement.querySelector('[data-testid="retry-formal-decision-availability"] button') as HTMLButtonElement).click();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid="formal-decision-availability-archived"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="formal-decision-form"]')).toBeNull();
    fixture.componentInstance.saveDecision();
    expect(portfolio.createDecision).not.toHaveBeenCalled();
  });

  it('ignores an older retry result when a newer availability check confirms the Project is archived', async () => {
    const olderRetry = new Subject<ProjectWorkspace>();
    const newerRetry = new Subject<ProjectWorkspace>();
    const { fixture, portfolio, projects } = await createPage(of(projectFixture('DRAFT')));
    projects.loadProjectWorkspace.mockReset()
      .mockReturnValueOnce(throwError(() => new Error('Metadata unavailable')))
      .mockReturnValueOnce(olderRetry)
      .mockReturnValueOnce(newerRetry);

    fixture.detectChanges();
    await fixture.whenStable();
    const retry = fixture.nativeElement.querySelector(
      '[data-testid="retry-formal-decision-availability"] button',
    ) as HTMLButtonElement;
    retry.click();
    retry.click();
    newerRetry.next(projectFixture('ARCHIVED'));
    olderRetry.next(projectFixture('DRAFT'));
    await fixture.whenStable();

    expect(projects.loadProjectWorkspace).toHaveBeenCalledTimes(3);
    expect(fixture.nativeElement.querySelector('[data-testid="formal-decision-availability-archived"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="formal-decision-form"]')).toBeNull();
    fixture.componentInstance.saveDecision();
    expect(portfolio.createDecision).not.toHaveBeenCalled();
  });

  it('keeps the formal decision form unavailable for an archived Project', async () => {
    const { fixture, portfolio } = await createPage(of(projectFixture('ARCHIVED')));

    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('[data-testid="formal-decision-availability-archived"]')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('[data-testid="formal-decision-form"]')).toBeNull();
    fixture.componentInstance.saveDecision();
    expect(portfolio.createDecision).not.toHaveBeenCalled();
  });

  it('records one formal decision after active Project availability is proven', async () => {
    const { fixture, portfolio } = await createPage(of(projectFixture('DRAFT')));

    fixture.detectChanges();
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    setInputValue(root.querySelector('#formal-decision-maker') as HTMLInputElement, 'Decision owner');
    setInputValue(root.querySelector('#formal-decision-rationale') as HTMLTextAreaElement, 'The evidence supports proceeding.');
    fixture.detectChanges();
    await fixture.whenStable();
    (root.querySelector('[data-testid="formal-decision-form"]') as HTMLFormElement)
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(portfolio.createDecision).toHaveBeenCalledTimes(1);
    expect(portfolio.createDecision).toHaveBeenCalledWith(projectId, expect.objectContaining({
      outcome: 'GO',
      decisionMaker: 'Decision owner',
      rationale: 'The evidence supports proceeding.',
    }));
  });
});

async function createPage(workspace: Observable<ProjectWorkspace>) {
  const portfolio = { decisions: vi.fn(() => of([])), createDecision: vi.fn(() => of({})) };
  const projects = { loadProjectWorkspace: vi.fn(() => workspace) };
  await TestBed.configureTestingModule({
    imports: [DecisionReviewPage],
    providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ projectId }) } } },
      { provide: DecisionPortfolioApiService, useValue: portfolio },
      { provide: ProjectApiService, useValue: projects },
    ],
  }).compileComponents();
  return { fixture: TestBed.createComponent(DecisionReviewPage), portfolio, projects };
}

function projectFixture(status: ProjectWorkspace['status']): ProjectWorkspace {
  return {
    id: projectId,
    name: 'Decision Project',
    customerContactName: 'Customer Anna',
    customerContactEmail: 'anna@example.test',
    status,
    internalOwnerName: 'PO Peter',
    nextActionOwnerRole: 'INTERNAL_OWNER',
    nextActionOwner: { role: 'INTERNAL_OWNER', displayName: 'PO Peter', complete: true },
    nextAction: 'Review the decision.',
    dueAt: null,
    playbook: { id: 'general', version: 1, name: 'General project' },
    initiativeId: null,
    createdAt: '2026-08-18T08:00:00.000Z',
    updatedAt: '2026-08-19T08:00:00.000Z',
  };
}

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
