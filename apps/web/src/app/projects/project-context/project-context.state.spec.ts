import { TestBed } from '@angular/core/testing';
import type { ProjectWorkState } from '@project-maker/contracts';
import { of, Subject } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { ProjectApiService } from '../project-api.service';
import { ProjectContextState } from './project-context.state';

const projectId = '11111111-1111-4111-8111-111111111111';

describe('ProjectContextState', () => {
  it('preserves the newest same-Project refresh when requests complete out of order', () => {
    const older = new Subject<ProjectWorkState>();
    const newer = new Subject<ProjectWorkState>();
    const api = {
      loadWorkState: vi
        .fn()
        .mockReturnValueOnce(older)
        .mockReturnValueOnce(newer),
    };
    TestBed.configureTestingModule({
      providers: [
        ProjectContextState,
        { provide: ProjectApiService, useValue: api },
      ],
    });
    const state = TestBed.inject(ProjectContextState);

    state.load(projectId);
    state.reload();
    newer.next(workState('Új állapot'));
    older.next(workState('Régi állapot'));

    expect(state.workState()?.urgencyLabel).toBe('Új állapot');
    expect(state.loading()).toBe(false);
  });

  it('keeps the rendered Project identity while a context refresh is pending', () => {
    const refresh = new Subject<ProjectWorkState>();
    const initial = workState('Első állapot');
    const api = {
      loadWorkState: vi
        .fn()
        .mockReturnValueOnce(of(initial))
        .mockReturnValueOnce(refresh),
    };
    TestBed.configureTestingModule({
      providers: [
        ProjectContextState,
        { provide: ProjectApiService, useValue: api },
      ],
    });
    const state = TestBed.inject(ProjectContextState);

    state.load(projectId);
    state.reload();

    expect(state.workState()).toEqual(initial);
    expect(state.loading()).toBe(true);
  });
});

function workState(urgencyLabel: string): ProjectWorkState {
  return {
    projectId,
    projectName: 'Alfa átállás',
    urgency: 'IN_PROGRESS',
    urgencyLabel,
    preparationStatus: {
      projectId,
      state: 'INTAKE_IN_PROGRESS',
      label: 'Felmérés folyamatban',
      primaryAction: { target: 'INTERVIEW', label: 'Felmérés megnyitása' },
    },
    nextAction: 'Folytasd a felmérést.',
    nextActionOwner: {
      role: 'INTERNAL_OWNER',
      displayName: 'Kovács Anna',
      complete: true,
    },
    dueAt: null,
    newReplyCount: 0,
    primaryAction: { target: 'INTERVIEW', label: 'Felmérés megnyitása' },
  };
}
