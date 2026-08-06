import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

const apiOrigin = 'http://127.0.0.1:3000';
const hungarianTextPattern = /[áéíóöőúüűÁÉÍÓÖŐÚÜŰ]/;
const textAutosaveDelayMs = 750;
const textAutosavePreBoundaryProbeMs = 700;
const textAutosaveSchedulingToleranceMs = 50;
const textAutosaveBrowserToleranceMs = 200;
const textAutosaveRequestTimeoutMs = textAutosaveDelayMs + textAutosaveBrowserToleranceMs + 250;
const requireFromApi = createRequire(resolve(process.cwd(), '..', 'api', 'package.json'));
const { Client } = requireFromApi('pg') as {
  readonly Client: new (configuration: { readonly connectionString: string }) => DatabaseClient;
};

interface BaseQuestionBank {
  readonly questions: readonly BaseQuestion[];
}

interface BaseQuestion {
  readonly stableKey: string;
}

interface ProjectWorkspace {
  readonly id: string;
}

interface InterviewRound {
  readonly id: string;
  readonly status: 'OPEN' | 'COMPLETED';
  readonly questions: readonly RoundQuestionSnapshot[];
}

interface RoundQuestionSnapshot {
  readonly id: string;
  readonly stableKey: string;
  readonly answer: string | boolean | number | readonly string[] | null;
}

interface GuidedIntakeFixture {
  readonly projectId: string;
  readonly textStableKey: string;
  readonly booleanStableKey: string;
  readonly missingRequiredStableKey: string;
}

interface DatabaseClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(sql: string, parameters?: readonly unknown[]): Promise<unknown>;
}

