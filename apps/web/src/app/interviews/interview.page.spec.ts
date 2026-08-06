import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { of, Subject, throwError } from 'rxjs';
import type {
  BaseQuestionBank,
  InterviewRound,
  ProjectQuestionSchema,
  RoundQuestionSnapshot,
} from '@project-maker/contracts';

import { appConfig } from '../app.config';
import { QuestionBankApiService } from '../settings/question-bank-api.service';
import { InterviewApiService, interviewApiErrorBrand } from './interview-api.service';
import { InterviewPage } from './interview.page';

describe('InterviewPage', () => {
  it('resumes the active initial intake round and disables schema editing', async () => {
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = createInterviewApi(buildOpenRound(buildTextQuestion({})), null);

    const page = await renderInterviewPage('project-123', questionBankApi, interviewApi);
    const answerInput = page.nativeElement.querySelector(
      '[data-testid="round-answer-input-snapshot-1"]',
    ) as HTMLInputElement | null;
    const schemaCheckbox = page.nativeElement.querySelector(
      '[data-testid="schema-question-company-goal"] input',
    ) as HTMLInputElement | null;

    expect(interviewApi.getActiveInitialIntake).toHaveBeenCalledWith('project-123');
    expect(
      page.nativeElement.querySelector('[data-testid="active-round-resume-state"]'),
    ).not.toBeNull();
    expect(
      page.nativeElement.querySelector('[data-testid="create-interview-round-button"]'),
    ).toBeNull();
    expect(
      page.nativeElement.querySelector('[data-testid="round-type-select"]'),
    ).toBeNull();
    expect(answerInput?.value).toBe('Meglévő válasz');
    expect(schemaCheckbox?.disabled).toBe(true);
  });

  it('autosaves text answers after exactly 750 ms and removes the normal manual save control', async () => {
    const savedQuestion = buildTextQuestion({
      answer: 'Friss válasz',
      answeredAt: '2026-08-06T10:20:00.000Z',
    });
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = createInterviewApi(
      buildOpenRound(buildTextQuestion({})),
      vi.fn().mockReturnValue(of(savedQuestion)),
    );

    const page = await renderInterviewPage('project-123', questionBankApi, interviewApi);
    const answerInput = page.nativeElement.querySelector(
      '[data-testid="round-answer-input-snapshot-1"]',
    ) as HTMLInputElement;

    setInputValue(answerInput, 'Friss válasz');
    page.fixture.detectChanges();

    await waitForDuration(700);
    expect(interviewApi.updateAnswer).not.toHaveBeenCalled();

    await waitForDuration(80);
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    expect(interviewApi.updateAnswer).toHaveBeenCalledTimes(1);
    expect(interviewApi.updateAnswer).toHaveBeenCalledWith(
      'project-123',
      'round-1',
      'snapshot-1',
      { value: 'Friss válasz' },
    );
    expect(
      page.nativeElement.querySelector('[data-testid="save-round-answer-snapshot-1"]'),
    ).toBeNull();
    expect(
      page.nativeElement.querySelector('[data-testid="retry-round-answer-snapshot-1"]'),
    ).toBeNull();
  });

  it('persists discrete boolean answers immediately', async () => {
    const question = buildBooleanQuestion({
      answer: null,
      answeredAt: null,
    });
    const savedQuestion = buildBooleanQuestion({
      answer: true,
      answeredAt: '2026-08-06T10:20:00.000Z',
    });
    const questionBankApi = createQuestionBankApi(buildBooleanBank(), buildBooleanSchema());
    const interviewApi = createInterviewApi(
      buildOpenRound(question),
      vi.fn().mockReturnValue(of(savedQuestion)),
    );

    const page = await renderInterviewPage('project-123', questionBankApi, interviewApi);
    const checkbox = page.nativeElement.querySelector(
      '[data-testid="round-answer-boolean-snapshot-boolean"]',
    ) as HTMLInputElement;

    checkbox.checked = true;
    checkbox.dispatchEvent(new Event('change'));
    page.fixture.detectChanges();
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    expect(interviewApi.updateAnswer).toHaveBeenCalledTimes(1);
    expect(interviewApi.updateAnswer).toHaveBeenCalledWith(
      'project-123',
      'round-1',
      'snapshot-boolean',
      { value: true },
    );
  });

  it('keeps the newer text draft visible when an older autosave settles and immediately persists the newer value', async () => {
    const firstSave = new Subject<RoundQuestionSnapshot>();
    const secondSave = new Subject<RoundQuestionSnapshot>();
    const updateAnswer = vi
      .fn()
      .mockReturnValueOnce(firstSave.asObservable())
      .mockReturnValueOnce(secondSave.asObservable());
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = createInterviewApi(buildOpenRound(buildTextQuestion({})), updateAnswer);

    const page = await renderInterviewPage('project-123', questionBankApi, interviewApi);
    const answerInput = page.nativeElement.querySelector(
      '[data-testid="round-answer-input-snapshot-1"]',
    ) as HTMLInputElement;

    setInputValue(answerInput, 'Első változat');
    await waitForDuration(800);
    page.fixture.detectChanges();

    expect(interviewApi.updateAnswer).toHaveBeenCalledTimes(1);
    expect(answerInput.disabled).toBe(false);

    setInputValue(answerInput, 'Újabb változat');
    page.fixture.detectChanges();

    firstSave.next(
      buildTextQuestion({
        answer: 'Első változat',
        answeredAt: '2026-08-06T10:21:00.000Z',
      }),
    );
    firstSave.complete();
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    expect(answerInput.value).toBe('Újabb változat');
    expect(interviewApi.updateAnswer).toHaveBeenCalledTimes(2);
    expect(interviewApi.updateAnswer).toHaveBeenNthCalledWith(
      2,
      'project-123',
      'round-1',
      'snapshot-1',
      { value: 'Újabb változat' },
    );

    secondSave.next(
      buildTextQuestion({
        answer: 'Újabb változat',
        answeredAt: '2026-08-06T10:22:00.000Z',
      }),
    );
    secondSave.complete();
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    const saveState = page.nativeElement.querySelector(
      '[data-testid="round-answer-save-state-snapshot-1"]',
    ) as HTMLElement | null;
    expect(saveState?.textContent?.trim()).toBe('Mentve');
    expect(answerInput.value).toBe('Újabb változat');
  });

  it('keeps the failed draft visible, shows a Hungarian retry action, and retries the same value', async () => {
    const userMessage =
      'Nem sikerült elmenteni a választ (HTTP 409). Frissítsd az oldalt, hogy a legfrissebb interjúállapotot lásd, majd próbáld újra.';
    const savedQuestion = buildTextQuestion({
      answer: 'Sikertelen mentés után is megmaradó válasz',
      answeredAt: '2026-08-06T10:24:00.000Z',
    });
    const updateAnswer = vi
      .fn()
      .mockReturnValueOnce(
        throwError(
          () =>
            Object.assign(new Error(userMessage), {
              brand: interviewApiErrorBrand,
            }),
        ),
      )
      .mockReturnValueOnce(of(savedQuestion));
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = createInterviewApi(buildOpenRound(buildTextQuestion({})), updateAnswer);

    const page = await renderInterviewPage('project-123', questionBankApi, interviewApi);
    const answerInput = page.nativeElement.querySelector(
      '[data-testid="round-answer-input-snapshot-1"]',
    ) as HTMLInputElement;

    setInputValue(answerInput, 'Sikertelen mentés után is megmaradó válasz');
    await waitForDuration(800);
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    const retryButton = page.nativeElement.querySelector(
      '[data-testid="retry-round-answer-snapshot-1"]',
    ) as HTMLButtonElement | null;
    const saveState = page.nativeElement.querySelector(
      '[data-testid="round-answer-save-state-snapshot-1"]',
    ) as HTMLElement | null;

    expect(answerInput.value).toBe('Sikertelen mentés után is megmaradó válasz');
    expect(retryButton).not.toBeNull();
    expect(saveState?.textContent).toContain('Nem sikerült menteni');
    expect(saveState?.textContent).toContain(userMessage);
    expect(
      page.nativeElement.querySelector('[data-testid="save-round-answer-snapshot-1"]'),
    ).toBeNull();

    const retryAction = retryButton?.querySelector('button');
    retryAction?.click();
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    expect(interviewApi.updateAnswer).toHaveBeenCalledTimes(2);
    expect(interviewApi.updateAnswer).toHaveBeenNthCalledWith(
      2,
      'project-123',
      'round-1',
      'snapshot-1',
      { value: 'Sikertelen mentés után is megmaradó válasz' },
    );
    expect(
      page.nativeElement.querySelector('[data-testid="retry-round-answer-snapshot-1"]'),
    ).toBeNull();
  });

  it('blocks completion while a failed autosave is still in error and keeps the retryable draft visible', async () => {
    const autosaveError =
      'Nem sikerült elmenteni a választ (HTTP 409). Frissítsd az oldalt, hogy a legfrissebb interjúállapotot lásd, majd próbáld újra.';
    const failedQuestion = buildOptionalTextQuestion({
      answer: null,
      answeredAt: null,
    });
    const updateAnswer = vi.fn().mockReturnValue(
      throwError(
        () =>
          Object.assign(new Error(autosaveError), {
            brand: interviewApiErrorBrand,
          }),
      ),
    );
    const completedRound = buildCompletedRound(failedQuestion);
    const completeRound = vi.fn().mockReturnValue(of(completedRound));
    const questionBankApi = createQuestionBankApi(buildOptionalTextBank(), buildOptionalTextSchema());
    const interviewApi = {
      ...createInterviewApi(buildOpenRound(failedQuestion), updateAnswer),
      completeRound,
    };

    const page = await renderInterviewPage('project-123', questionBankApi, interviewApi);
    const answerInput = page.nativeElement.querySelector(
      '[data-testid="round-answer-input-snapshot-optional"]',
    ) as HTMLInputElement;

    setInputValue(answerInput, 'Még nincs mentve, de fontos válasz');
    await waitForDuration(800);
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    const completeButtonHost = page.nativeElement.querySelector(
      '[data-testid="complete-interview-round-button"]',
    ) as HTMLElement | null;
    const completeButton = completeButtonHost?.querySelector('button') as HTMLButtonElement | null;
    const blockedMessage = page.nativeElement.querySelector(
      '[data-testid="complete-round-blocked-message"]',
    ) as HTMLElement | null;

    expect(answerInput.value).toBe('Még nincs mentve, de fontos válasz');
    expect(completeButton?.disabled).toBe(true);
    expect(blockedMessage?.textContent?.trim()).toBe(
      'Az interjúkör nem zárható le, amíg van sikertelen válaszmentés. Mentsd újra a hibás válaszokat, majd próbáld újra.',
    );

    page.fixture.componentInstance.completeRound();
    page.fixture.detectChanges();

    const actionError = page.nativeElement.querySelector(
      '[data-testid="interview-action-error-text"]',
    ) as HTMLElement | null;
    expect(completeRound).not.toHaveBeenCalled();
    expect(actionError?.textContent?.trim()).toBe(
      'Az interjúkör nem zárható le, amíg van sikertelen válaszmentés. Mentsd újra a hibás válaszokat, majd próbáld újra.',
    );
    expect(answerInput.value).toBe('Még nincs mentve, de fontos válasz');
    expect(
      page.nativeElement.querySelector('[data-testid="retry-round-answer-snapshot-optional"]'),
    ).not.toBeNull();
  });

  it('maps schema publish failures to safe Hungarian text without exposing the raw service message', async () => {
    const rawServiceMessage =
      'Could not update the project question schema (HTTP 409). PostgreSQL duplicate key value violates unique constraint.';
    const questionBankApi = createQuestionBankApi(null, null);
    questionBankApi.updateProjectSchema.mockReturnValue(
      throwError(() => new Error(rawServiceMessage)),
    );
    const interviewApi = createInterviewApi(null, null);

    const page = await renderInterviewPage('project-123', questionBankApi, interviewApi);
    const publishButtonHost = page.nativeElement.querySelector(
      '[data-testid="publish-project-schema-button"]',
    ) as HTMLElement | null;
    const publishButton = publishButtonHost?.querySelector('button') as HTMLButtonElement | null;

    publishButton?.click();
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    const actionError = page.nativeElement.querySelector(
      '[data-testid="interview-action-error-text"]',
    ) as HTMLElement | null;

    expect(questionBankApi.updateProjectSchema).toHaveBeenCalledTimes(1);
    expect(actionError?.textContent?.trim()).toBe(
      'Nem sikerült frissíteni a projektsémát. Frissítsd az oldalt, ellenőrizd a kiválasztott kérdéseket, majd próbáld újra.',
    );
    expect(actionError?.textContent).not.toContain('Could not');
    expect(actionError?.textContent).not.toContain('PostgreSQL');
  });

  it('renders deterministic Hungarian coaching from the round snapshot contract', async () => {
    const question = buildLongTextQuestion({
      hint: 'Írd le a jelenlegi helyzetet és a kívánt kimenetet.',
    });
    const questionBankApi = createQuestionBankApi(
      buildLongTextBank(question),
      buildLongTextSchema(question),
    );
    const interviewApi = createInterviewApi(buildOpenRound(question), null);

    const page = await renderInterviewPage('project-123', questionBankApi, interviewApi);
    const questionCard = page.nativeElement.querySelector(
      '[data-testid="round-question-snapshot-long-text"]',
    ) as HTMLElement | null;

    expect(questionCard?.textContent).toContain('Ellenőrzési pont: Üzleti cél');
    expect(questionCard?.textContent).toContain('Kötelező kérdés');
    expect(questionCard?.textContent).toContain('Blokkoló tisztázás');
    expect(questionCard?.textContent).toContain(
      'Írd le a jelenlegi helyzetet és a kívánt kimenetet.',
    );
    expect(questionCard?.textContent).toContain(
      'Részletes, többmondatos válasz ajánlott.',
    );
  });

  it('shows the start action without a round-type selector when no active round exists', async () => {
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = createInterviewApi(null, null);

    const page = await renderInterviewPage('project-456', questionBankApi, interviewApi);

    expect(
      page.nativeElement.querySelector('[data-testid="create-interview-round-button"]'),
    ).not.toBeNull();
    expect(
      page.nativeElement.querySelector('[data-testid="round-type-select"]'),
    ).toBeNull();
  });

  it('fails into a Hungarian page-level error state for an unsupported active round type', async () => {
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = createInterviewApi(buildUnsupportedRound(), null);

    const page = await renderInterviewPage('project-789', questionBankApi, interviewApi);
    const loadError = page.nativeElement.querySelector(
      '[data-testid="interview-load-error-text"]',
    ) as HTMLElement | null;

    expect(loadError?.textContent?.trim()).toBe(
      'Nem támogatott aktív interjúkör érkezett a szervertől. Frissítsd az oldalt, és ha a hiba megmarad, ellenőrizd a projekt interjúállapotát.',
    );
    expect(
      page.nativeElement.querySelector('[data-testid="active-round-resume-state"]'),
    ).toBeNull();
  });

  it('preserves the specific Hungarian service error during initial load', async () => {
    const userMessage =
      'Nem sikerült betölteni az aktív kezdő interjúkört (HTTP 404). Ellenőrizd, hogy a projekt, az interjúkör vagy a kérdés még létezik-e.';
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = {
      ...createInterviewApi(null, null),
      getActiveInitialIntake: vi.fn().mockReturnValue(
        throwError(
          () =>
            Object.assign(new Error(userMessage), {
              brand: interviewApiErrorBrand,
            }),
        ),
      ),
    };

    const page = await renderInterviewPage('project-999', questionBankApi, interviewApi);
    const loadError = page.nativeElement.querySelector(
      '[data-testid="interview-load-error-text"]',
    ) as HTMLElement | null;

    expect(loadError?.textContent?.trim()).toBe(userMessage);
  });

  it('falls back to the generic Hungarian load error for an unknown internal error message', async () => {
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = {
      ...createInterviewApi(null, null),
      getActiveInitialIntake: vi.fn().mockReturnValue(
        throwError(
          () =>
            new Error(
              'Nem sikerült lekérni az interjúkört. PostgreSQL relation interview_rounds does not exist at SELECT * FROM interview_rounds.',
            ),
        ),
      ),
    };

    const page = await renderInterviewPage('project-1001', questionBankApi, interviewApi);
    const loadError = page.nativeElement.querySelector(
      '[data-testid="interview-load-error-text"]',
    ) as HTMLElement | null;

    expect(loadError?.textContent?.trim()).toBe(
      'Nem sikerült betölteni az interjú adatait. Frissítsd az oldalt, majd próbáld újra.',
    );
  });
});

