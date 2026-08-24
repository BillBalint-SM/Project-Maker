import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import type { AnswerValue, BaseQuestionType, ProjectDecisionReview } from '@project-maker/contracts';
import { loadGeneralPlaybookV1 } from '@project-maker/contracts/general-playbook-runtime';

const apiOrigin = 'http://127.0.0.1:3000';

interface ProjectWorkspace {
  readonly id: string;
}

interface RoundQuestion {
  readonly id: string;
  readonly stableKey: string;
  readonly type: BaseQuestionType;
  readonly options: readonly string[] | null;
}

test.describe.serial('SCORE-01.2 Decision Review employee workflow', () => {
  test.setTimeout(120_000);

  test('displays, saves, and reloads the server-derived Decision Score without copying its calculation', async ({
    page,
    request,
  }) => {
    const project = await createReadyProject(request);

    await page.goto(`/projects/${project.id}/decision-review`);
    await expect(page.getByTestId('decision-review-card')).toBeVisible();
    await expect(page.getByTestId('decision-review-unavailable')).toContainText(
      'Rate all six criteria to calculate the decision score.',
    );
    await expect(page.getByTestId('decision-review-unavailable')).toContainText(
      'Estimation status: Not assessed yet.',
    );
    await expect(page.getByTestId('decision-review-score')).toHaveCount(0);

    await setRating(page, 'businessValue', '5');
    await setRating(page, 'strategicAlignment', '4');
    await setRating(page, 'urgency', '3');
    await setRating(page, 'confidence', '2');
    await setRating(page, 'complexity', '4');
    await setRating(page, 'risk', '5');
    const saveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().endsWith(`/api/projects/${project.id}/decision-review`),
    );
    await page.getByTestId('save-decision-review-button').locator('button').click();
    const saved = (await (await saveResponse).json()) as ProjectDecisionReview;
    expect(saved).toMatchObject({
      projectId: project.id,
      available: true,
      decisionScore: 68,
      decisionScoreLabel: 'High',
      recommendation: 'ESTIMATE_READY',
      readinessPercentage: 100,
      hasCriticalGap: false,
      estimateBlockingGapCount: 0,
    });

    await expect(page.getByTestId('decision-review-score')).toContainText('68');
    await expect(page.getByTestId('decision-review-score')).toContainText('High');
    await expect(page.getByTestId('decision-review-recommendation')).toContainText(
      'Estimation status',
    );
    await expect(page.getByTestId('decision-review-recommendation')).toContainText(
      'Ready for estimation',
    );
    await expect(page.getByTestId('decision-review-available')).toContainText(
      'Policy-derived guidance, not a formal approval.',
    );
    await expect(page.getByTestId('decision-review-readiness')).toContainText('100%');
    await expect(page.getByTestId('decision-review-blocking-gap-count')).toContainText('0');
    await expect(page.getByTestId('decision-review-dimensions')).toContainText(
      'Complexity · 10% · inverted',
    );
    await expect(page.getByTestId('decision-review-dimensions')).toContainText('25%');

    await page.reload();
    await expect(page.getByTestId('decision-review-score')).toContainText('68');
    await expect(page.getByTestId('decision-rating-businessValue').locator('option:checked')).toHaveText('5 — High');
    await expect(page.getByTestId('decision-rating-risk').locator('option:checked')).toHaveText('5 — High');
  });

  test('keeps a Decision Review save failure isolated and makes persisted inputs read-only after archive', async ({
    page,
    request,
  }) => {
    const project = await createProject(request, 'SCORE-01.2 decision review lifecycle');

    await page.goto(`/projects/${project.id}/decision-review`);
    await expect(page.getByTestId('decision-review-unavailable')).toBeVisible();
    await setRating(page, 'businessValue', '3');
    const decisionRoute = `**/api/projects/${project.id}/decision-review`;
    await page.route(decisionRoute, async (route) => {
      if (route.request().method() === 'PUT') {
        await route.fulfill({ status: 409, body: 'controlled Decision Review conflict' });
        return;
      }
      await route.continue();
    });

    await page.getByTestId('save-decision-review-button').locator('button').click();
    await expect(page.getByTestId('decision-review-save-error')).toBeVisible();
    await expect(page.getByTestId('project-context-shell')).toBeVisible();
    await expect(page.getByTestId('project-context-nav-status')).toBeVisible();
    await page.unroute(decisionRoute);

    const savedResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PUT' &&
        response.url().endsWith(`/api/projects/${project.id}/decision-review`),
    );
    await page.getByTestId('save-decision-review-button').locator('button').click();
    expect((await savedResponse).status()).toBe(200);
    await expect(page.getByTestId('decision-review-save-error')).toHaveCount(0);

    const archiveResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().endsWith(`/api/projects/${project.id}/archive`),
    );
    await page.goto(`/projects/${project.id}/settings`);
    await page.getByTestId('archive-project-button').locator('button').click();
    await page.getByTestId('confirm-project-archive-button').locator('button').click();
    expect((await archiveResponse).status()).toBe(201);
    const archivedReviewResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        response.url().endsWith(`/api/projects/${project.id}/decision-review`),
    );
    await page.goto(`/projects/${project.id}/decision-review`);
    expect((await archivedReviewResponse).status()).toBe(200);
    await expect(page.getByTestId('decision-review-read-only')).toBeVisible();
    await expect(page.getByTestId('decision-rating-businessValue')).toBeDisabled();
    await expect(page.getByTestId('save-decision-review-button').locator('button')).toBeDisabled();
  });
});

