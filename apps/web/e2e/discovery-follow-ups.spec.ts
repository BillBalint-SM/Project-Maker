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
  readonly category: string;
  readonly question: string;
  readonly owner: string;
  readonly dueDate: string;
  readonly status: string;
  readonly nextStep: string;
  readonly version: number;
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

test('edits an open discovery follow-up through the real API while keeping row actions exclusive', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'Discovery follow-up edit flow');
  const firstFollowUp = await createDiscoveryFollowUp(request, project.id);
  const secondFollowUp = await createDiscoveryFollowUp(request, project.id);
  await page.goto('/projects/' + project.id);

  const editButtons = nativeButton(page, 'edit-discovery-follow-up-button');
  const resolveButtons = nativeButton(page, 'resolve-discovery-follow-up-button');
  await expect(editButtons).toHaveCount(2);
  await expect(resolveButtons).toHaveCount(2);

  await editButtons.first().click();

  await expect(
    page.getByTestId('discovery-follow-up-edit-form'),
  ).toBeVisible();
  await expect(
    page.getByTestId('discovery-follow-up-edit-question-input'),
  ).toHaveValue(firstFollowUp.question);
  await expect(
    page.getByTestId('discovery-follow-up-edit-owner-input'),
  ).toHaveValue(firstFollowUp.owner);
  await expect(
    page
      .getByTestId('discovery-follow-up-edit-due-date-input')
      .locator('input'),
  ).toHaveValue(firstFollowUp.dueDate);
  await expect(editButtons.nth(0)).toBeDisabled();
  await expect(editButtons.nth(1)).toBeDisabled();
  await expect(resolveButtons.nth(0)).toBeDisabled();
  await expect(resolveButtons.nth(1)).toBeDisabled();

  const editCategory = page
    .getByTestId('discovery-follow-up-edit-category-select')
    .getByRole('combobox');
  await editCategory.click();
  await page.getByRole('option', { name: 'TECHNICAL', exact: true }).click();
  await page
    .getByTestId('discovery-follow-up-edit-question-input')
    .fill('Edited browser question.');
  await page
    .getByTestId('discovery-follow-up-edit-owner-input')
    .fill('Edited browser owner');
  const editDueDate = page
    .getByTestId('discovery-follow-up-edit-due-date-input')
    .locator('input');
  await editDueDate.fill('');
  await editDueDate.click();
  await editDueDate.pressSequentially('2026-09-01');
  await editDueDate.press('Tab');
  await page
    .getByTestId('discovery-follow-up-edit-next-step-input')
    .fill('Edited browser next step.');

  const editResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response
        .url()
        .endsWith(
          '/api/projects/' +
            project.id +
            '/discovery-follow-ups/' +
            firstFollowUp.id,
        ),
  );
  await nativeButton(page, 'save-discovery-follow-up-edit-button').click();
  expect((await editResponse).status()).toBe(200);

  const editedItem = page.getByTestId('discovery-follow-up-item').first();
  await expect(editedItem).toContainText('TECHNICAL');
  await expect(editedItem).toContainText('Edited browser question.');
  await expect(editedItem).toContainText('Edited browser owner');
  await expect(editedItem).toContainText('Edited browser next step.');
  await expect(editedItem.getByTestId('discovery-follow-up-due-date')).toHaveText(
    '2026-09-01',
  );

  await page.reload();
  const persistedEditedItem = page.getByTestId('discovery-follow-up-item').first();
  await expect(persistedEditedItem).toContainText('TECHNICAL');
  await expect(persistedEditedItem).toContainText('Edited browser question.');
  await expect(persistedEditedItem).toContainText('Edited browser owner');
  await expect(
    persistedEditedItem.getByTestId('discovery-follow-up-due-date'),
  ).toHaveText('2026-09-01');
  await expect(persistedEditedItem).toContainText('Edited browser next step.');

  const resolveResponse = await request.post(
    apiOrigin +
      '/projects/' +
      project.id +
      '/discovery-follow-ups/' +
      secondFollowUp.id +
      '/resolve',
    {
      data: {
        status: 'Megválaszolva',
        decisionOrAnswer: 'Resolved through the real API fixture.',
      },
    },
  );
  expect(resolveResponse.status()).toBe(200);

  await page.reload();
  await expect(
    page
      .getByTestId('discovery-follow-up-item')
      .nth(1)
      .getByTestId('edit-discovery-follow-up-button'),
  ).toHaveCount(0);
});

