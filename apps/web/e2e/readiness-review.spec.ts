import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';
import type { ProjectReadiness } from '@project-maker/contracts';

const apiOrigin = 'http://127.0.0.1:3000';

interface ProjectWorkspace {
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
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as ProjectWorkspace;
}

function nativeButton(page: Page, testId: string): Locator {
  return page.getByTestId(testId).locator('button');
}

test('shows and retries readiness states without blocking Workspace or Discovery', async ({
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
    await route.fulfill({ status: 500, body: 'controlled readiness failure' });
  });

  await page.goto('/projects/' + project.id);
  await firstRequestObserved;
  await expect(page.getByTestId('readiness-review-loading')).toBeVisible();
  await expect(page.getByTestId('workspace-form')).toBeVisible();
  await expect(page.getByTestId('discovery-follow-ups-card')).toBeVisible();

  releaseFirstResponse?.();
  await expect(page.getByTestId('readiness-review-error')).toBeVisible();
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
  expect(readinessRequestCount).toBe(1);
});

test('keeps the newer real readiness state when an older request fails after Workspace save', async ({
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

  await page.route(readinessRoute, async (route) => {
    readinessRequestCount += 1;
    if (readinessRequestCount !== 1) {
      await route.continue();
      return;
    }

    observeOlderRequest?.();
    await olderResponseReleased;
    await route.fulfill({ status: 500, body: 'controlled stale readiness failure' });
  });

  await page.goto('/projects/' + project.id);
  await olderRequestObserved;
  await expect(page.getByTestId('readiness-review-loading')).toBeVisible();
  await expect(page.getByTestId('workspace-form')).toBeVisible();

  const workspaceSaveResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().endsWith('/api/projects/' + project.id + '/workspace'),
  );
  const newerReadinessResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().endsWith('/api/projects/' + project.id + '/readiness'),
  );
  await (await nativeButton(page, 'save-workspace-button')).click();
  expect((await workspaceSaveResponse).status()).toBe(200);

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

  const staleReadinessResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response.url().endsWith('/api/projects/' + project.id + '/readiness') &&
      response.status() === 500,
  );
  releaseOlderResponse?.();
  expect((await staleReadinessResponse).status()).toBe(500);
  await expect(
    page.getByTestId('readiness-review-unavailable-no-initial-intake'),
  ).toBeVisible();
  await expect(page.getByTestId('readiness-review-error')).toHaveCount(0);
  await expect(page.getByTestId('cockpit-action-error')).toHaveCount(0);
});
