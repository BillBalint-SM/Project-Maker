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
import { ProjectApiService } from '../projects/project-api.service';
import { ProjectAttachmentsApiService } from '../projects/attachments/project-attachments-api.service';
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
      '[data-testid="schema-question-general-001"] input',
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

  it('loads the exact requested source round instead of the active round', async () => {
    const requestedRound = buildOpenRound(buildTextQuestion({}));
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = createInterviewApi(null, null);
    interviewApi.getRound.mockReturnValue(of(requestedRound));

    await renderInterviewPage('project-123', questionBankApi, interviewApi, 'round-1');

    expect(interviewApi.getRound).toHaveBeenCalledWith('project-123', 'round-1');
    expect(interviewApi.getActiveInitialIntake).not.toHaveBeenCalled();
  });

  it('renders server-projected missing and complete assessment status tags with stable fragment targets', async () => {
    const missingQuestion = buildOptionalTextQuestion({
      checklistStatus: 'Nincs meg',
    });
    const completeQuestion = buildTextQuestion({
      id: 'snapshot-complete',
      checklistStatus: 'Kész',
    });
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = createInterviewApi(
      buildOpenRoundWithQuestions([missingQuestion, completeQuestion]),
      null,
    );

    const page = await renderInterviewPage('project-123', questionBankApi, interviewApi);
    const missingArticle = page.nativeElement.querySelector(
      '[data-testid="round-question-snapshot-optional"]',
    ) as HTMLElement | null;
    const completeStatus = page.nativeElement.querySelector(
      '[data-testid="round-assessment-status-snapshot-complete"]',
    ) as HTMLElement | null;

    expect(missingArticle?.id).toBe('round-question-snapshot-optional');
    expect(
      page.nativeElement.querySelector('[data-testid="round-assessment-status-snapshot-optional"]')
        ?.textContent,
    ).toContain('Missing');
    expect(completeStatus?.textContent).toContain('Complete');
  });

  it('does not allow partial assessment before a persisted valid answer exists', async () => {
    const question = buildOptionalTextQuestion({
      answer: null,
      answeredAt: null,
      checklistStatus: 'Nincs meg',
    });
    const questionBankApi = createQuestionBankApi(buildOptionalTextBank(), buildOptionalTextSchema());
    const interviewApi = createInterviewApi(buildOpenRound(question), null);

    const page = await renderInterviewPage('project-123', questionBankApi, interviewApi);
    const partialButton = findButton(
      page.nativeElement,
      '[data-testid="set-partial-assessment-snapshot-optional"]',
    );

    expect(partialButton?.disabled).toBe(true);
    partialButton?.click();
    expect(interviewApi.setAssessment).not.toHaveBeenCalled();
  });

  it('retains a not-relevant rationale after a failed save and retries the same assessment', async () => {
    const userMessage =
      'Could not save the assessment (HTTP 409). Refresh the page to load the latest interview state, then try again.';
    const savedQuestion = buildTextQuestion({
      checklistStatus: 'Nem releváns',
      assessmentRationale: 'A kérdés nem kapcsolódik a projekthez.',
    });
    const setAssessment = vi
      .fn()
      .mockReturnValueOnce(
        throwError(() => Object.assign(new Error(userMessage), { brand: interviewApiErrorBrand })),
      )
      .mockReturnValueOnce(of(savedQuestion));
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = {
      ...createInterviewApi(buildOpenRound(buildTextQuestion({})), null),
      setAssessment,
    };

    const page = await renderInterviewPage('project-123', questionBankApi, interviewApi);
    findButton(page.nativeElement, '[data-testid="set-not-relevant-assessment-snapshot-1"]')?.click();
    page.fixture.detectChanges();
    const rationale = page.nativeElement.querySelector(
      '[data-testid="round-assessment-rationale-snapshot-1"]',
    ) as HTMLTextAreaElement;

    setInputValue(rationale, 'A kérdés nem kapcsolódik a projekthez.');
    page.fixture.detectChanges();
    findButton(page.nativeElement, '[data-testid="save-not-relevant-assessment-snapshot-1"]')?.click();
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    expect(rationale.value).toBe('A kérdés nem kapcsolódik a projekthez.');
    expect(
      page.nativeElement.querySelector('[data-testid="retry-round-assessment-snapshot-1"]'),
    ).not.toBeNull();

    findButton(page.nativeElement, '[data-testid="retry-round-assessment-snapshot-1"]')?.click();
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    expect(setAssessment).toHaveBeenCalledTimes(2);
    expect(setAssessment).toHaveBeenNthCalledWith(
      2,
      'project-123',
      'round-1',
      'snapshot-1',
      { status: 'Nem releváns', rationale: 'A kérdés nem kapcsolódik a projekthez.' },
    );
    expect(
      page.nativeElement.querySelector('[data-testid="round-assessment-status-snapshot-1"]')
        ?.textContent,
    ).toContain('Not applicable');
  });

  it('submits nonblank not-relevant rationales above the former client limit for server validation', async () => {
    const rationaleAboveFormerClientLimit = 'x'.repeat(10_001);
    const serverError =
      'Could not save the assessment (HTTP 400). Check the data, then try again.';
    const setAssessment = vi.fn().mockReturnValue(throwError(() => new Error(serverError)));
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = {
      ...createInterviewApi(buildOpenRound(buildTextQuestion({})), null),
      setAssessment,
    };

    const page = await renderInterviewPage('project-123', questionBankApi, interviewApi);
    findButton(page.nativeElement, '[data-testid="set-not-relevant-assessment-snapshot-1"]')?.click();
    page.fixture.detectChanges();
    const rationale = page.nativeElement.querySelector(
      '[data-testid="round-assessment-rationale-snapshot-1"]',
    ) as HTMLTextAreaElement;

    setInputValue(rationale, rationaleAboveFormerClientLimit);
    page.fixture.detectChanges();
    const saveButton = findButton(
      page.nativeElement,
      '[data-testid="save-not-relevant-assessment-snapshot-1"]',
    );

    expect(saveButton?.disabled).toBe(false);
    saveButton?.click();
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    expect(setAssessment).toHaveBeenCalledTimes(1);
    expect(
      page.nativeElement.querySelector('[data-testid="round-assessment-save-state-snapshot-1"]')
        ?.textContent,
    ).toContain(serverError);
  });

  it('replaces answer and assessment state from an answer API response after answer clearing', async () => {
    const clearedQuestion = buildTextQuestion({
      answer: null,
      answeredAt: null,
      checklistStatus: 'Nincs meg',
      assessmentRationale: null,
    });
    const updateAnswer = vi.fn().mockReturnValue(of(clearedQuestion));
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = createInterviewApi(
      buildOpenRound(buildTextQuestion({ checklistStatus: 'Részben megvan' })),
      updateAnswer,
    );

    const page = await renderInterviewPage('project-123', questionBankApi, interviewApi);
    const answerInput = page.nativeElement.querySelector(
      '[data-testid="round-answer-input-snapshot-1"]',
    ) as HTMLInputElement;

    setInputValue(answerInput, '');
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    expect(updateAnswer).toHaveBeenCalledWith('project-123', 'round-1', 'snapshot-1', {
      value: null,
    });
    expect(answerInput.value).toBe('');
    expect(
      page.nativeElement
        .querySelector('[data-testid="set-partial-assessment-snapshot-1"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('false');
    expect(
      page.nativeElement.querySelector('[data-testid="round-assessment-status-snapshot-1"]')
        ?.textContent,
    ).toContain('Missing');
  });

  it('keeps pending and failed assessment work blocking completion when an overlapping answer save resolves', async () => {
    const pendingAssessment = new Subject<RoundQuestionSnapshot>();
    const pendingAnswer = new Subject<RoundQuestionSnapshot>();
    const assessmentError = 'Could not save the assessment. Try again.';
    const answerResponse = buildTextQuestion({
      answer: 'Frissített válasz',
      answeredAt: '2026-08-06T10:22:00.000Z',
      checklistStatus: 'Kész',
      assessmentRationale: null,
    });
    const assessmentResponse = buildTextQuestion({
      answer: 'Frissített válasz',
      answeredAt: '2026-08-06T10:22:00.000Z',
      checklistStatus: 'Részben megvan',
      assessmentRationale: null,
    });
    const updateAnswer = vi.fn().mockReturnValue(pendingAnswer.asObservable());
    const setAssessment = vi
      .fn()
      .mockReturnValueOnce(pendingAssessment.asObservable())
      .mockReturnValueOnce(of(assessmentResponse));
    const resetAssessment = vi.fn().mockReturnValue(of(answerResponse));
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = {
      ...createInterviewApi(buildOpenRound(buildTextQuestion({})), updateAnswer),
      setAssessment,
      resetAssessment,
    };

    const page = await renderInterviewPage('project-123', questionBankApi, interviewApi);
    findButton(page.nativeElement, '[data-testid="set-partial-assessment-snapshot-1"]')?.click();
    const answerInput = page.nativeElement.querySelector(
      '[data-testid="round-answer-input-snapshot-1"]',
    ) as HTMLInputElement;

    setInputValue(answerInput, 'Frissített válasz');
    await waitForDuration(800);
    page.fixture.detectChanges();
    pendingAnswer.next(answerResponse);
    pendingAnswer.complete();
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    expect(
      page.nativeElement.querySelector('[data-testid="round-assessment-save-state-snapshot-1"]')
        ?.textContent,
    ).toContain('Saving assessment…');
    expect(
      page.nativeElement
        .querySelector('[data-testid="set-partial-assessment-snapshot-1"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(findButton(page.nativeElement, '[data-testid="finish-interview-later-button"]')?.disabled).toBe(
      true,
    );

    pendingAssessment.error(new Error(assessmentError));
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    expect(
      page.nativeElement.querySelector('[data-testid="round-assessment-save-state-snapshot-1"]')
        ?.textContent,
    ).toContain(assessmentError);
    expect(
      page.nativeElement
        .querySelector('[data-testid="set-partial-assessment-snapshot-1"]')
        ?.getAttribute('aria-pressed'),
    ).toBe('true');
    expect(findButton(page.nativeElement, '[data-testid="finish-interview-later-button"]')?.disabled).toBe(
      true,
    );

    findButton(page.nativeElement, '[data-testid="retry-round-assessment-snapshot-1"]')?.click();
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    expect(setAssessment).toHaveBeenCalledTimes(2);
    expect(resetAssessment).not.toHaveBeenCalled();
    expect(findButton(page.nativeElement, '[data-testid="finish-interview-later-button"]')?.disabled).toBe(
      false,
    );
  });

  it('resets an assessment through DELETE and returns to its server-projected automatic status', async () => {
    const resetQuestion = buildTextQuestion({
      checklistStatus: 'Kész',
      assessmentRationale: null,
    });
    const resetAssessment = vi.fn().mockReturnValue(of(resetQuestion));
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = {
      ...createInterviewApi(
        buildOpenRound(
          buildTextQuestion({
            checklistStatus: 'Részben megvan',
            assessmentRationale: null,
          }),
        ),
        null,
      ),
      resetAssessment,
    };

    const page = await renderInterviewPage('project-123', questionBankApi, interviewApi);
    findButton(page.nativeElement, '[data-testid="reset-round-assessment-snapshot-1"]')?.click();
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    expect(resetAssessment).toHaveBeenCalledWith('project-123', 'round-1', 'snapshot-1');
    expect(
      page.nativeElement.querySelector('[data-testid="round-assessment-status-snapshot-1"]')
        ?.textContent,
    ).toContain('Complete');
  });

  it('blocks completion while assessment work is pending or failed until retry succeeds', async () => {
    const pendingAssessment = new Subject<RoundQuestionSnapshot>();
    const userMessage = 'Could not save the assessment. Try again.';
    const savedQuestion = buildTextQuestion({
      checklistStatus: 'Részben megvan',
      assessmentRationale: null,
    });
    const setAssessment = vi
      .fn()
      .mockReturnValueOnce(pendingAssessment.asObservable())
      .mockReturnValueOnce(of(savedQuestion));
    const finishRound = vi.fn().mockReturnValue(of(buildCompletedRound(savedQuestion)));
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = {
      ...createInterviewApi(buildOpenRound(buildTextQuestion({})), null),
      setAssessment,
      finishRound,
    };

    const page = await renderInterviewPage('project-123', questionBankApi, interviewApi);
    findButton(page.nativeElement, '[data-testid="set-partial-assessment-snapshot-1"]')?.click();
    page.fixture.detectChanges();

    expect(findButton(page.nativeElement, '[data-testid="finish-interview-later-button"]')?.disabled).toBe(
      true,
    );
    expect(
      page.nativeElement.querySelector('[data-testid="complete-round-blocked-message"]')?.textContent,
    ).toContain('assessment saves');

    pendingAssessment.error(new Error(userMessage));
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    expect(findButton(page.nativeElement, '[data-testid="finish-interview-later-button"]')?.disabled).toBe(
      true,
    );
    expect(
      page.nativeElement.querySelector('[data-testid="retry-round-assessment-snapshot-1"]'),
    ).not.toBeNull();

    findButton(page.nativeElement, '[data-testid="retry-round-assessment-snapshot-1"]')?.click();
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    expect(findButton(page.nativeElement, '[data-testid="finish-interview-later-button"]')?.disabled).toBe(
      false,
    );
    expect(finishRound).not.toHaveBeenCalled();
  });

  it('disables every assessment control in a completed round', async () => {
    const completedQuestion = buildTextQuestion({ checklistStatus: 'Kész' });
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = createInterviewApi(buildCompletedRound(completedQuestion), null);

    const page = await renderInterviewPage('project-123', questionBankApi, interviewApi);

    expect(findButton(page.nativeElement, '[data-testid="reset-round-assessment-snapshot-1"]')?.disabled).toBe(
      true,
    );
    expect(findButton(page.nativeElement, '[data-testid="set-partial-assessment-snapshot-1"]')?.disabled).toBe(
      true,
    );
    expect(
      findButton(page.nativeElement, '[data-testid="set-not-relevant-assessment-snapshot-1"]')?.disabled,
    ).toBe(true);
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
    expect(saveState?.textContent?.trim()).toBe('Saved');
    expect(answerInput.value).toBe('Újabb változat');
  });

  it('keeps the failed draft visible, shows a retry action, and retries the same value', async () => {
    const userMessage =
      'Could not save the response (HTTP 409). Refresh the page to load the latest interview state, then try again.';
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
    expect(saveState?.textContent).toContain('Could not save.');
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
      'Could not save the response (HTTP 409). Refresh the page to load the latest interview state, then try again.';
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
    const finishRound = vi.fn().mockReturnValue(of(completedRound));
    const questionBankApi = createQuestionBankApi(buildOptionalTextBank(), buildOptionalTextSchema());
    const interviewApi = {
      ...createInterviewApi(buildOpenRound(failedQuestion), updateAnswer),
      finishRound,
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
      '[data-testid="finish-interview-later-button"]',
    ) as HTMLElement | null;
    const completeButton = completeButtonHost?.querySelector('button') as HTMLButtonElement | null;
    const blockedMessage = page.nativeElement.querySelector(
      '[data-testid="complete-round-blocked-message"]',
    ) as HTMLElement | null;

    expect(answerInput.value).toBe('Még nincs mentve, de fontos válasz');
    expect(completeButton?.disabled).toBe(true);
    expect(blockedMessage?.textContent?.trim()).toBe(
      'The interview round cannot be completed while response saves have failed. Save the failed responses again, then retry.',
    );

    page.fixture.componentInstance.finishRound(false);
    page.fixture.detectChanges();

    const actionError = page.nativeElement.querySelector(
      '[data-testid="interview-action-error-text"]',
    ) as HTMLElement | null;
    expect(finishRound).not.toHaveBeenCalled();
    expect(actionError?.textContent?.trim()).toBe(
      'The interview round cannot be completed while response saves have failed. Save the failed responses again, then retry.',
    );
    expect(answerInput.value).toBe('Még nincs mentve, de fontos válasz');
    expect(
      page.nativeElement.querySelector('[data-testid="retry-round-answer-snapshot-optional"]'),
    ).not.toBeNull();
  });

  it('maps schema publish failures to safe text without exposing the raw service message', async () => {
    const rawServiceMessage =
      'Could not update the project question schema (HTTP 409). PostgreSQL duplicate key value violates unique constraint.';
    const questionBankApi = createQuestionBankApi(null, null);
    questionBankApi.updateProjectSchema.mockReturnValue(
      throwError(() => new Error(rawServiceMessage)),
    );
    const interviewApi = createInterviewApi(buildCompletedRound(buildTextQuestion({})), null);

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
      'Could not update the project schema. Refresh the page, check the selected questions, and try again.',
    );
    expect(actionError?.textContent).not.toContain('PostgreSQL');
  });

  it('renders deterministic English coaching from the round snapshot contract', async () => {
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

    expect(questionCard?.textContent).toContain('Control point: Üzleti cél');
    expect(questionCard?.textContent).toContain('Required question');
    expect(questionCard?.textContent).toContain('Blocking clarification');
    expect(questionCard?.textContent).toContain(
      'Írd le a jelenlegi helyzetet és a kívánt kimenetet.',
    );
    expect(questionCard?.textContent).toContain(
      'A detailed, multi-sentence response is recommended.',
    );
  });

  it('keeps first Project start focused on schema selection when no schema or round exists', async () => {
    const questionBankApi = createQuestionBankApi(null, null);
    questionBankApi.loadProjectSchema.mockReturnValue(of(null));
    const interviewApi = createInterviewApi(null, null);

    const page = await renderInterviewPage('project-456', questionBankApi, interviewApi);

    expect(
      page.nativeElement.querySelector('[data-testid="create-interview-round-button"]'),
    ).toBeNull();
    expect(
      page.nativeElement.querySelector('[data-testid="interview-question-selection"]'),
    ).not.toBeNull();
    expect(page.nativeElement.querySelector('[data-testid="round-status"]')).toBeNull();
    expect(
      page.nativeElement.querySelector('[data-testid="round-type-select"]'),
    ).toBeNull();
  });

  it('renders a supported stakeholder round with its type label', async () => {
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = createInterviewApi(null, null);
    interviewApi.getRound.mockReturnValue(of(buildStakeholderRound()));

    const page = await renderInterviewPage(
      'project-789',
      questionBankApi,
      interviewApi,
      'round-stakeholder',
    );

    expect(interviewApi.getRound).toHaveBeenCalledWith('project-789', 'round-stakeholder');
    expect(page.nativeElement.querySelector('.round-type')?.textContent?.trim())
      .toBe('Stakeholder round');
  });

  it('uses clarification copy for an explicitly requested clarification round', async () => {
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = createInterviewApi(null, null);
    interviewApi.getRound.mockReturnValue(of({
      ...buildOpenRound(buildTextQuestion({})),
      id: 'round-clarification',
      type: 'CLARIFICATION',
    }));

    const page = await renderInterviewPage(
      'project-789',
      questionBankApi,
      interviewApi,
      'round-clarification',
    );

    expect(page.nativeElement.querySelector('#interview-title')?.textContent?.trim())
      .toBe('Clarification round');
    expect(page.nativeElement.querySelector('.resume-state')?.textContent)
      .toContain('Continue clarification round in progress');
  });

  it('preserves the specific service error during initial load', async () => {
    const userMessage =
      'Could not load the active Initial Intake round. Check that the project, interview round, or question still exists.';
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

  it('falls back to the generic load error for an unknown internal error message', async () => {
    const questionBankApi = createQuestionBankApi(null, null);
    const interviewApi = {
      ...createInterviewApi(null, null),
      getActiveInitialIntake: vi.fn().mockReturnValue(
        throwError(
          () =>
            new Error(
              'Could not load the interview round. PostgreSQL relation interview_rounds does not exist at SELECT * FROM interview_rounds.',
            ),
        ),
      ),
    };

    const page = await renderInterviewPage('project-1001', questionBankApi, interviewApi);
    const loadError = page.nativeElement.querySelector(
      '[data-testid="interview-load-error-text"]',
    ) as HTMLElement | null;

    expect(loadError?.textContent?.trim()).toBe(
      'The interview page could not be loaded. Refresh the page and try again.',
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
    readonly getRound: ReturnType<typeof vi.fn>;
    readonly getActiveInitialIntake: ReturnType<typeof vi.fn>;
    readonly createRound: ReturnType<typeof vi.fn>;
    readonly updateAnswer: ReturnType<typeof vi.fn>;
    readonly setAssessment: ReturnType<typeof vi.fn>;
    readonly resetAssessment: ReturnType<typeof vi.fn>;
    readonly finishRound: ReturnType<typeof vi.fn>;
  },
  roundId?: string,
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
            queryParamMap: convertToParamMap(roundId ? { roundId } : {}),
            fragment: null,
          },
        },
      },
      { provide: QuestionBankApiService, useValue: questionBankApi },
      { provide: InterviewApiService, useValue: interviewApi },
      {
        provide: ProjectApiService,
        useValue: {
          loadProjectWorkspace: vi.fn().mockReturnValue(of({
            status: 'DRAFT',
            playbook: { id: 'general', version: 1, name: 'Általános projekt' },
          })),
        },
      },
      {
        provide: ProjectAttachmentsApiService,
        useValue: {
          list: vi.fn().mockReturnValue(of([])),
          upload: vi.fn().mockReturnValue(of({})),
          remove: vi.fn().mockReturnValue(of(undefined)),
          downloadUrl: vi.fn(),
        },
      },
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
  readonly getRound: ReturnType<typeof vi.fn>;
  readonly getActiveInitialIntake: ReturnType<typeof vi.fn>;
  readonly createRound: ReturnType<typeof vi.fn>;
  readonly updateAnswer: ReturnType<typeof vi.fn>;
  readonly setAssessment: ReturnType<typeof vi.fn>;
  readonly resetAssessment: ReturnType<typeof vi.fn>;
  readonly finishRound: ReturnType<typeof vi.fn>;
} {
  return {
    getRound: vi.fn(),
    getActiveInitialIntake: vi.fn().mockReturnValue(of(activeRound)),
    createRound: vi.fn(),
    updateAnswer: updateAnswer ?? vi.fn(),
    setAssessment: vi.fn(),
    resetAssessment: vi.fn(),
    finishRound: vi.fn(),
  };
}

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function findButton(root: HTMLElement, selector: string): HTMLButtonElement | null {
  const host = root.querySelector(selector);
  return host?.querySelector('button') as HTMLButtonElement | null;
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
    contentVersion: 1,
    createdAt: '2026-08-06T10:10:00.000Z',
    endedAt: null,
    questions: [question],
  };
}

function buildOpenRoundWithQuestions(
  questions: readonly RoundQuestionSnapshot[],
): InterviewRound {
  return {
    ...buildOpenRound(questions[0]),
    questions,
  };
}

function buildCompletedRound(question: RoundQuestionSnapshot): InterviewRound {
  return {
    ...buildOpenRound({
      ...question,
      answer: question.answer,
      answeredAt: question.answeredAt,
    }),
    status: 'ENDED',
    endedAt: '2026-08-06T10:30:00.000Z',
  };
}

function buildStakeholderRound(): InterviewRound {
  return {
    ...buildOpenRound(buildTextQuestion({})),
    id: 'round-stakeholder',
    type: 'STAKEHOLDER',
  };
}

function buildBaseTextQuestion(): BaseQuestionBank['questions'][number] {
  return {
    id: 'base-question-1',
    stableKey: 'general-001',
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
    referenceFiles: [],
  };
}

function buildSchemaTextQuestion(): ProjectQuestionSchema['questions'][number] {
  return {
    id: 'schema-question-1',
    baseQuestionId: 'base-question-1',
    stableKey: 'general-001',
    topic: 'Cél',
    controlPoint: 'Üzleti cél',
    text: 'Mi a projekt célja?',
    type: 'TEXT',
    required: true,
    blocking: true,
    order: 1,
    hint: null,
    options: null,
    referenceFiles: [],
  };
}

function buildTextQuestion(overrides: Partial<RoundQuestionSnapshot>): RoundQuestionSnapshot {
  return {
    id: 'snapshot-1',
    baseQuestionId: 'base-question-1',
    stableKey: 'general-001',
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
    checklistStatus: 'Kész',
    assessmentRationale: null,
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
    stableKey: 'general-002',
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
    checklistStatus: 'Kész',
    assessmentRationale: null,
    ...overrides,
  };
}

function buildOptionalTextQuestion(
  overrides: Partial<RoundQuestionSnapshot>,
): RoundQuestionSnapshot {
  return {
    id: 'snapshot-optional',
    baseQuestionId: 'base-question-optional',
    stableKey: 'general-003',
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
    checklistStatus: 'Nincs meg',
    assessmentRationale: null,
    ...overrides,
  };
}

function buildLongTextQuestion(
  overrides: Partial<RoundQuestionSnapshot>,
): RoundQuestionSnapshot {
  return {
    id: 'snapshot-long-text',
    baseQuestionId: 'base-question-long-text',
    stableKey: 'general-004',
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
    checklistStatus: 'Nincs meg',
    assessmentRationale: null,
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
        stableKey: 'general-002',
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
        stableKey: 'general-003',
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
        stableKey: 'general-002',
        topic: 'Döntés',
        controlPoint: 'Jóváhagyás',
        text: 'Szükséges vezetői jóváhagyás?',
        type: 'BOOLEAN',
        required: false,
        blocking: false,
        order: 1,
        hint: null,
        options: null,
        referenceFiles: [],
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
        stableKey: 'general-003',
        topic: 'Részlet',
        controlPoint: 'Kiegészítő információ',
        text: 'Van még fontos részlet?',
        type: 'TEXT',
        required: false,
        blocking: false,
        order: 1,
        hint: null,
        options: null,
        referenceFiles: [],
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
        id: question.baseQuestionId!,
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
        baseQuestionId: question.baseQuestionId!,
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
        referenceFiles: [],
      },
    ],
  };
}
