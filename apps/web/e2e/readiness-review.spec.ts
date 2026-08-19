import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import type {
  AnswerValue,
  ProjectReadiness,
} from '@project-maker/contracts';
import { loadGeneralPlaybookV1 } from '@project-maker/contracts/general-playbook-runtime';

const apiOrigin = 'http://127.0.0.1:3000';

interface ProjectWorkspace {
  readonly id: string;
}

type ReadinessQuestionType =
  | 'TEXT'
  | 'LONG_TEXT'
  | 'SINGLE_SELECT'
  | 'MULTI_SELECT'
  | 'BOOLEAN'
  | 'NUMBER'
  | 'DATE';

interface ReadinessRoundQuestion {
  readonly id: string;
  readonly stableKey: string;
  readonly type: ReadinessQuestionType;
  readonly options: readonly string[] | null;
  readonly required: boolean;
  readonly answer: AnswerValue | null;
}

interface ReadinessRound {
  readonly id: string;
  readonly status: 'OPEN' | 'ENDED';
  readonly questions: readonly ReadinessRoundQuestion[];
}

interface CanonicalReadinessFixture {
  readonly projectId: string;
  readonly round: ReadinessRound;
}

interface DiscoveryFollowUp {
  readonly id: string;
}

async function createProject(
  request: APIRequestContext,
  name: string,
): Promise<ProjectWorkspace> {
  const response = await request.post(apiOrigin + '/projects', {
    data: {
      name,
      customerContactName: 'Readiness E2E Contact',
      customerContactEmail: 'readiness-e2e@example.test',
      internalOwnerName: 'Readiness PO/PM',
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as ProjectWorkspace;
}

function nativeButton(page: Page, testId: string): Locator {
  return page.getByTestId(testId).locator('button');
}

test.describe.serial('SCORE-01 readiness employee workflow', () => {
  test.setTimeout(120_000);

  test('persists assessment decisions, completes intake, refreshes readiness, and opens remediation targets', async ({
    page,
    request,
  }, testInfo) => {
    const fixture = await createCanonicalReadinessFixture(request, testInfo);
    const partialQuestion = requireRequiredQuestion(fixture.round.questions);

    await page.goto(`/projects/${fixture.projectId}/interview`);
    await expect(page.getByTestId(`round-question-${partialQuestion.id}`)).toBeVisible();

    const answerResponse = waitForAnswerPatch(page, fixture.projectId, partialQuestion.id);
    await saveBrowserAnswer(page, partialQuestion);
    expect((await answerResponse).status()).toBe(200);
    await saveAllOtherRequiredAnswers(request, fixture, partialQuestion.id);

    const partialResponse = waitForAssessmentMutation(
      page,
      fixture.projectId,
      fixture.round.id,
      partialQuestion.id,
      'PUT',
    );
    await nativeButton(page, `set-partial-assessment-${partialQuestion.id}`).click();
    expect((await partialResponse).status()).toBe(200);
    await expect(page.getByTestId(`round-assessment-status-${partialQuestion.id}`)).toHaveText(
      'Részben megvan',
    );

    await page.reload();
    await expect(page.getByTestId(`round-assessment-status-${partialQuestion.id}`)).toHaveText(
      'Részben megvan',
    );

    const completedResponse = waitForRoundCompletion(
      page,
      fixture.projectId,
      fixture.round.id,
    );
    await nativeButton(page, 'finish-interview-later-button').click();
    const completedRound = (await completedResponse).status();
    expect(completedRound).toBe(201);
    await expect(page).toHaveURL(`/projects/${fixture.projectId}/readiness`);
    await expect(page.getByRole('heading', { name: 'Felkészültség', exact: true })).toBeVisible();

    const remediationRound = await createInitialIntakeRound(request, fixture.projectId);
    const checklistGapQuestion = requireOptionalQuestion(remediationRound.questions);
    await saveAllOtherRequiredAnswers(
      request,
      { projectId: fixture.projectId, round: remediationRound },
      checklistGapQuestion.id,
    );

    const initialReadinessResponse = waitForReadiness(page, fixture.projectId);
    await page.goto(`/projects/${fixture.projectId}/readiness`);
    const initialReadiness = requireAvailableReadiness(
      (await (await initialReadinessResponse).json()) as ProjectReadiness,
    );
    await expect(page.getByTestId('readiness-review-available')).toBeVisible();
    await expect(page.getByTestId('readiness-review-summary')).toBeVisible();
    await expect(page.getByTestId(/^readiness-review-factor-/)).toHaveCount(
      initialReadiness.factors.length,
    );
    await expect(page.getByTestId('readiness-review-gap')).toHaveCount(initialReadiness.gaps.length);
    const initialOwnershipFactor = readinessFactor(initialReadiness, 'ownership');
    const initialOwnerGap = requireReadinessGap(initialReadiness, 'overview-ball-owner');
    const initialOwnerGapAction = nativeButton(
      page,
      `readiness-review-gap-action-${initialOwnerGap.id}`,
    );
    await expect(readinessFactorItem(page, initialOwnershipFactor)).toContainText(
      `${initialOwnershipFactor.label}: ${initialOwnershipFactor.percentage}%`,
    );
    await expect(initialOwnerGapAction).toBeVisible();

    await initialOwnerGapAction.click();
    await expect(page).toHaveURL(`/projects/${fixture.projectId}/status#workspace`);
    await expect(page.getByTestId('workspace-form')).toBeVisible();

    const workspaceSaveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response.url().endsWith(`/api/projects/${fixture.projectId}/workspace`),
    );
    await page.getByTestId('workspace-next-action-owner-select').click();
    await page.getByRole('option', { name: /PO\/PM/ }).click();
    await page.getByTestId('save-workspace-button').click();
    const workspaceSave = await workspaceSaveResponse;
    expect(workspaceSave.status(), await workspaceSave.text()).toBe(200);
    const ownerRefreshResponse = waitForReadiness(page, fixture.projectId);
    await page.goto(`/projects/${fixture.projectId}/readiness`);
    const ownerRefreshedReadiness = requireAvailableReadiness(
      (await (await ownerRefreshResponse).json()) as ProjectReadiness,
    );
    const ownerRefreshedFactor = readinessFactor(ownerRefreshedReadiness, 'ownership');
    expect(ownerRefreshedFactor.percentage).toBeGreaterThan(
      initialOwnershipFactor.percentage,
    );
    expect(ownerRefreshedReadiness.gaps.some((gap) => gap.id === 'overview-ball-owner')).toBe(false);
    await expect(readinessFactorItem(page, ownerRefreshedFactor)).toContainText(
      `${ownerRefreshedFactor.label}: ${ownerRefreshedFactor.percentage}%`,
    );
    await expect(initialOwnerGapAction).toHaveCount(0);

    const followUpRefreshResponse = waitForReadiness(page, fixture.projectId);
    const createdFollowUp = await createDiscoveryFollowUp(page, fixture.projectId);
    const followUpRefreshedReadiness = requireAvailableReadiness(
      (await (await followUpRefreshResponse).json()) as ProjectReadiness,
    );
    const followUpGap = requireReadinessGap(
      followUpRefreshedReadiness,
      `follow-up-${createdFollowUp.id}`,
    );
    await expect(
      nativeButton(page, `readiness-review-gap-action-${followUpGap.id}`),
    ).toBeVisible();

    const discoveryAnchor = page.locator('#discovery-follow-ups');
    await expect(discoveryAnchor).toHaveCount(1);
    const readinessTitle = page.locator('#readiness-page-title');
    await readinessTitle.scrollIntoViewIfNeeded();
    await expect(discoveryAnchor).not.toBeInViewport();
    await nativeButton(page, `readiness-review-gap-action-${followUpGap.id}`).click();
    await expect(discoveryAnchor).toBeInViewport();

    const checklistGap = requireReadinessGap(
      followUpRefreshedReadiness,
      `checklist-${checklistGapQuestion.stableKey}`,
    );
    await nativeButton(page, `readiness-review-gap-action-${checklistGap.id}`).click();
    await expect(page).toHaveURL(
      new RegExp(
        `/projects/${fixture.projectId}/interview#round-question-${checklistGapQuestion.id}$`,
      ),
    );
    await expect(page.getByTestId(`round-question-${checklistGapQuestion.id}`)).toBeVisible();
  });
});

async function createCanonicalReadinessFixture(
  request: APIRequestContext,
  testInfo: { readonly workerIndex: number; readonly repeatEachIndex: number },
): Promise<CanonicalReadinessFixture> {
  const policy = await loadGeneralPlaybookV1();
  expect(policy.items).toHaveLength(30);

  const project = await createProject(
    request,
    `SCORE-01 readiness browser workflow ${Date.now()}-${testInfo.workerIndex}-${testInfo.repeatEachIndex}`,
  );
  const schemaResponse = await request.post(`${apiOrigin}/projects/${project.id}/question-schema`, {
    data: {
      questions: policy.items.map((item) => ({
        stableKey: canonicalStableKey(policy.id, item.id),
        required: item.requiredForEstimate,
        blocking: item.blockingIfMissing,
      })),
    },
  });
  expect(schemaResponse.status()).toBe(201);

  const roundResponse = await request.post(`${apiOrigin}/projects/${project.id}/rounds`, {
    data: { type: 'INITIAL_INTAKE' },
  });
  expect(roundResponse.status()).toBe(201);
  const round = (await roundResponse.json()) as ReadinessRound;
  const expectedStableKeys = policy.items
    .map((item) => canonicalStableKey(policy.id, item.id))
    .sort();
  expect(round.questions.map((question) => question.stableKey).sort()).toEqual(expectedStableKeys);

  return { projectId: project.id, round };
}

async function createInitialIntakeRound(
  request: APIRequestContext,
  projectId: string,
): Promise<ReadinessRound> {
  const response = await request.post(`${apiOrigin}/projects/${projectId}/rounds`, {
    data: { type: 'INITIAL_INTAKE' },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as ReadinessRound;
}

function canonicalStableKey(playbookId: string, itemId: number): string {
  return `${playbookId}-${String(itemId).padStart(3, '0')}`;
}

function requireRequiredQuestion(
  questions: readonly ReadinessRoundQuestion[],
): ReadinessRoundQuestion {
  const question = questions.find((candidate) => candidate.required);
  if (!question) {
    throw new Error('The canonical readiness fixture has no required question for UI assessment proof.');
  }
  return question;
}

function requireOptionalQuestion(questions: readonly ReadinessRoundQuestion[]): ReadinessRoundQuestion {
  const question = questions.find((candidate) => !candidate.required);
  if (!question) {
    throw new Error('The canonical readiness fixture has no optional question for checklist-gap proof.');
  }
  return question;
}

async function saveBrowserAnswer(page: Page, question: ReadinessRoundQuestion): Promise<void> {
  const answer = validReadinessAnswer(question);
  if (question.type === 'TEXT') {
    await answerControl(page, question).fill(answer as string);
    return;
  }
  if (question.type === 'LONG_TEXT') {
    await answerControl(page, question).fill(answer as string);
    return;
  }
  if (question.type === 'SINGLE_SELECT') {
    await answerControl(page, question).selectOption(answer as string);
    return;
  }
  if (question.type === 'MULTI_SELECT' || question.type === 'BOOLEAN') {
    await answerControl(page, question).check();
    return;
  }
  if (question.type === 'NUMBER') {
    await answerControl(page, question).fill(String(answer));
    return;
  }
  if (question.type === 'DATE') {
    const control = answerControl(page, question);
    await control.fill(answer as string);
    await control.press('Tab');
    return;
  }
  throw new Error(`Question ${question.stableKey} has an unsupported browser control.`);
}

async function createDiscoveryFollowUp(
  page: Page,
  projectId: string,
): Promise<DiscoveryFollowUp> {
  const categorySelect = page
    .getByTestId('discovery-follow-up-category-select')
    .getByRole('combobox');
  await categorySelect.click();
  await categorySelect.press('ArrowDown');
  await categorySelect.press('Enter');
  await page
    .getByTestId('discovery-follow-up-question-input')
    .fill('Which delivery assumption needs confirmation?');
  await page.getByTestId('discovery-follow-up-owner-input').fill('Readiness workflow owner');
  const dueDateInput = page
    .getByTestId('discovery-follow-up-due-date-input')
    .locator('input');
  await dueDateInput.fill('');
  await dueDateInput.click();
  await dueDateInput.pressSequentially('2026-09-21');
  await dueDateInput.press('Tab');
  await page
    .getByTestId('discovery-follow-up-next-step-input')
    .fill('Confirm the delivery assumption with the accountable stakeholder.');
  const createFollowUpResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith(`/api/projects/${projectId}/discovery-follow-ups`),
  );
  await nativeButton(page, 'create-discovery-follow-up-button').click();
  const response = await createFollowUpResponse;
  expect(response.status()).toBe(201);
  return (await response.json()) as DiscoveryFollowUp;
}

function answerControl(page: Page, question: ReadinessRoundQuestion): Locator {
  if (question.type === 'TEXT') {
    return page.getByTestId(`round-answer-input-${question.id}`);
  }
  if (question.type === 'LONG_TEXT') {
    return page.getByTestId(`round-answer-textarea-${question.id}`);
  }
  if (question.type === 'SINGLE_SELECT') {
    return page.getByTestId(`round-answer-select-${question.id}`);
  }
  if (question.type === 'MULTI_SELECT') {
    return page.getByTestId(`round-answer-multi-option-${question.id}-0`);
  }
  if (question.type === 'BOOLEAN') {
    return page.getByTestId(`round-answer-boolean-${question.id}`);
  }
  if (question.type === 'NUMBER') {
    return page.getByTestId(`round-answer-number-${question.id}`);
  }
  if (question.type === 'DATE') {
    return page.getByTestId(`round-answer-date-${question.id}`);
  }
  throw new Error(`Question ${question.stableKey} has an unsupported browser control.`);
}

async function saveAllOtherRequiredAnswers(
  request: APIRequestContext,
  fixture: CanonicalReadinessFixture,
  excludedSnapshotId: string,
): Promise<void> {
  for (const question of fixture.round.questions) {
    if (!question.required || question.id === excludedSnapshotId) {
      continue;
    }
    const response = await request.patch(
      `${apiOrigin}/projects/${fixture.projectId}/rounds/${fixture.round.id}/answers/${question.id}`,
      { data: { value: validReadinessAnswer(question) } },
    );
    expect(response.status()).toBe(200);
  }
}

function validReadinessAnswer(question: ReadinessRoundQuestion): AnswerValue {
  if (question.type === 'TEXT' || question.type === 'LONG_TEXT') {
    return `Synthetic valid API answer for ${question.stableKey}.`;
  }
  if (question.type === 'BOOLEAN') {
    return true;
  }
  if (question.type === 'NUMBER') {
    return 1;
  }
  if (question.type === 'DATE') {
    return '2026-08-10';
  }
  const option = question.options?.[0];
  if (!option) {
    throw new Error(`Question ${question.stableKey} has no selectable option.`);
  }
  if (question.type === 'SINGLE_SELECT') {
    return option;
  }
  if (question.type === 'MULTI_SELECT') {
    return [option];
  }
  throw new Error(`Question ${question.stableKey} has an unsupported answer type.`);
}

function waitForAnswerPatch(page: Page, projectId: string, snapshotId: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().includes(`/api/projects/${projectId}/rounds/`) &&
      response.url().includes(`/answers/${snapshotId}`),
  );
}

function waitForAssessmentMutation(
  page: Page,
  projectId: string,
  roundId: string,
  snapshotId: string,
  method: 'PUT' | 'DELETE',
) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      response
        .url()
        .endsWith(`/api/projects/${projectId}/rounds/${roundId}/answers/${snapshotId}/assessment`),
  );
}