async function renderInterviewPage(
  projectId: string,
  questionBankApi: {
    readonly loadBaseQuestionBank: ReturnType<typeof vi.fn>;
    readonly loadProjectSchema: ReturnType<typeof vi.fn>;
    readonly createProjectSchema: ReturnType<typeof vi.fn>;
    readonly updateProjectSchema: ReturnType<typeof vi.fn>;
  },
  interviewApi: {
    readonly getActiveInitialIntake: ReturnType<typeof vi.fn>;
    readonly createRound: ReturnType<typeof vi.fn>;
    readonly updateAnswer: ReturnType<typeof vi.fn>;
    readonly completeRound: ReturnType<typeof vi.fn>;
  },
): Promise<{ readonly fixture: ComponentFixture<InterviewPage>; readonly nativeElement: HTMLElement }> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [InterviewPage],
    providers: [
      ...appConfig.providers,
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: convertToParamMap({ projectId }),
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

  return {
    fixture,
    nativeElement: fixture.nativeElement as HTMLElement,
  };
}

function createQuestionBankApi(
  bank: BaseQuestionBank | null,
  schema: ProjectQuestionSchema | null,
): {
  readonly loadBaseQuestionBank: ReturnType<typeof vi.fn>;
  readonly loadProjectSchema: ReturnType<typeof vi.fn>;
  readonly createProjectSchema: ReturnType<typeof vi.fn>;
  readonly updateProjectSchema: ReturnType<typeof vi.fn>;
} {
  const resolvedBank = bank ?? buildBank();
  const resolvedSchema = schema ?? buildSchema();
  return {
    loadBaseQuestionBank: vi.fn().mockReturnValue(of(resolvedBank)),
    loadProjectSchema: vi.fn().mockReturnValue(of(resolvedSchema)),
    createProjectSchema: vi.fn(),
    updateProjectSchema: vi.fn(),
  };
}