test('keeps the browser edit draft after a real version conflict until the current version is reloaded', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'Discovery follow-up edit conflict');
  const followUp = await createDiscoveryFollowUp(request, project.id);
  await page.goto('/projects/' + project.id);

  await nativeButton(page, 'edit-discovery-follow-up-button').click();
  await page
    .getByTestId('discovery-follow-up-edit-question-input')
    .fill('Browser draft that must remain.');

  const externalUpdate = await request.patch(
    apiOrigin +
      '/projects/' +
      project.id +
      '/discovery-follow-ups/' +
      followUp.id,
    {
      data: {
        category: 'TECHNICAL',
        question: 'Server question after concurrent update.',
        owner: 'Server owner after concurrent update.',
        dueDate: '2026-10-03',
        nextStep: 'Server next step after concurrent update.',
        expectedVersion: followUp.version,
      },
    },
  );
  expect(externalUpdate.status()).toBe(200);
  const currentFollowUp = (await externalUpdate.json()) as DiscoveryFollowUp;

  const refreshResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response
        .url()
        .endsWith(
          '/api/projects/' + project.id + '/discovery-follow-ups',
        ),
  );
  const staleBrowserResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response
        .url()
        .endsWith(
          '/api/projects/' +
            project.id +
            '/discovery-follow-ups/' +
            followUp.id,
        ),
  );
  await nativeButton(page, 'save-discovery-follow-up-edit-button').click();
  expect((await staleBrowserResponse).status()).toBe(409);
  await expect(page.getByTestId('discovery-follow-up-edit-conflict')).toBeVisible();
  await expect(
    page.getByTestId('discovery-follow-up-edit-question-input'),
  ).toHaveValue('Browser draft that must remain.');
  expect((await refreshResponse).status()).toBe(200);

  await nativeButton(page, 'reload-discovery-follow-up-edit-button').click();
  await expect(
    page
      .getByTestId('discovery-follow-up-edit-category-select')
      .getByRole('combobox'),
  ).toHaveText('TECHNICAL');
  await expect(
    page.getByTestId('discovery-follow-up-edit-question-input'),
  ).toHaveValue('Server question after concurrent update.');
  await expect(
    page.getByTestId('discovery-follow-up-edit-owner-input'),
  ).toHaveValue('Server owner after concurrent update.');
  await expect(
    page
      .getByTestId('discovery-follow-up-edit-due-date-input')
      .locator('input'),
  ).toHaveValue('2026-10-03');
  await expect(
    page.getByTestId('discovery-follow-up-edit-next-step-input'),
  ).toHaveValue('Server next step after concurrent update.');
  await page
    .getByTestId('discovery-follow-up-edit-next-step-input')
    .fill('Browser change after current version reload.');

  const currentBrowserResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response
        .url()
        .endsWith(
          '/api/projects/' +
            project.id +
            '/discovery-follow-ups/' +
            followUp.id,
        ),
  );
  await nativeButton(page, 'save-discovery-follow-up-edit-button').click();
  const currentResponse = await currentBrowserResponse;
  expect(currentResponse.status()).toBe(200);
  expect(currentResponse.request().postDataJSON()).toMatchObject({
    expectedVersion: currentFollowUp.version,
  });

  await page.reload();
  const persistedConflictItem = page.getByTestId('discovery-follow-up-item');
  await expect(persistedConflictItem).toContainText('TECHNICAL');
  await expect(persistedConflictItem).toContainText(
    'Server question after concurrent update.',
  );
  await expect(persistedConflictItem).toContainText(
    'Server owner after concurrent update.',
  );
  await expect(
    persistedConflictItem.getByTestId('discovery-follow-up-due-date'),
  ).toHaveText('2026-10-03');
  await expect(persistedConflictItem).toContainText(
    'Browser change after current version reload.',
  );
});