function waitForRoundCompletion(page: Page, projectId: string, roundId: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith(`/api/projects/${projectId}/rounds/${roundId}/finish`),
  );
}

function waitForReadiness(page: Page, projectId: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().endsWith(`/api/projects/${projectId}/readiness`),
  );
}

type AvailableReadiness = Extract<ProjectReadiness, { readonly available: true }>;

function requireAvailableReadiness(readiness: ProjectReadiness): AvailableReadiness {
  if (!readiness.available) {
    throw new Error(`Expected available readiness, received ${readiness.reason}.`);
  }
  return readiness;
}

function readinessFactor(
  readiness: AvailableReadiness,
  factorId: string,
): AvailableReadiness['factors'][number] {
  const factor = readiness.factors.find((candidate) => candidate.id === factorId);
  if (!factor) {
    throw new Error(`Readiness response is missing factor ${factorId}.`);
  }
  return factor;
}

function readinessFactorItem(
  page: Page,
  factor: AvailableReadiness['factors'][number],
): Locator {
  return page.getByTestId(`readiness-review-factor-${factor.id}`);
}

function requireReadinessGap(
  readiness: AvailableReadiness,
  gapId: string,
): AvailableReadiness['gaps'][number] {
  const gap = readiness.gaps.find((candidate) => candidate.id === gapId);
  if (!gap) {
    throw new Error(`Readiness response is missing gap ${gapId}.`);
  }
  return gap;
}

