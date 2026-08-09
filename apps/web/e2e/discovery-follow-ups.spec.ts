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
      customerContactName: 'Discovery E2E Contact',
      customerContactEmail: 'discovery-e2e@example.test',
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as ProjectWorkspace;
}

async function createDiscoveryFollowUp(
  request: APIRequestContext,
  projectId: string,
): Promise<DiscoveryFollowUp> {
  const response = await request.post(
    apiOrigin + '/projects/' + projectId + '/discovery-follow-ups',
    {
      data: {
        category: 'BUSINESS',
        question: 'Which approval is needed?',
        owner: 'Product owner',
        dueDate: '2026-09-21',
        nextStep: 'Book the approval meeting.',
      },
    },
  );
  expect(response.status()).toBe(201);
  return (await response.json()) as DiscoveryFollowUp;
}

function nativeButton(page: Page, testId: string): Locator {
  return page.getByTestId(testId).locator('button');
}

test('disables every unresolved Resolve control while one resolution form is open', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'Discovery follow-up resolution exclusivity');
  await createDiscoveryFollowUp(request, project.id);
  await createDiscoveryFollowUp(request, project.id);
  await page.goto('/projects/' + project.id);

  const resolveButtons = nativeButton(page, 'resolve-discovery-follow-up-button');
  await expect(resolveButtons).toHaveCount(2);
  await expect(resolveButtons.nth(0)).toBeEnabled();
  await expect(resolveButtons.nth(1)).toBeEnabled();

  await resolveButtons.nth(0).click();

  await expect(
    page.getByTestId('discovery-follow-up-resolution-status-select'),
  ).toBeVisible();
  await expect(resolveButtons.nth(0)).toBeDisabled();
  await expect(resolveButtons.nth(1)).toBeDisabled();
});

test('resolves a discovery follow-up in the cockpit and persists its decision after reload', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'Discovery follow-up resolution flow');
  const followUp = await createDiscoveryFollowUp(request, project.id);
  await page.goto('/projects/' + project.id);

  await nativeButton(page, 'resolve-discovery-follow-up-button').click();
  const resolutionStatusCombobox = page
    .getByTestId('discovery-follow-up-resolution-status-select')
    .getByRole('combobox');
  await resolutionStatusCombobox.click();
  await resolutionStatusCombobox.press('ArrowDown');
  await resolutionStatusCombobox.press('Enter');
  await expect(resolutionStatusCombobox).toHaveText('Megválaszolva');
  await page
    .getByTestId('discovery-follow-up-decision-or-answer-input')
    .fill('The sponsor approved the scope.');
  const saveResolutionButton = nativeButton(
    page,
    'save-discovery-follow-up-resolution-button',
  );
  await expect(saveResolutionButton).toBeEnabled();

  const resolutionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response
        .url()
        .endsWith(
          '/api/projects/' +
            project.id +
            '/discovery-follow-ups/' +
            followUp.id +
            '/resolve',
        ),
  );
  await saveResolutionButton.click();
  expect((await resolutionResponse).status()).toBe(200);

  await expect(page.getByTestId('cockpit-action-success')).toBeVisible();
  await expect(page.getByTestId('discovery-follow-up-status')).toHaveText('Megválaszolva');
  await expect(
    page.getByTestId('discovery-follow-up-decision-or-answer'),
  ).toContainText('The sponsor approved the scope.');
  await expect(page.getByTestId('resolve-discovery-follow-up-button')).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId('discovery-follow-up-status')).toHaveText('Megválaszolva');
  await expect(
    page.getByTestId('discovery-follow-up-decision-or-answer'),
  ).toContainText('The sponsor approved the scope.');
});

test('clears an open discovery follow-up resolution draft across cockpit archive and restore', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'Discovery follow-up resolution archive flow');
  await createDiscoveryFollowUp(request, project.id);
  await page.goto('/projects/' + project.id);

  await nativeButton(page, 'resolve-discovery-follow-up-button').click();
  const resolutionStatusCombobox = page
    .getByTestId('discovery-follow-up-resolution-status-select')
    .getByRole('combobox');
  await resolutionStatusCombobox.click();
  await resolutionStatusCombobox.press('ArrowDown');
  await resolutionStatusCombobox.press('Enter');
  await page
    .getByTestId('discovery-follow-up-decision-or-answer-input')
    .fill('This draft must be cleared.');

  const archiveResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response
        .url()
        .endsWith('/api/projects/' + project.id + '/archive'),
  );
  await nativeButton(page, 'archive-project-button').click();
  expect((await archiveResponse).status()).toBe(201);

  await expect(page.getByTestId('discovery-follow-up-item')).toHaveCount(1);
  await expect(
    page.getByTestId('discovery-follow-up-resolution-status-select'),
  ).toHaveCount(0);
  await expect(
    page.getByTestId('discovery-follow-up-decision-or-answer-input'),
  ).toHaveCount(0);
  await expect(nativeButton(page, 'resolve-discovery-follow-up-button')).toBeDisabled();

  const restoreResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response
        .url()
        .endsWith('/api/projects/' + project.id + '/restore'),
  );
  await nativeButton(page, 'restore-project-button').click();
  expect((await restoreResponse).status()).toBe(201);

  await expect(nativeButton(page, 'resolve-discovery-follow-up-button')).toBeEnabled();
  await nativeButton(page, 'resolve-discovery-follow-up-button').click();
  await expect(
    page
      .getByTestId('discovery-follow-up-resolution-status-select')
      .getByRole('combobox'),
  ).not.toHaveText('Megválaszolva');
  await expect(
    page.getByTestId('discovery-follow-up-decision-or-answer-input'),
  ).toHaveValue('');
});

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
