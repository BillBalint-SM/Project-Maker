import { convertToParamMap, provideRouter, ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ProjectWorkState, ProjectWorkspace } from '@project-maker/contracts';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ProjectApiService } from './project-api.service';
import { ProjectContextState } from './project-context/project-context.state';
import { ProjectStatusPage } from './project-status.page';

const projectId = '11111111-1111-4111-8111-111111111111';

describe('ProjectStatusPage', () => {
  it('uses the shared canonical work state for coordination without loading it again', async () => {
    const workState: ProjectWorkState = {
      projectId,
      projectName: 'Ügyfélválaszos projekt',
      urgency: 'CUSTOMER_REPLY',
      urgencyLabel: 'Új ügyfélválasz',
      preparationStatus: {
        projectId,
        state: 'INTAKE_IN_PROGRESS',
        label: 'Felmérés folyamatban',
        primaryAction: { target: 'INTERVIEW', label: 'Felmérés megnyitása' },
      },
      nextAction: 'Dolgozd fel az ügyfél pontosítását.',
      nextActionOwner: { role: 'INTERNAL_OWNER', displayName: 'PO Péter', complete: true },
      dueAt: '2026-08-20T12:00:00.000Z',
      newReplyCount: 2,
      progress: { kind: 'INTERVIEW_ANSWERS', answeredQuestions: 4, totalQuestions: 9 },
      primaryAction: {
        target: 'CUSTOMER_CORRESPONDENCE',
        label: 'Ügyféllevelezés megnyitása',
      },
    };
    const project: ProjectWorkspace = {
      id: projectId,
      name: workState.projectName,
      customerContactName: 'Ügyfél Anna',
      customerContactEmail: 'anna@example.test',
      status: 'DRAFT',
      internalOwnerName: 'PO Péter',
      nextActionOwnerRole: 'INTERNAL_OWNER',
      nextActionOwner: workState.nextActionOwner,
      nextAction: workState.nextAction,
      dueAt: workState.dueAt,
      createdAt: '2026-08-18T08:00:00.000Z',
      updatedAt: '2026-08-19T08:00:00.000Z',
    };
    const api = {
      loadWorkState: vi.fn(),
      loadPreparationStatus: vi.fn(),
      loadProjectWorkspace: vi.fn().mockReturnValue(of(project)),
      loadProjectActivity: vi.fn().mockReturnValue(of({ projectId, events: [] })),
    };
    const context = projectContextWith(workState);
    await TestBed.configureTestingModule({
      imports: [ProjectStatusPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ projectId }) } },
        },
        { provide: ProjectApiService, useValue: api },
        { provide: ProjectContextState, useValue: context },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProjectStatusPage);
    await fixture.whenStable();

    const coordination = fixture.nativeElement.querySelector(
      '[data-testid="project-status-coordination"]',
    ) as HTMLElement | null;
    expect(api.loadWorkState).not.toHaveBeenCalled();
    expect(api.loadPreparationStatus).not.toHaveBeenCalled();
    expect(coordination?.textContent).toContain('PO Péter');
    expect(coordination?.textContent).toContain('Dolgozd fel az ügyfél pontosítását.');
    expect(fixture.nativeElement.querySelector('[data-testid="project-status-card"]')).toBeNull();
  });

  it('keeps canonical coordination visible when customer metadata cannot be loaded', async () => {
    const workState: ProjectWorkState = {
      projectId,
      projectName: 'Koordinálandó projekt',
      urgency: 'OVERDUE',
      urgencyLabel: 'Lejárt a következő lépés',
      preparationStatus: {
        projectId,
        state: 'INTAKE_IN_PROGRESS',
        label: 'Felmérés folyamatban',
        primaryAction: { target: 'INTERVIEW', label: 'Felmérés megnyitása' },
      },
      nextAction: 'Egyeztesd az átadási időpontot.',
      nextActionOwner: { role: 'INTERNAL_OWNER', displayName: 'PO Péter', complete: true },
      dueAt: '2026-08-18T12:00:00.000Z',
      newReplyCount: 0,
      primaryAction: {
        target: 'PROJECT_COORDINATION',
        label: 'Következő lépés kezelése',
      },
    };
    const api = {
      loadProjectWorkspace: vi.fn().mockReturnValue(
        throwError(() => new Error('Az ügyféladatok átmenetileg nem érhetők el.')),
      ),
      loadProjectActivity: vi.fn().mockReturnValue(of({ projectId, events: [] })),
    };
    await TestBed.configureTestingModule({
      imports: [ProjectStatusPage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ projectId }) } },
        },
        { provide: ProjectApiService, useValue: api },
        { provide: ProjectContextState, useValue: projectContextWith(workState) },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProjectStatusPage);
    await fixture.whenStable();

    const coordination = fixture.nativeElement.querySelector(
      '[data-testid="project-status-coordination"]',
    ) as HTMLElement | null;
    const customerCommunication = fixture.nativeElement.querySelector(
      '[data-testid="project-status-customer-communication"]',
    ) as HTMLElement | null;
    expect(coordination?.textContent).toContain('PO Péter');
    expect(coordination?.textContent).toContain('Egyeztesd az átadási időpontot.');
    expect(customerCommunication?.textContent).toContain(
      'Az ügyféladatok átmenetileg nem érhetők el.',
    );
  });
});

function projectContextWith(workState: ProjectWorkState) {
  return {
    workState: signal<ProjectWorkState | null>(workState),
    loading: signal(false),
    loadError: signal<string | null>(null),
    reload: vi.fn(),
  };
}
