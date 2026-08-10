import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

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
  let readinessRequestCount = 0;
  let releaseFirstResponse: (() => void) | null = null;
  const firstResponseReleased = new Promise<void>((resolve) => {
    releaseFirstResponse = resolve;
  });
  let observeFirstRequest: (() => void) | null = null;
  const firstRequestObserved = new Promise<void>((resolve) => {
    observeFirstRequest = resolve;
  });

  await page.route('**/api/projects/' + project.id + '/readiness', async (route) => {
    readinessRequestCount += 1;
    if (readinessRequestCount === 1) {
      observeFirstRequest?.();
      await firstResponseReleased;
      await route.fulfill({ status: 500, body: 'controlled readiness failure' });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        available: false,
        projectId: project.id,
        reason: 'NO_INITIAL_INTAKE',
      }),
    });
  });

  await page.goto('/projects/' + project.id);
  await firstRequestObserved;
  await expect(page.getByTestId('readiness-review-loading')).toBeVisible();
  await expect(page.getByTestId('workspace-form')).toBeVisible();
  await expect(page.getByTestId('discovery-follow-ups-card')).toBeVisible();

  releaseFirstResponse?.();
  await expect(page.getByTestId('readiness-review-error')).toBeVisible();
  await (await nativeButton(page, 'retry-readiness-review-button')).click();
  await expect(
    page.getByTestId('readiness-review-unavailable-no-initial-intake'),
  ).toBeVisible();
});