test('keeps only cancel available when a conflict refresh finds a terminal discovery follow-up', async ({
  page,
  request,
}) => {
  const project = await createProject(
    request,
    'Discovery follow-up terminal conflict refresh',
  );
  const followUp = await createDiscoveryFollowUp(request, project.id);
  await page.goto('/projects/' + project.id);

  await nativeButton(page, 'edit-discovery-follow-up-button').click();
  await page
    .getByTestId('discovery-follow-up-edit-question-input')
    .fill('Browser draft after terminal update.');

  const externalResolution = await request.post(
    apiOrigin +
      '/projects/' +
      project.id +
      '/discovery-follow-ups/' +
      followUp.id +
      '/resolve',
    {
      data: {
        status: 'Megválaszolva',
        decisionOrAnswer: 'Resolved concurrently while the edit was open.',
      },
    },
  );
  expect(externalResolution.status()).toBe(200);

  const staleBrowserResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response
        .url()
        .endsWith(
          '/api/projects/' +
            project.id +
            '/discovery-follow-ups/' +
            followUp.id,
        ),
  );
  await nativeButton(page, 'save-discovery-follow-up-edit-button').click();
  expect((await staleBrowserResponse).status()).toBe(409);

  await expect(page.getByTestId('discovery-follow-up-status')).toHaveText(
    'Megválaszolva',
  );
  await expect(
    nativeButton(page, 'reload-discovery-follow-up-edit-button'),
  ).toHaveCount(0);
  await expect(
    nativeButton(page, 'retry-discovery-follow-up-edit-refresh-button'),
  ).toHaveCount(0);
  await expect(page.getByTestId('discovery-follow-up-edit-conflict')).toContainText(
    'cannot be edited because it is terminal',
  );
  await expect(
    nativeButton(page, 'cancel-discovery-follow-up-edit-button'),
  ).toBeEnabled();
});

test('keeps a conflicted edit unavailable for reload until a failed refresh is retried with the current version', async ({
  page,
  request,
}) => {
  const project = await createProject(
    request,
    'Discovery follow-up conflict refresh retry',
  );
  const followUp = await createDiscoveryFollowUp(request, project.id);
  await page.goto('/projects/' + project.id);

  await nativeButton(page, 'edit-discovery-follow-up-button').click();
  await page
    .getByTestId('discovery-follow-up-edit-question-input')
    .fill('Browser draft after failed refresh.');

  const externalUpdate = await request.patch(
    apiOrigin +
      '/projects/' +
      project.id +
      '/discovery-follow-ups/' +
      followUp.id,
    {
      data: {
        category: 'TECHNICAL',
        question: 'Server question after failed refresh.',
        owner: 'Server owner after failed refresh.',
        dueDate: '2026-10-04',
        nextStep: 'Server next step after failed refresh.',
        expectedVersion: followUp.version,
      },
    },
  );
  expect(externalUpdate.status()).toBe(200);
  const refreshedFollowUp = (await externalUpdate.json()) as DiscoveryFollowUp;

  let failNextConflictRefresh = true;
  await page.route(
    '**/api/projects/' + project.id + '/discovery-follow-ups',
    async (route) => {
      if (
        failNextConflictRefresh &&
        route.request().method() === 'GET'
      ) {
        failNextConflictRefresh = false;
        await route.abort('failed');
        return;
      }

      await route.continue();
    },
  );

  const staleBrowserResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response
        .url()
        .endsWith(
          '/api/projects/' +
            project.id +
            '/discovery-follow-ups/' +
            followUp.id,
        ),
  );
  await nativeButton(page, 'save-discovery-follow-up-edit-button').click();
  expect((await staleBrowserResponse).status()).toBe(409);

  await expect(page.getByTestId('discovery-follow-up-edit-conflict')).toBeVisible();
  await expect(
    page.getByTestId('discovery-follow-up-edit-question-input'),
  ).toHaveValue('Browser draft after failed refresh.');
  await expect(
    nativeButton(page, 'retry-discovery-follow-up-edit-refresh-button'),
  ).toBeVisible();
  await expect(
    nativeButton(page, 'reload-discovery-follow-up-edit-button'),
  ).toHaveCount(0);
  await expect(page.getByTestId('discovery-follow-up-item')).toContainText(
    followUp.question,
  );

  const retryRefreshResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response
        .url()
        .endsWith('/api/projects/' + project.id + '/discovery-follow-ups'),
  );
  await nativeButton(
    page,
    'retry-discovery-follow-up-edit-refresh-button',
  ).click();
  expect((await retryRefreshResponse).status()).toBe(200);
  await expect(
    nativeButton(page, 'reload-discovery-follow-up-edit-button'),
  ).toBeVisible();

  await nativeButton(page, 'reload-discovery-follow-up-edit-button').click();
  await expect(
    page.getByTestId('discovery-follow-up-edit-question-input'),
  ).toHaveValue('Server question after failed refresh.');
  await page
    .getByTestId('discovery-follow-up-edit-next-step-input')
    .fill('Browser save after successful refresh.');

  const currentBrowserResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response
        .url()
        .endsWith(
          '/api/projects/' +
            project.id +
            '/discovery-follow-ups/' +
            followUp.id,
        ),
  );
  await nativeButton(page, 'save-discovery-follow-up-edit-button').click();
  const currentResponse = await currentBrowserResponse;
  expect(currentResponse.status()).toBe(200);
  expect(currentResponse.request().postDataJSON()).toMatchObject({
    expectedVersion: refreshedFollowUp.version,
  });
});