test.describe.serial('guided intake real Hungarian browser flow', () => {
  test.setTimeout(120_000);

  test.afterEach(async () => {
    await clearE2eAnswerSaveFailures();
  });

  test('persists, recovers, validates, completes, locks, and starts a later initial intake round', async ({
    context,
    page,
    request,
  }, testInfo) => {
    const fixture = await createGuidedIntakeProject(request, testInfo);

    await page.goto(`/projects/${fixture.projectId}/interview`);
    await expect(page.locator('section[aria-labelledby="interview-title"]')).toContainText(
      hungarianTextPattern,
    );
    await expect(page.getByTestId('project-schema-status')).toBeVisible();

    const createButton = await nativeButton(page, 'create-interview-round-button');
    await expect(createButton).toBeEnabled();

    const createRoundResponsePromise = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes(`/api/projects/${fixture.projectId}/rounds`),
    );
    await createButton.click();
    const createRoundResponse = await createRoundResponsePromise;
    expect(createRoundResponse.status()).toBe(201);
    const startedRound = (await createRoundResponse.json()) as InterviewRound;
    const textQuestion = requireQuestion(startedRound, fixture.textStableKey);
    const booleanQuestion = requireQuestion(startedRound, fixture.booleanStableKey);
    const missingRequiredQuestion = requireQuestion(startedRound, fixture.missingRequiredStableKey);

    await expect(page.getByTestId('active-round-resume-state')).toBeVisible();
    await expect(page.getByTestId(`round-question-guidance-${textQuestion.id}`)).toContainText(
      hungarianTextPattern,
    );
    await expect(page.getByTestId(`round-answer-save-state-${textQuestion.id}`)).toBeVisible();

    const textAnswer = 'A böngészős E2E válasz üzleti célt és mérhető eredményt rögzít.';
    const textPatchCounter = countAnswerPatchRequests(page, fixture.projectId, textQuestion.id);
    const textSaveRequestPromise = waitForAnswerPatchRequest(
      page,
      fixture.projectId,
      textQuestion.id,
      textAutosaveRequestTimeoutMs,
    );
    const textSaveResponsePromise = waitForAnswerPatch(page, fixture.projectId, textQuestion.id);
    const textInputStartedAt = Date.now();
    await page.getByTestId(`round-answer-textarea-${textQuestion.id}`).fill(textAnswer);
    await page.waitForTimeout(textAutosavePreBoundaryProbeMs);
    expect(textPatchCounter.count()).toBe(0);
    await textSaveRequestPromise;
    const textSaveResponse = await textSaveResponsePromise;
    const textPatchElapsedMs = textPatchCounter.firstRequestStartedAt() - textInputStartedAt;
    textPatchCounter.stop();
    expect(textSaveResponse.status()).toBe(200);
    expect(textPatchCounter.count()).toBe(1);
    expect(textPatchElapsedMs).toBeGreaterThanOrEqual(
      textAutosaveDelayMs - textAutosaveSchedulingToleranceMs,
    );
    expect(textPatchElapsedMs).toBeLessThan(textAutosaveDelayMs + textAutosaveBrowserToleranceMs);
    await expectSavedAnswer(request, fixture.projectId, textQuestion.id, textAnswer);
    await expect(page.getByTestId(`round-answer-save-state-${textQuestion.id}`)).toContainText(
      /Mentve/,
    );

    const booleanSaveResponsePromise = waitForAnswerPatch(
      page,
      fixture.projectId,
      booleanQuestion.id,
    );
    await page.getByTestId(`round-answer-boolean-${booleanQuestion.id}`).check();
    const booleanSaveResponse = await booleanSaveResponsePromise;
    expect(booleanSaveResponse.status()).toBe(200);
    await expectSavedAnswer(request, fixture.projectId, booleanQuestion.id, true);

    await page.reload();
    await expect(page.getByTestId('active-round-resume-state')).toBeVisible();
    await expect(page.getByTestId(`round-answer-textarea-${textQuestion.id}`)).toHaveValue(
      textAnswer,
    );
    await expect(page.getByTestId(`round-answer-boolean-${booleanQuestion.id}`)).toBeChecked();

    const duplicatePage = await context.newPage();
    await duplicatePage.goto(`/projects/${fixture.projectId}/interview`);
    await expect(duplicatePage.getByTestId('active-round-resume-state')).toBeVisible();
    await expect(
      duplicatePage.getByTestId(`round-answer-textarea-${textQuestion.id}`),
    ).toHaveValue(textAnswer);
    await expect(duplicatePage.getByTestId('create-interview-round-button')).toHaveCount(0);
    await duplicatePage.close();

    const blockedCompletionResponsePromise = waitForRoundCompletion(
      page,
      fixture.projectId,
      startedRound.id,
    );
    await (await nativeButton(page, 'complete-interview-round-button')).click();
    const blockedCompletionResponse = await blockedCompletionResponsePromise;
    expect(blockedCompletionResponse.status()).toBe(409);
    await expect(page.getByTestId('interview-action-error-text')).toContainText(
      hungarianTextPattern,
    );
    await expect(page.getByTestId('interview-action-error-text')).not.toContainText(
      /All required round questions|missingSnapshotIds|PostgreSQL/i,
    );
    await expectActiveRoundStatus(request, fixture.projectId, 'OPEN');

    const retryAnswer = 'Újrapróbált válasz stabil API-kapcsolattal.';
    const cleanupSaveFailure = await installOneAnswerSaveFailure(missingRequiredQuestion.id);
    try {
      const failedSaveResponsePromise = waitForAnswerPatch(
        page,
        fixture.projectId,
        missingRequiredQuestion.id,
      );
      await page.getByTestId(`round-answer-textarea-${missingRequiredQuestion.id}`).fill(retryAnswer);
      const failedSaveResponse = await failedSaveResponsePromise;
      expect(failedSaveResponse.status()).toBeGreaterThanOrEqual(500);
      await expect(page.getByTestId(`retry-round-answer-${missingRequiredQuestion.id}`)).toBeVisible();
      await expect(
        page.getByTestId(`round-answer-textarea-${missingRequiredQuestion.id}`),
      ).toHaveValue(retryAnswer);
      await expect(
        page.getByTestId(`round-answer-save-state-${missingRequiredQuestion.id}`),
      ).toContainText(hungarianTextPattern);
    } finally {
      await cleanupSaveFailure();
    }

    const retryResponsePromise = waitForAnswerPatch(
      page,
      fixture.projectId,
      missingRequiredQuestion.id,
    );
    await (await nativeButton(page, `retry-round-answer-${missingRequiredQuestion.id}`)).click();
    const retryResponse = await retryResponsePromise;
    expect(retryResponse.status()).toBe(200);
    await expectSavedAnswer(request, fixture.projectId, missingRequiredQuestion.id, retryAnswer);

    const completedResponsePromise = waitForRoundCompletion(page, fixture.projectId, startedRound.id);
    await (await nativeButton(page, 'complete-interview-round-button')).click();
    const completedResponse = await completedResponsePromise;
    expect(completedResponse.status()).toBe(201);
    const completedRound = (await completedResponse.json()) as InterviewRound;
    expect(completedRound.status).toBe('COMPLETED');

    await expect(page.getByTestId(`round-answer-textarea-${textQuestion.id}`)).toBeDisabled();
    await expect(page.getByTestId(`round-answer-boolean-${booleanQuestion.id}`)).toBeDisabled();
    await expect(
      page.getByTestId(`round-answer-textarea-${missingRequiredQuestion.id}`),
    ).toBeDisabled();
    await expect(page.getByTestId('complete-interview-round-button')).toHaveCount(0);

    await page.goto(`/projects/${fixture.projectId}`);
    await (await nativeButton(page, 'open-project-interview-button')).click();
    await expect(page).toHaveURL(new RegExp(`/projects/${fixture.projectId}/interview$`));
    const restartButton = await nativeButton(page, 'create-interview-round-button');
    await expect(restartButton).toBeEnabled();
    await restartButton.click();
    await expect
      .poll(async () => {
        const activeRound = await getActiveRound(request, fixture.projectId);
        return activeRound !== null && activeRound.id !== startedRound.id;
      })
      .toBe(true);
  });

  test('blocks the initial intake start when the project has no published schema', async ({
    page,
    request,
  }, testInfo) => {
    const project = await createProject(request, `Séma nélküli Task 5 projekt ${testInfo.repeatEachIndex}`);

    await page.goto(`/projects/${project.id}/interview`);

    await expect(page.locator('section[aria-labelledby="interview-title"]')).toContainText(
      hungarianTextPattern,
    );
    await expect(page.getByTestId('project-schema-status')).toContainText(hungarianTextPattern);
    await expect(await nativeButton(page, 'create-interview-round-button')).toBeDisabled();
    await expect(page.getByTestId('round-questions')).toHaveCount(0);
    expect(await getActiveRound(request, project.id)).toBeNull();
  });
});

