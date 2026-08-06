import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import type {
  BaseQuestionBank,
  InterviewRound,
  ProjectQuestionSchema,
} from '@project-maker/contracts';

import { appConfig } from '../app.config';
import { QuestionBankApiService } from '../settings/question-bank-api.service';
import { InterviewApiService } from './interview-api.service';
import { InterviewPage } from './interview.page';

describe('InterviewPage', () => {
  it('resumes the active initial intake round and disables schema editing', async () => {
    const questionBankApi = {
      loadBaseQuestionBank: vi.fn().mockReturnValue(of(buildBank())),
      loadProjectSchema: vi.fn().mockReturnValue(of(buildSchema())),
      createProjectSchema: vi.fn(),
      updateProjectSchema: vi.fn(),
    };
    const interviewApi = {
      getActiveInitialIntake: vi.fn().mockReturnValue(of(buildOpenRound())),
      createRound: vi.fn(),
      updateAnswer: vi.fn(),
      completeRound: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [InterviewPage],
      providers: [
        ...appConfig.providers,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ projectId: 'project-123' }),
            },
          },
        },
        { provide: QuestionBankApiService, useValue: questionBankApi },
        { provide: InterviewApiService, useValue: interviewApi },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(InterviewPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const nativeElement = fixture.nativeElement as HTMLElement;
    const answerInput = nativeElement.querySelector(
      '[data-testid="round-answer-input-snapshot-1"]',
    ) as HTMLInputElement | null;
    const schemaCheckbox = nativeElement.querySelector(
      '[data-testid="schema-question-company-goal"] input',
    ) as HTMLInputElement | null;

    expect(interviewApi.getActiveInitialIntake).toHaveBeenCalledWith('project-123');
    expect(
      nativeElement.querySelector('[data-testid="active-round-resume-state"]'),
    ).not.toBeNull();
    expect(
      nativeElement.querySelector('[data-testid="create-interview-round-button"]'),
    ).toBeNull();
    expect(
      nativeElement.querySelector('[data-testid="round-type-select"]'),
    ).toBeNull();
    expect(answerInput?.value).toBe('Meglévő válasz');
    expect(schemaCheckbox?.disabled).toBe(true);
  });

  it('shows the start action without a round-type selector when no active round exists', async () => {
    const questionBankApi = {
      loadBaseQuestionBank: vi.fn().mockReturnValue(of(buildBank())),
      loadProjectSchema: vi.fn().mockReturnValue(of(buildSchema())),
      createProjectSchema: vi.fn(),
      updateProjectSchema: vi.fn(),
    };
    const interviewApi = {
      getActiveInitialIntake: vi.fn().mockReturnValue(of(null)),
      createRound: vi.fn(),
      updateAnswer: vi.fn(),
      completeRound: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [InterviewPage],
      providers: [
        ...appConfig.providers,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ projectId: 'project-456' }),
            },
          },
        },
        { provide: QuestionBankApiService, useValue: questionBankApi },
        { provide: InterviewApiService, useValue: interviewApi },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(InterviewPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const nativeElement = fixture.nativeElement as HTMLElement;

    expect(
      nativeElement.querySelector('[data-testid="create-interview-round-button"]'),
    ).not.toBeNull();
    expect(
      nativeElement.querySelector('[data-testid="round-type-select"]'),
    ).toBeNull();
  });

  it('fails into a Hungarian page-level error state for an unsupported active round type', async () => {
    const questionBankApi = {
      loadBaseQuestionBank: vi.fn().mockReturnValue(of(buildBank())),
      loadProjectSchema: vi.fn().mockReturnValue(of(buildSchema())),
      createProjectSchema: vi.fn(),
      updateProjectSchema: vi.fn(),
    };
    const interviewApi = {
      getActiveInitialIntake: vi.fn().mockReturnValue(of(buildUnsupportedRound())),
      createRound: vi.fn(),
      updateAnswer: vi.fn(),
      completeRound: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [InterviewPage],
      providers: [
        ...appConfig.providers,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ projectId: 'project-789' }),
            },
          },
        },
        { provide: QuestionBankApiService, useValue: questionBankApi },
        { provide: InterviewApiService, useValue: interviewApi },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(InterviewPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const nativeElement = fixture.nativeElement as HTMLElement;
    const loadError = nativeElement.querySelector(
      '[data-testid="interview-load-error-text"]',
    ) as HTMLElement | null;

    expect(
      loadError?.textContent?.trim(),
    ).toBe(
      'Nem támogatott aktív interjúkör érkezett a szervertől. Frissítsd az oldalt, és ha a hiba megmarad, ellenőrizd a projekt interjúállapotát.',
    );
    expect(
      nativeElement.querySelector('[data-testid="active-round-resume-state"]'),
    ).toBeNull();
  });

  it('preserves the specific Hungarian service error during initial load', async () => {
    const userMessage =
      'Nem sikerült betölteni az aktív kezdő interjúkört (HTTP 404). Ellenőrizd, hogy a projekt, az interjúkör vagy a kérdés még létezik-e.';
    const questionBankApi = {
      loadBaseQuestionBank: vi.fn().mockReturnValue(of(buildBank())),
      loadProjectSchema: vi.fn().mockReturnValue(of(buildSchema())),
      createProjectSchema: vi.fn(),
      updateProjectSchema: vi.fn(),
    };
    const interviewApi = {
      getActiveInitialIntake: vi.fn().mockReturnValue(
        throwError(
          () =>
            Object.assign(new Error(userMessage), {
              brand: 'INTERVIEW_API_ERROR' as const,
            }),
        ),
      ),
      createRound: vi.fn(),
      updateAnswer: vi.fn(),
      completeRound: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [InterviewPage],
      providers: [
        ...appConfig.providers,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ projectId: 'project-999' }),
            },
          },
        },
        { provide: QuestionBankApiService, useValue: questionBankApi },
        { provide: InterviewApiService, useValue: interviewApi },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(InterviewPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const nativeElement = fixture.nativeElement as HTMLElement;
    const loadError = nativeElement.querySelector(
      '[data-testid="interview-load-error-text"]',
    ) as HTMLElement | null;

    expect(loadError?.textContent?.trim()).toBe(userMessage);
  });

  it('falls back to the generic Hungarian load error for an unknown internal error message', async () => {
    const questionBankApi = {
      loadBaseQuestionBank: vi.fn().mockReturnValue(of(buildBank())),
      loadProjectSchema: vi.fn().mockReturnValue(of(buildSchema())),
      createProjectSchema: vi.fn(),
      updateProjectSchema: vi.fn(),
    };
    const interviewApi = {
      getActiveInitialIntake: vi.fn().mockReturnValue(
        throwError(
          () =>
            new Error(
              'Nem sikerült lekérni az interjúkört. PostgreSQL relation interview_rounds does not exist at SELECT * FROM interview_rounds.',
            ),
        ),
      ),
      createRound: vi.fn(),
      updateAnswer: vi.fn(),
      completeRound: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [InterviewPage],
      providers: [
        ...appConfig.providers,
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ projectId: 'project-1001' }),
            },
          },
        },
        { provide: QuestionBankApiService, useValue: questionBankApi },
        { provide: InterviewApiService, useValue: interviewApi },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(InterviewPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const nativeElement = fixture.nativeElement as HTMLElement;
    const loadError = nativeElement.querySelector(
      '[data-testid="interview-load-error-text"]',
    ) as HTMLElement | null;

    expect(loadError?.textContent?.trim()).toBe(
      'Nem sikerült betölteni az interjú adatait. Frissítsd az oldalt, majd próbáld újra.',
    );
  });
});