test('ignores a delayed conflict refresh after cancellation opens another editor', async ({
  page,
  request,
}) => {
  const project = await createProject(
    request,
    'Discovery follow-up delayed conflict refresh',
  );
  const conflictedFollowUp = await createDiscoveryFollowUp(request, project.id);
  const secondFollowUpResponse = await request.post(
    apiOrigin + '/projects/' + project.id + '/discovery-follow-ups',
    {
      data: {
        category: 'OPERATIONS',
        question: 'Second editor must remain active.',
        owner: 'Second editor owner',
        dueDate: '2026-12-01',
        nextStep: 'Keep the second editor draft.',
      },
    },
  );
  expect(secondFollowUpResponse.status()).toBe(201);
  const secondFollowUp =
    (await secondFollowUpResponse.json()) as DiscoveryFollowUp;

  await page.goto('/projects/' + project.id);
  const editButtons = nativeButton(page, 'edit-discovery-follow-up-button');
  await expect(editButtons).toHaveCount(2);
  await editButtons.first().click();
  await page
    .getByTestId('discovery-follow-up-edit-question-input')
    .fill('Cancelled conflict draft.');

  const externalUpdate = await request.patch(
    apiOrigin +
      '/projects/' +
      project.id +
      '/discovery-follow-ups/' +
      conflictedFollowUp.id,
    {
      data: {
        category: conflictedFollowUp.category,
        question: 'Delayed server question must not replace the active list.',
        owner: conflictedFollowUp.owner,
        dueDate: conflictedFollowUp.dueDate,
        nextStep: conflictedFollowUp.nextStep,
        expectedVersion: conflictedFollowUp.version,
      },
    },
  );
  expect(externalUpdate.status()).toBe(200);

  let releaseConflictRefresh: (() => void) | null = null;
  let notifyConflictRefreshStarted: (() => void) | null = null;
  const conflictRefreshStarted = new Promise<void>((resolve) => {
    notifyConflictRefreshStarted = resolve;
  });
  await page.route(
    '**/api/projects/' + project.id + '/discovery-follow-ups',
    async (route) => {
      if (route.request().method() !== 'GET') {
        await route.continue();
        return;
      }

      if (notifyConflictRefreshStarted === null) {
        throw new Error('Conflict refresh was intercepted more than once.');
      }

      notifyConflictRefreshStarted();
      notifyConflictRefreshStarted = null;
      await new Promise<void>((resolve) => {
        releaseConflictRefresh = resolve;
      });
      await route.continue();
    },
  );

  try {
    const staleBrowserResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        response
          .url()
          .endsWith(
            '/api/projects/' +
              project.id +
              '/discovery-follow-ups/' +
              conflictedFollowUp.id,
          ),
    );
    await nativeButton(page, 'save-discovery-follow-up-edit-button').click();
    expect((await staleBrowserResponse).status()).toBe(409);
    await conflictRefreshStarted;

    await nativeButton(page, 'cancel-discovery-follow-up-edit-button').click();
    await editButtons.nth(1).click();
    await expect(
      page.getByTestId('discovery-follow-up-edit-question-input'),
    ).toHaveValue(secondFollowUp.question);
    await page
      .getByTestId('discovery-follow-up-edit-question-input')
      .fill('Active second editor draft must remain.');

    if (releaseConflictRefresh === null) {
      throw new Error('Conflict refresh release was not initialized.');
    }
    const delayedRefreshResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'GET' &&
        response
          .url()
          .endsWith('/api/projects/' + project.id + '/discovery-follow-ups'),
    );
    releaseConflictRefresh();
    const delayedRefresh = await delayedRefreshResponse;
    expect(delayedRefresh.status()).toBe(200);
    await delayedRefresh.finished();
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => resolve());
          });
        }),
    );

    await expect(
      page.getByTestId('discovery-follow-up-edit-question-input'),
    ).toHaveValue('Active second editor draft must remain.');
    await expect(
      page
        .getByTestId('discovery-follow-up-item')
        .filter({
          hasText: 'Delayed server question must not replace the active list.',
        }),
    ).toHaveCount(0);
  } finally {
    releaseConflictRefresh?.();
  }
});