async function createGuidedIntakeProject(
  request: APIRequestContext,
  testInfo: { readonly workerIndex: number; readonly repeatEachIndex: number },
): Promise<GuidedIntakeFixture> {
  const runKey = createRunKey(testInfo);
  const booleanStableKey = `${runKey}-igeny-validalt`;
  const project = await createProject(request, `Task 5 vezetett interjú ${runKey}`);
  const bank = await apiJson<BaseQuestionBank>(request, 'GET', '/settings/base-questions');
  const textQuestion = requireBaseQuestion(bank, 'general-001');
  const missingRequiredQuestion = requireBaseQuestion(bank, 'general-002');
  await createBooleanQuestion(request, booleanStableKey);
  await apiJson(request, 'POST', `/projects/${project.id}/question-schema`, {
    questions: [
      { stableKey: textQuestion.stableKey, required: true, blocking: true },
      { stableKey: booleanStableKey, required: true, blocking: true },
      { stableKey: missingRequiredQuestion.stableKey, required: true, blocking: true },
    ],
  });

  return {
    projectId: project.id,
    textStableKey: textQuestion.stableKey,
    booleanStableKey,
    missingRequiredStableKey: missingRequiredQuestion.stableKey,
  };
}

async function createProject(
  request: APIRequestContext,
  name: string,
): Promise<ProjectWorkspace> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return apiJson<ProjectWorkspace>(request, 'POST', '/projects', {
    name,
    customerContactName: 'Task 5 E2E Kapcsolattartó',
    customerContactEmail: `task5-${suffix}@example.test`,
  });
}