async function createReadyProject(request: APIRequestContext): Promise<ProjectWorkspace> {
  const project = await createProject(request, `SCORE-01.2 browser workflow ${Date.now()}`, true);
  const policy = await loadGeneralPlaybookV1();

  const schemaResponse = await request.post(`${apiOrigin}/projects/${project.id}/question-schema`, {
    data: {
      questions: policy.items.map((item) => ({
        stableKey: `${policy.id}-${String(item.id).padStart(3, '0')}`,
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
  const round = (await roundResponse.json()) as { readonly id: string; readonly questions: RoundQuestion[] };

  for (const question of round.questions) {
    const response = await request.patch(
      `${apiOrigin}/projects/${project.id}/rounds/${round.id}/answers/${question.id}`,
      { data: { value: validAnswer(question) } },
    );
    expect(response.status()).toBe(200);
  }
  return project;
}

async function createProject(
  request: APIRequestContext,
  name: string,
  withBallOwner = false,
): Promise<ProjectWorkspace> {
  const projectResponse = await request.post(`${apiOrigin}/projects`, {
    data: {
      name,
      customerContactName: 'Decision Review E2E Contact',
      customerContactEmail: 'decision-review-e2e@example.test',
      internalOwnerName: 'Decision Review owner',
      ...(withBallOwner ? { nextActionOwnerRole: 'INTERNAL_OWNER' } : {}),
    },
  });
  expect(projectResponse.status()).toBe(201);
  return (await projectResponse.json()) as ProjectWorkspace;
}

async function setRating(page: Page, dimension: string, value: string): Promise<void> {
  const anchors: Readonly<Record<string, string>> = {
    '1': 'Low',
    '3': 'Medium',
    '5': 'High',
  };
  const label = anchors[value] ? `${value} — ${anchors[value]}` : value;
  await page.getByTestId(`decision-rating-${dimension}`).selectOption({ label });
}

function validAnswer(question: RoundQuestion): AnswerValue {
  if (question.type === 'TEXT' || question.type === 'LONG_TEXT') {
    return `Decision Review browser evidence for ${question.stableKey}.`;
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
    throw new Error(`Decision Review question ${question.stableKey} has no selectable option.`);
  }
  return question.type === 'SINGLE_SELECT' ? option : [option];
}
