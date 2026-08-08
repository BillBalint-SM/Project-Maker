import {
  expect,
  test,
  type APIRequestContext,
  type Locator,
  type Page,
} from '@playwright/test';

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
      customerContactName: 'Discovery E2E Contact',
      customerContactEmail: 'discovery-e2e@example.test',
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as ProjectWorkspace;
}

function nativeButton(page: Page, testId: string): Locator {
  return page.getByTestId(testId).locator('button');
}

test('creates a discovery follow-up, preserves its local date after reload, and displays the canonical status', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'Discovery follow-up browser flow');
  await page.goto('/projects/' + project.id);

  await page.getByTestId('discovery-follow-up-category-select').click();
  await page.getByRole('option', { name: 'BUSINESS', exact: true }).click();
  await page.getByTestId('discovery-follow-up-question-input').fill(
    'Which approval is needed?',
  );
  await page.getByTestId('discovery-follow-up-owner-input').fill(
    'Product owner',
  );
  const dueDateInput = page
    .getByTestId('discovery-follow-up-due-date-input')
    .locator('input');
  await dueDateInput.click();
  await dueDateInput.pressSequentially('2026-09-21');
  await dueDateInput.press('Tab');
  await page.getByTestId('discovery-follow-up-next-step-input').fill(
    'Book the approval meeting.',
  );

  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().includes(
        '/api/projects/' + project.id + '/discovery-follow-ups',
      ),
  );
  await nativeButton(page, 'create-discovery-follow-up-button').click();
  expect((await createResponse).status()).toBe(201);

  await expect(page.getByTestId('cockpit-action-success')).toBeVisible();
  await expect(page.getByTestId('discovery-follow-up-item')).toHaveCount(1);
  await expect(page.getByTestId('discovery-follow-up-status')).toHaveText('Nyitott');
  await expect(page.getByTestId('discovery-follow-up-due-date')).toHaveText(
    '2026-09-21',
  );

  await page.reload();
  await expect(page.getByTestId('discovery-follow-up-item')).toHaveCount(1);
  await expect(page.getByTestId('discovery-follow-up-status')).toHaveText('Nyitott');
  await expect(page.getByTestId('discovery-follow-up-due-date')).toHaveText(
    '2026-09-21',
  );
});

test('keeps the discovery list visible while archived and re-enables creation after restore', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'Discovery follow-up archive flow');
  const creation = await request.post(
    apiOrigin + '/projects/' + project.id + '/discovery-follow-ups',
    {
      data: {
        category: 'OPERATIONS',
        question: 'Who owns handoff?',
        owner: 'Delivery lead',
        dueDate: '2026-09-22',
        nextStep: 'Confirm the owner.',
      },
    },
  );
  expect(creation.status()).toBe(201);
  expect(
    (
      await request.post(apiOrigin + '/projects/' + project.id + '/archive')
    ).status(),
  ).toBe(201);

  await page.goto('/projects/' + project.id);
  await expect(page.getByTestId('discovery-follow-up-item')).toHaveCount(1);
  await expect(page.getByTestId('discovery-follow-up-question-input')).toBeDisabled();
  await expect(page.getByTestId('discovery-follow-up-owner-input')).toBeDisabled();
  await expect(
    page.getByTestId('discovery-follow-up-due-date-input').locator('input'),
  ).toBeDisabled();
  await expect(nativeButton(page, 'create-discovery-follow-up-button')).toBeDisabled();

  expect(
    (
      await request.post(apiOrigin + '/projects/' + project.id + '/restore')
    ).status(),
  ).toBe(201);
  await page.reload();
  await expect(nativeButton(page, 'create-discovery-follow-up-button')).toBeEnabled();
});