async function createBooleanQuestion(
  request: APIRequestContext,
  stableKey: string,
): Promise<void> {
  const bank = await apiJson<BaseQuestionBank>(request, 'GET', '/settings/base-questions');
  await apiJson(request, 'POST', '/settings/base-questions', {
    stableKey,
    topic: 'Task 5 E2E ellenőrzés',
    controlPoint: 'A diszkrét válasz azonnal menthető.',
    text: 'A felhasználó megerősítette az üzleti célt?',
    type: 'BOOLEAN',
    required: true,
    requiredForEstimate: true,
    blocking: true,
    order: bank.questions.length + 1,
    active: true,
    hint: 'Ezt a kérdést a valós böngészős mentési út ellenőrzi.',
  });
}

async function apiJson<T>(
  request: APIRequestContext,
  method: 'GET' | 'POST',
  path: string,
  data?: unknown,
): Promise<T> {
  const response =
    method === 'GET'
      ? await request.get(`${apiOrigin}${path}`)
      : await request.post(`${apiOrigin}${path}`, { data });
  if (!response.ok()) {
    throw new Error(
      `${method} ${path} failed with HTTP ${response.status()}. Response body omitted to avoid leaking server diagnostics.`,
    );
  }
  return (await response.json()) as T;
}

async function getActiveRound(
  request: APIRequestContext,
  projectId: string,
): Promise<InterviewRound | null> {
  return apiJson<InterviewRound | null>(request, 'GET', `/projects/${projectId}/rounds/active`);
}

async function expectSavedAnswer(
  request: APIRequestContext,
  projectId: string,
  snapshotId: string,
  expectedAnswer: RoundQuestionSnapshot['answer'],
): Promise<void> {
  await expect
    .poll(async () => {
      const activeRound = await getActiveRound(request, projectId);
      return activeRound?.questions.find((question) => question.id === snapshotId)?.answer;
    })
    .toEqual(expectedAnswer);
}

async function expectActiveRoundStatus(
  request: APIRequestContext,
  projectId: string,
  expectedStatus: InterviewRound['status'],
): Promise<void> {
  await expect
    .poll(async () => {
      const activeRound = await getActiveRound(request, projectId);
      return activeRound?.status;
    })
    .toBe(expectedStatus);
}

function waitForAnswerPatch(page: Page, projectId: string, snapshotId: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().includes(`/api/projects/${projectId}/rounds/`) &&
      response.url().includes(`/answers/${snapshotId}`),
  );
}

function waitForAnswerPatchRequest(
  page: Page,
  projectId: string,
  snapshotId: string,
  timeoutMs: number,
) {
  return page.waitForRequest(
    (request) =>
      request.method() === 'PATCH' &&
      request.url().includes(`/api/projects/${projectId}/rounds/`) &&
      request.url().includes(`/answers/${snapshotId}`),
    { timeout: timeoutMs },
  );
}

function countAnswerPatchRequests(page: Page, projectId: string, snapshotId: string) {
  let patchCount = 0;
  let firstRequestStartedAt: number | null = null;
  const handler = (request: { method(): string; url(): string }) => {
    if (
      request.method() === 'PATCH' &&
      request.url().includes(`/api/projects/${projectId}/rounds/`) &&
      request.url().includes(`/answers/${snapshotId}`)
    ) {
      patchCount += 1;
      firstRequestStartedAt = firstRequestStartedAt ?? Date.now();
    }
  };
  page.on('request', handler);
  return {
    count: () => patchCount,
    firstRequestStartedAt: () => {
      if (firstRequestStartedAt === null) {
        throw new Error('No matching answer PATCH request was observed.');
      }
      return firstRequestStartedAt;
    },
    stop: () => page.off('request', handler),
  };
}