function createInterviewApi(
  activeRound: InterviewRound | null,
  updateAnswer: ReturnType<typeof vi.fn> | null,
): {
  readonly getActiveInitialIntake: ReturnType<typeof vi.fn>;
  readonly createRound: ReturnType<typeof vi.fn>;
  readonly updateAnswer: ReturnType<typeof vi.fn>;
  readonly completeRound: ReturnType<typeof vi.fn>;
} {
  return {
    getActiveInitialIntake: vi.fn().mockReturnValue(of(activeRound)),
    createRound: vi.fn(),
    updateAnswer: updateAnswer ?? vi.fn(),
    completeRound: vi.fn(),
  };
}

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function buildBank(): BaseQuestionBank {
  return {
    version: 3,
    questions: [buildBaseTextQuestion()],
  };
}

function buildSchema(): ProjectQuestionSchema {
  return {
    id: 'schema-1',
    projectId: 'project-123',
    schemaVersion: 2,
    bankVersion: 3,
    publishedAt: '2026-08-06T10:05:00.000Z',
    questions: [buildSchemaTextQuestion()],
  };
}

function buildOpenRound(question: RoundQuestionSnapshot): InterviewRound {
  return {
    id: 'round-1',
    projectId: 'project-123',
    projectSchemaId: 'schema-1',
    schemaVersion: 2,
    type: 'INITIAL_INTAKE',
    status: 'OPEN',
    createdAt: '2026-08-06T10:10:00.000Z',
    completedAt: null,
    questions: [question],
  };
}