test('shows and retries readiness states without blocking Project navigation or Discovery', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'Readiness review browser flow');
  const readinessRoute = '**/api/projects/' + project.id + '/readiness';
  let readinessRequestCount = 0;
  let releaseFirstResponse: (() => void) | null = null;
  const firstResponseReleased = new Promise<void>((resolve) => {
    releaseFirstResponse = resolve;
  });
  let observeFirstRequest: (() => void) | null = null;
  const firstRequestObserved = new Promise<void>((resolve) => {
    observeFirstRequest = resolve;
  });

  await page.route(readinessRoute, async (route) => {
    readinessRequestCount += 1;
    if (readinessRequestCount !== 1) {
      await route.continue();
      return;
    }

    observeFirstRequest?.();
    await firstResponseReleased;
    await route.abort('failed');
  });

  await page.goto('/projects/' + project.id + '/readiness');
  await firstRequestObserved;
  await expect(page.getByTestId('readiness-review-loading')).toBeVisible();
  await expect(page.getByTestId('project-context-nav-status')).toBeVisible();
  await expect(page.getByTestId('discovery-follow-ups-card')).toBeVisible();

  releaseFirstResponse?.();
  await expect(page.getByTestId('readiness-review-error')).toBeVisible();
  await expect(page.getByTestId('project-context-nav-status')).toBeVisible();
  await page.unroute(readinessRoute);
  const retryReadinessResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().endsWith('/api/projects/' + project.id + '/readiness'),
  );
  await (await nativeButton(page, 'retry-readiness-review-button')).click();
  const retryResponse = await retryReadinessResponse;
  expect(retryResponse.status()).toBe(200);
  expect((await retryResponse.json()) as ProjectReadiness).toEqual({
    available: false,
    projectId: project.id,
    reason: 'NO_INITIAL_INTAKE',
  });
  await expect(
    page.getByTestId('readiness-review-unavailable-no-initial-intake'),
  ).toBeVisible();
  const noInitialIntakeState = page.getByTestId(
    'readiness-review-unavailable-no-initial-intake',
  );
  await expect(noInitialIntakeState).toContainText('Még nincs kezdő felmérés');
  await expect(noInitialIntakeState).toContainText(
    'Indíts kezdő felmérést a felkészültségi értékelés elkészítéséhez.',
  );
  await expect(page.getByTestId('readiness-review-summary')).toHaveCount(0);
  await expect(page.getByTestId('project-context-nav-status')).toBeVisible();
  await expect(page.getByTestId('discovery-follow-up-form')).toBeVisible();

  const discoveryRefreshResponse = waitForReadiness(page, project.id);
  await createDiscoveryFollowUp(page, project.id);
  const discoveryRefresh = await discoveryRefreshResponse;
  expect(discoveryRefresh.status()).toBe(200);
  expect((await discoveryRefresh.json()) as ProjectReadiness).toEqual({
    available: false,
    projectId: project.id,
    reason: 'NO_INITIAL_INTAKE',
  });
  await expect(page.getByTestId('discovery-follow-up-item')).toHaveCount(1);
  await expect(noInitialIntakeState).toContainText('Még nincs kezdő felmérés');
  await expect(page.getByTestId('readiness-review-summary')).toHaveCount(0);
  await expect(page.getByTestId('project-context-shell')).toBeVisible();
  await expect(page.getByTestId('discovery-follow-up-action-error')).toHaveCount(0);
  expect(readinessRequestCount).toBe(1);
});