test('clears an open discovery follow-up edit draft across cockpit archive and restore', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'Discovery follow-up edit archive flow');
  await createDiscoveryFollowUp(request, project.id);
  await page.goto('/projects/' + project.id);

  await nativeButton(page, 'edit-discovery-follow-up-button').click();
  await page
    .getByTestId('discovery-follow-up-edit-question-input')
    .fill('Browser archive draft that must be cleared.');

  const archiveResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/projects/' + project.id + '/archive'),
  );
  await nativeButton(page, 'archive-project-button').click();
  expect((await archiveResponse).status()).toBe(201);

  await expect(page.getByTestId('discovery-follow-up-edit-form')).toHaveCount(0);
  await expect(
    nativeButton(page, 'edit-discovery-follow-up-button'),
  ).toBeDisabled();

  const restoreResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/projects/' + project.id + '/restore'),
  );
  await nativeButton(page, 'restore-project-button').click();
  expect((await restoreResponse).status()).toBe(201);

  await page.reload();
  const restoredEditButton = nativeButton(
    page,
    'edit-discovery-follow-up-button',
  );
  await expect(restoredEditButton).toBeEnabled();
  await restoredEditButton.click();
  await expect(
    page.getByTestId('discovery-follow-up-edit-question-input'),
  ).toHaveValue('Which approval is needed?');
});

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

  await expect(
    page.getByTestId('discovery-follow-up-action-success'),
  ).toBeVisible();
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

  await expect(
    page.getByTestId('discovery-follow-up-action-success'),
  ).toBeVisible();
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

test('keeps the cockpit usable when Discovery loading fails and retries the real request', async ({
  page,
  request,
}) => {
  const project = await createProject(
    request,
    'Discovery follow-up isolated load failure',
  );
  await createDiscoveryFollowUp(request, project.id);
  let abortNextDiscoveryRead = true;

  await page.route(
    '**/api/projects/' + project.id + '/discovery-follow-ups',
    async (route) => {
      if (
        abortNextDiscoveryRead &&
        route.request().method() === 'GET'
      ) {
        abortNextDiscoveryRead = false;
        await route.abort('failed');
        return;
      }
      await route.continue();
    },
  );

  await page.goto('/projects/' + project.id);

  await expect(page.getByTestId('workspace-form')).toBeVisible();
  await expect(page.getByTestId('cockpit-error')).toHaveCount(0);
  await expect(page.getByTestId('discovery-follow-ups-error')).toBeVisible();

  const retryResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response
        .url()
        .endsWith(
          '/api/projects/' + project.id + '/discovery-follow-ups',
        ),
  );
  await nativeButton(page, 'retry-discovery-follow-ups-button').click();

  expect((await retryResponse).status()).toBe(200);
  await expect(page.getByTestId('discovery-follow-ups-error')).toHaveCount(0);
  await expect(page.getByTestId('discovery-follow-up-item')).toHaveCount(1);
  await expect(page.getByTestId('workspace-form')).toBeVisible();
});