function buildCompletedRound(question: RoundQuestionSnapshot): InterviewRound {
  return {
    ...buildOpenRound({
      ...question,
      answer: question.answer,
      answeredAt: question.answeredAt,
    }),
    status: 'COMPLETED',
    completedAt: '2026-08-06T10:30:00.000Z',
  };
}

function buildUnsupportedRound(): InterviewRound {
  return {
    ...buildOpenRound(buildTextQuestion({})),
    id: 'round-unsupported',
    type: 'STAKEHOLDER',
  };
}

function buildBaseTextQuestion(): BaseQuestionBank['questions'][number] {
  return {
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
  };
}

function buildSchemaTextQuestion(): ProjectQuestionSchema['questions'][number] {
  return {
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
  };
}

function buildTextQuestion(overrides: Partial<RoundQuestionSnapshot>): RoundQuestionSnapshot {
  return {
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
    ...overrides,
  };
}

async function waitForDuration(durationMs: number): Promise<void> {
  await new Promise((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

function buildBooleanQuestion(
  overrides: Partial<RoundQuestionSnapshot>,
): RoundQuestionSnapshot {
  return {
    id: 'snapshot-boolean',
    baseQuestionId: 'base-question-boolean',
    stableKey: 'needs-approval',
    topic: 'Döntés',
    controlPoint: 'Jóváhagyás',
    text: 'Szükséges vezetői jóváhagyás?',
    type: 'BOOLEAN',
    required: false,
    blocking: false,
    order: 1,
    hint: null,
    options: null,
    answer: false,
    answeredAt: '2026-08-06T10:12:00.000Z',
    ...overrides,
  };
}

function buildOptionalTextQuestion(
  overrides: Partial<RoundQuestionSnapshot>,
): RoundQuestionSnapshot {
  return {
    id: 'snapshot-optional',
    baseQuestionId: 'base-question-optional',
    stableKey: 'optional-detail',
    topic: 'Részlet',
    controlPoint: 'Kiegészítő információ',
    text: 'Van még fontos részlet?',
    type: 'TEXT',
    required: false,
    blocking: false,
    order: 1,
    hint: null,
    options: null,
    answer: null,
    answeredAt: null,
    ...overrides,
  };
}

function buildLongTextQuestion(
  overrides: Partial<RoundQuestionSnapshot>,
): RoundQuestionSnapshot {
  return {
    id: 'snapshot-long-text',
    baseQuestionId: 'base-question-long-text',
    stableKey: 'current-situation',
    topic: 'Cél',
    controlPoint: 'Üzleti cél',
    text: 'Mi a jelenlegi helyzet, és mit szeretnétek elérni?',
    type: 'LONG_TEXT',
    required: true,
    blocking: true,
    order: 1,
    hint: 'Írd le a jelenlegi helyzetet és a kívánt kimenetet.',
    options: null,
    answer: null,
    answeredAt: null,
    ...overrides,
  };
}

function buildBooleanBank(): BaseQuestionBank {
  return {
    version: 3,
    questions: [
      {
        ...buildBaseTextQuestion(),
        id: 'base-question-boolean',
        stableKey: 'needs-approval',
        topic: 'Döntés',
        controlPoint: 'Jóváhagyás',
        text: 'Szükséges vezetői jóváhagyás?',
        type: 'BOOLEAN',
        required: false,
        blocking: false,
      },
    ],
  };
}

function buildOptionalTextBank(): BaseQuestionBank {
  return {
    version: 3,
    questions: [
      {
        ...buildBaseTextQuestion(),
        id: 'base-question-optional',
        stableKey: 'optional-detail',
        topic: 'Részlet',
        controlPoint: 'Kiegészítő információ',
        text: 'Van még fontos részlet?',
        required: false,
        requiredForEstimate: false,
        blocking: false,
      },
    ],
  };
}

function buildBooleanSchema(): ProjectQuestionSchema {
  return {
    id: 'schema-boolean',
    projectId: 'project-123',
    schemaVersion: 2,
    bankVersion: 3,
    publishedAt: '2026-08-06T10:05:00.000Z',
    questions: [
      {
        id: 'schema-question-boolean',
        baseQuestionId: 'base-question-boolean',
        stableKey: 'needs-approval',
        topic: 'Döntés',
        controlPoint: 'Jóváhagyás',
        text: 'Szükséges vezetői jóváhagyás?',
        type: 'BOOLEAN',
        required: false,
        blocking: false,
        order: 1,
        hint: null,
        options: null,
      },
    ],
  };
}

function buildOptionalTextSchema(): ProjectQuestionSchema {
  return {
    id: 'schema-optional',
    projectId: 'project-123',
    schemaVersion: 2,
    bankVersion: 3,
    publishedAt: '2026-08-06T10:05:00.000Z',
    questions: [
      {
        id: 'schema-question-optional',
        baseQuestionId: 'base-question-optional',
        stableKey: 'optional-detail',
        topic: 'Részlet',
        controlPoint: 'Kiegészítő információ',
        text: 'Van még fontos részlet?',
        type: 'TEXT',
        required: false,
        blocking: false,
        order: 1,
        hint: null,
        options: null,
      },
    ],
  };
}

function buildLongTextBank(question: RoundQuestionSnapshot): BaseQuestionBank {
  return {
    version: 3,
    questions: [
      {
        ...buildBaseTextQuestion(),
        id: question.baseQuestionId,
        stableKey: question.stableKey,
        topic: question.topic,
        controlPoint: question.controlPoint,
        text: question.text,
        type: 'LONG_TEXT',
        required: true,
        blocking: true,
        hint: question.hint,
      },
    ],
  };
}

function buildLongTextSchema(question: RoundQuestionSnapshot): ProjectQuestionSchema {
  return {
    id: 'schema-long-text',
    projectId: 'project-123',
    schemaVersion: 2,
    bankVersion: 3,
    publishedAt: '2026-08-06T10:05:00.000Z',
    questions: [
      {
        id: 'schema-question-long-text',
        baseQuestionId: question.baseQuestionId,
        stableKey: question.stableKey,
        topic: question.topic,
        controlPoint: question.controlPoint,
        text: question.text,
        type: 'LONG_TEXT',
        required: true,
        blocking: true,
        order: 1,
        hint: question.hint,
        options: null,
      },
    ],
  };
}