test('keeps the newer readiness state after returning from coordination while an older load is cancelled', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'Readiness stale response browser flow');
  const readinessRoute = '**/api/projects/' + project.id + '/readiness';
  let readinessRequestCount = 0;
  let releaseOlderResponse: (() => void) | null = null;
  const olderResponseReleased = new Promise<void>((resolve) => {
    releaseOlderResponse = resolve;
  });
  let observeOlderRequest: (() => void) | null = null;
  const olderRequestObserved = new Promise<void>((resolve) => {
    observeOlderRequest = resolve;
  });
  let settleOlderRoute: (() => void) | null = null;
  const olderRouteSettled = new Promise<void>((resolve) => {
    settleOlderRoute = resolve;
  });

  await page.route(readinessRoute, async (route) => {
    readinessRequestCount += 1;
    if (readinessRequestCount !== 1) {
      await route.continue();
      return;
    }

    observeOlderRequest?.();
    await olderResponseReleased;
    try {
      await route.fulfill({ status: 500, body: 'controlled stale readiness failure' });
    } catch {
      // Navigating to Project status cancels the obsolete readiness request.
    } finally {
      settleOlderRoute?.();
    }
  });

  await page.goto('/projects/' + project.id + '/readiness');
  await olderRequestObserved;
  await expect(page.getByTestId('readiness-review-loading')).toBeVisible();
  await page.getByTestId('project-context-nav-status').click();
  await expect(page).toHaveURL('/projects/' + project.id + '/status?returnTo=%2F');
  await page.getByTestId('project-status-edit-coordination').click();
  await expect(page.getByTestId('workspace-form')).toBeVisible();

  const workspaceSaveResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().endsWith('/api/projects/' + project.id + '/workspace'),
  );
  await page.getByTestId('save-workspace-button').click();
  const workspaceSave = await workspaceSaveResponse;
  expect(workspaceSave.status(), await workspaceSave.text()).toBe(200);

  const newerReadinessResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().endsWith('/api/projects/' + project.id + '/readiness'),
  );
  await page.getByTestId('project-context-nav-readiness').click();

  const newerResponse = await newerReadinessResponse;
  expect(newerResponse.status()).toBe(200);
  expect((await newerResponse.json()) as ProjectReadiness).toEqual({
    available: false,
    projectId: project.id,
    reason: 'NO_INITIAL_INTAKE',
  });
  await expect(
    page.getByTestId('readiness-review-unavailable-no-initial-intake'),
  ).toBeVisible();

  releaseOlderResponse?.();
  await olderRouteSettled;
  await expect(
    page.getByTestId('readiness-review-unavailable-no-initial-intake'),
  ).toBeVisible();
  await expect(page.getByTestId('readiness-review-error')).toHaveCount(0);
  await expect(page.getByTestId('project-context-shell')).toBeVisible();
});