function waitForRoundCompletion(page: Page, projectId: string, roundId: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes(`/api/projects/${projectId}/rounds/${roundId}/complete`),
  );
}

async function installOneAnswerSaveFailure(snapshotId: string): Promise<() => Promise<void>> {
  await withE2eDatabase(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS "e2e_answer_save_failures" (
        "snapshot_id" uuid PRIMARY KEY
      )
    `);
    await client.query(`
      CREATE OR REPLACE FUNCTION "e2e_reject_configured_answer_save"()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM "e2e_answer_save_failures"
          WHERE "snapshot_id" = (NEW."payload"->>'snapshotId')::uuid
        ) THEN
          RAISE EXCEPTION 'E2E configured answer save failure'
            USING ERRCODE = 'P0001';
        END IF;
        RETURN NEW;
      END;
      $$
    `);
    await client.query(`
      DROP TRIGGER IF EXISTS "trg_e2e_reject_configured_answer_save" ON "audit_events"
    `);
    await client.query(`
      CREATE TRIGGER "trg_e2e_reject_configured_answer_save"
      BEFORE INSERT ON "audit_events"
      FOR EACH ROW
      WHEN (NEW."event_type" = 'ROUND_ANSWER_SAVED')
      EXECUTE FUNCTION "e2e_reject_configured_answer_save"()
    `);
    await client.query(
      'INSERT INTO "e2e_answer_save_failures" ("snapshot_id") VALUES ($1) ON CONFLICT DO NOTHING',
      [snapshotId],
    );
  }, 'install the E2E answer save failure trigger');

  return async () => {
    await withE2eDatabase(async (client) => {
      await client.query('DELETE FROM "e2e_answer_save_failures" WHERE "snapshot_id" = $1', [
        snapshotId,
      ]);
    }, 'remove the E2E answer save failure trigger row');
  };
}

async function clearE2eAnswerSaveFailures(): Promise<void> {
  await withE2eDatabase(async (client) => {
    await client.query('DROP TRIGGER IF EXISTS "trg_e2e_reject_configured_answer_save" ON "audit_events"');
    await client.query('DROP FUNCTION IF EXISTS "e2e_reject_configured_answer_save"()');
    await client.query('DROP TABLE IF EXISTS "e2e_answer_save_failures"');
  }, 'clear E2E answer save failure fixtures');
}

async function withE2eDatabase(
  action: (client: DatabaseClient) => Promise<void>,
  actionDescription: string,
): Promise<void> {
  const databaseUrl = process.env['DATABASE_URL'];
  if (!databaseUrl) {
    throw new Error(`Cannot ${actionDescription}: DATABASE_URL is required.`);
  }

  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await action(client);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown database error';
    throw new Error(`Cannot ${actionDescription}: ${reason}`);
  } finally {
    await client.end();
  }
}

async function nativeButton(page: Page, testId: string): Promise<Locator> {
  const host = page.getByTestId(testId);
  const nestedButton = host.locator('button').first();
  if ((await nestedButton.count()) > 0) {
    return nestedButton;
  }
  return host;
}

function requireQuestion(round: InterviewRound, stableKey: string): RoundQuestionSnapshot {
  const question = round.questions.find((candidate) => candidate.stableKey === stableKey);
  if (!question) {
    throw new Error(`Round ${round.id} did not include question ${stableKey}.`);
  }
  return question;
}

function requireBaseQuestion(bank: BaseQuestionBank, stableKey: string): BaseQuestion {
  const question = bank.questions.find((candidate) => candidate.stableKey === stableKey);
  if (!question) {
    throw new Error(`Base question bank did not include ${stableKey}.`);
  }
  return question;
}

function createRunKey(testInfo: {
  readonly workerIndex: number;
  readonly repeatEachIndex: number;
}): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `task5-${Date.now()}-${testInfo.workerIndex}-${testInfo.repeatEachIndex}-${randomPart}`;
}