function buildBank(): BaseQuestionBank {
  return {
    version: 3,
    questions: [
      {
        id: 'base-question-1',
        stableKey: 'company-goal',
        bankVersion: 3,
        topic: 'Cél',
        controlPoint: 'Üzleti cél',
        text: 'Mi a projekt célja?',
        type: 'TEXT',
        required: true,
        requiredForEstimate: true,
        blocking: true,
        order: 1,
        active: true,
        hint: null,
        options: null,
        source: 'CANONICAL_SEED',
        publishedAt: '2026-08-06T10:00:00.000Z',
      },
    ],
  };
}

function buildSchema(): ProjectQuestionSchema {
  return {
    id: 'schema-1',
    projectId: 'project-123',
    schemaVersion: 2,
    bankVersion: 3,
    publishedAt: '2026-08-06T10:05:00.000Z',
    questions: [
      {
        id: 'schema-question-1',
        baseQuestionId: 'base-question-1',
        stableKey: 'company-goal',
        topic: 'Cél',
        controlPoint: 'Üzleti cél',
        text: 'Mi a projekt célja?',
        type: 'TEXT',
        required: true,
        blocking: true,
        order: 1,
        hint: null,
        options: null,
      },
    ],
  };
}

function buildOpenRound(): InterviewRound {
  return {
    id: 'round-1',
    projectId: 'project-123',
    projectSchemaId: 'schema-1',
    schemaVersion: 2,
    type: 'INITIAL_INTAKE',
    status: 'OPEN',
    createdAt: '2026-08-06T10:10:00.000Z',
    completedAt: null,
    questions: [
      {
        id: 'snapshot-1',
        baseQuestionId: 'base-question-1',
        stableKey: 'company-goal',
        topic: 'Cél',
        controlPoint: 'Üzleti cél',
        text: 'Mi a projekt célja?',
        type: 'TEXT',
        required: true,
        blocking: true,
        order: 1,
        hint: null,
        options: null,
        answer: 'Meglévő válasz',
        answeredAt: '2026-08-06T10:12:00.000Z',
      },
    ],
  };
}

function buildUnsupportedRound(): InterviewRound {
  return {
    ...buildOpenRound(),
    id: 'round-unsupported',
    type: 'STAKEHOLDER',
  };
}
