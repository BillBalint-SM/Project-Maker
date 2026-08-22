import {
  expect,
  test,
  type APIRequestContext,
  type APIResponse,
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
  readonly source: {
    readonly snapshotId: string;
    readonly order: number;
    readonly topic: string;
    readonly controlPoint: string;
  } | null;
}

interface SourceSnapshot {
  readonly id: string;
  readonly order: number;
  readonly topic: string;
  readonly controlPoint: string;
  readonly text: string;
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
      internalOwnerName: 'Discovery PO/PM',
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

async function createSourceLinkageFixture(
  request: APIRequestContext,
): Promise<{ readonly project: ProjectWorkspace; readonly source: SourceSnapshot }> {
  const project = await createProject(request, 'Discovery source linkage browser flow');
  const bankResponse = await request.get(apiOrigin + '/settings/base-questions');
  expect(bankResponse.status()).toBe(200);
  const bank = (await bankResponse.json()) as {
    readonly questions: readonly { readonly stableKey: string }[];
  };
  const stableKey = bank.questions[0]?.stableKey;
  if (!stableKey) {
    throw new Error('Seeded question bank did not provide a stable key.');
  }
  const schemaResponse = await request.post(
    apiOrigin + '/projects/' + project.id + '/question-schema',
    {
      data: { questions: [{ stableKey, required: false, blocking: false }] },
    },
  );
  expect(schemaResponse.status()).toBe(201);
  const roundResponse = await request.post(
    apiOrigin + '/projects/' + project.id + '/rounds',
    { data: { type: 'INITIAL_INTAKE' } },
  );
  expect(roundResponse.status()).toBe(201);
  const round = (await roundResponse.json()) as {
    readonly questions: readonly SourceSnapshot[];
  };
  const source = round.questions[0];
  if (!source) {
    throw new Error('Initial Intake did not create a source snapshot.');
  }
  return { project, source };
}

async function createReplacementSource(
  request: APIRequestContext,
  projectId: string,
): Promise<SourceSnapshot> {
  const activeRoundResponse = await request.get(
    apiOrigin + '/projects/' + projectId + '/rounds/active',
  );
  expect(activeRoundResponse.status()).toBe(200);
  const activeRound = (await activeRoundResponse.json()) as {
    readonly id: string;
  } | null;
  if (!activeRound) {
    throw new Error('Initial Intake source round was not active.');
  }
  const completeResponse = await request.post(
    apiOrigin + '/projects/' + projectId + '/rounds/' + activeRound.id + '/complete',
  );
  expect(completeResponse.status()).toBe(201);
  const replacementRoundResponse = await request.post(
    apiOrigin + '/projects/' + projectId + '/rounds',
    { data: { type: 'INITIAL_INTAKE' } },
  );
  expect(replacementRoundResponse.status()).toBe(201);
  const replacementRound = (await replacementRoundResponse.json()) as {
    readonly questions: readonly SourceSnapshot[];
  };
  const replacementSource = replacementRound.questions[0];
  if (!replacementSource) {
    throw new Error('Replacement Initial Intake did not create a source snapshot.');
  }
  return replacementSource;
}

function sourceOptionLabel(source: SourceSnapshot): string {
  return (
    '#' +
    source.order +
    ' · ' +
    source.topic +
    ' · ' +
    source.controlPoint +
    ' — ' +
    source.text
  );
}

function discoveryFollowUpItem(page: Page, followUpId: string): Locator {
  return page.locator(
    '[data-testid="discovery-follow-up-item"][data-follow-up-id="' +
      followUpId +
      '"]',
  );
}

function itemButton(item: Locator, testId: string): Locator {
  return item.getByTestId(testId).locator('button');
}

async function selectSource(
  page: Page,
  select: Locator,
  source: SourceSnapshot,
): Promise<void> {
  await select.click();
  const option = select.getByRole('option');
  await expect(option).toHaveCount(1);
  await expect(option).toHaveText(sourceOptionLabel(source));
  await option.click();
}

async function fillDiscoveryFollowUpCreationForm(page: Page): Promise<void> {
  const categorySelect = page.getByTestId('discovery-follow-up-category-select');
  await categorySelect.click();
  const categoryOptions = categorySelect.getByRole('option');
  await expect(categoryOptions).toHaveCount(8);
  await categoryOptions.first().click();
  await page.getByTestId('discovery-follow-up-question-input').fill(
    'Which source needs a discovery decision?',
  );
  await page.getByTestId('discovery-follow-up-owner-input').fill(
    'Product owner',
  );
  const dueDateInput = page
    .getByTestId('discovery-follow-up-due-date-input')
    .locator('input');
  await dueDateInput.click();
  await dueDateInput.pressSequentially('2026-10-01');
  await dueDateInput.press('Tab');
  await page.getByTestId('discovery-follow-up-next-step-input').fill(
    'Review the Initial Intake source.',
  );
}

async function addSourceLinkFixture(
  request: APIRequestContext,
  projectId: string,
  followUp: DiscoveryFollowUp,
  source: SourceSnapshot,
): Promise<void> {
  const response = await request.put(
    apiOrigin +
      '/projects/' +
      projectId +
      '/discovery-follow-ups/' +
      followUp.id +
      '/source-link',
    {
      data: {
        sourceSnapshotId: source.id,
        expectedVersion: followUp.version,
      },
    },
  );
  expect(response.status()).toBe(200);
}

async function getDiscoveryFollowUp(
  request: APIRequestContext,
  projectId: string,
  followUpId: string,
): Promise<DiscoveryFollowUp> {
  const response = await request.get(
    apiOrigin + '/projects/' + projectId + '/discovery-follow-ups',
  );
  expect(response.status()).toBe(200);
  const followUps = (await response.json()) as readonly DiscoveryFollowUp[];
  const followUp = followUps.find((candidate) => candidate.id === followUpId);
  if (!followUp) {
    throw new Error('Discovery follow-up fixture was not returned by the API.');
  }
  return followUp;
}

function nativeButton(page: Page, testId: string): Locator {
  return page.getByTestId(testId).locator('button');
}

async function archiveProjectFromSettings(page: Page, projectId: string): Promise<void> {
  await page.goto(`/projects/${projectId}/settings`);
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === 'POST' &&
      candidate.url().endsWith(`/api/projects/${projectId}/archive`),
  );
  await nativeButton(page, 'archive-project-button').click();
  await expect(page.getByTestId('project-archive-confirmation')).toBeVisible();
  await nativeButton(page, 'confirm-project-archive-button').click();
  expect((await response).status()).toBe(201);
  await page.goto(`/projects/${projectId}/readiness`);
}

async function restoreProjectFromSettings(page: Page, projectId: string): Promise<void> {
  await page.goto(`/projects/${projectId}/settings`);
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === 'POST' &&
      candidate.url().endsWith(`/api/projects/${projectId}/restore`),
  );
  await nativeButton(page, 'restore-project-button').click();
  expect((await response).status()).toBe(201);
  await page.goto(`/projects/${projectId}/readiness`);
}

test('edits an open discovery follow-up through the real API while keeping row actions exclusive', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'Discovery follow-up edit flow');
  const firstFollowUp = await createDiscoveryFollowUp(request, project.id);
  const secondFollowUp = await createDiscoveryFollowUp(request, project.id);
  await page.goto('/projects/' + project.id + '/readiness');

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
  await page.getByRole('option', { name: 'Technikai', exact: true }).click();
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
  await expect(editedItem).toContainText('Technikai');
  await expect(editedItem).toContainText('Edited browser question.');
  await expect(editedItem).toContainText('Edited browser owner');
  await expect(editedItem).toContainText('Edited browser next step.');
  await expect(editedItem.getByTestId('discovery-follow-up-due-date')).toHaveText(
    '2026-09-01',
  );

  await page.reload();
  const persistedEditedItem = page.getByTestId('discovery-follow-up-item').first();
  await expect(persistedEditedItem).toContainText('Technikai');
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
  await page.goto('/projects/' + project.id + '/readiness');

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
  ).toHaveText('Technikai');
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
  await expect(persistedConflictItem).toContainText('Technikai');
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
  await page.goto('/projects/' + project.id + '/readiness');

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
    'A lezárt tisztázandó tétel már nem szerkeszthető.',
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
  await page.goto('/projects/' + project.id + '/readiness');

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

  await page.goto('/projects/' + project.id + '/readiness');
  const conflictedFollowUpItem = page.locator(
    '[data-testid="discovery-follow-up-item"][data-follow-up-id="' +
      conflictedFollowUp.id +
      '"]',
  );
  const secondFollowUpItem = page.locator(
    '[data-testid="discovery-follow-up-item"][data-follow-up-id="' +
      secondFollowUp.id +
      '"]',
  );
  await expect(conflictedFollowUpItem).toHaveCount(1);
  await expect(secondFollowUpItem).toHaveCount(1);
  await conflictedFollowUpItem
    .getByTestId('edit-discovery-follow-up-button')
    .locator('button')
    .click();
  const conflictedEditForm = conflictedFollowUpItem.getByTestId(
    'discovery-follow-up-edit-form',
  );
  const conflictedEditQuestion = conflictedEditForm.getByTestId(
    'discovery-follow-up-edit-question-input',
  );
  await expect(conflictedEditForm).toHaveCount(1);
  await conflictedEditQuestion
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
    await conflictedEditForm
      .getByTestId('save-discovery-follow-up-edit-button')
      .locator('button')
      .click();
    expect((await staleBrowserResponse).status()).toBe(409);
    await conflictRefreshStarted;

    await conflictedEditForm
      .getByTestId('cancel-discovery-follow-up-edit-button')
      .locator('button')
      .click();
    await expect(
      page.getByTestId('discovery-follow-up-edit-form'),
    ).toHaveCount(0);
    await secondFollowUpItem
      .getByTestId('edit-discovery-follow-up-button')
      .locator('button')
      .click();
    const secondEditForm = secondFollowUpItem.getByTestId(
      'discovery-follow-up-edit-form',
    );
    const secondEditQuestion = secondEditForm.getByTestId(
      'discovery-follow-up-edit-question-input',
    );
    await expect(
      page.getByTestId('discovery-follow-up-edit-form'),
    ).toHaveCount(1);
    await expect(secondEditQuestion).toHaveValue(secondFollowUp.question);
    await secondEditQuestion
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

    await expect(secondEditQuestion).toHaveValue(
      'Active second editor draft must remain.',
    );
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

test('clears an open discovery follow-up edit draft across settings archive and restore', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'Discovery follow-up edit archive flow');
  await createDiscoveryFollowUp(request, project.id);
  await page.goto('/projects/' + project.id + '/readiness');

  await nativeButton(page, 'edit-discovery-follow-up-button').click();
  await page
    .getByTestId('discovery-follow-up-edit-question-input')
    .fill('Browser archive draft that must be cleared.');

  await archiveProjectFromSettings(page, project.id);

  await expect(page.getByTestId('discovery-follow-up-edit-form')).toHaveCount(0);
  await expect(
    nativeButton(page, 'edit-discovery-follow-up-button'),
  ).toBeDisabled();

  await restoreProjectFromSettings(page, project.id);

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
  await page.goto('/projects/' + project.id + '/readiness');

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

test('resolves a discovery follow-up in the readiness context and persists its decision after reload', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'Discovery follow-up resolution flow');
  const followUp = await createDiscoveryFollowUp(request, project.id);
  await page.goto('/projects/' + project.id + '/readiness');

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

test('clears an open discovery follow-up resolution draft across settings archive and restore', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'Discovery follow-up resolution archive flow');
  await createDiscoveryFollowUp(request, project.id);
  await page.goto('/projects/' + project.id + '/readiness');

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

  await archiveProjectFromSettings(page, project.id);

  await expect(page.getByTestId('discovery-follow-up-item')).toHaveCount(1);
  await expect(
    page.getByTestId('discovery-follow-up-resolution-status-select'),
  ).toHaveCount(0);
  await expect(
    page.getByTestId('discovery-follow-up-decision-or-answer-input'),
  ).toHaveCount(0);
  await expect(nativeButton(page, 'resolve-discovery-follow-up-button')).toBeDisabled();

  await restoreProjectFromSettings(page, project.id);

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
  await page.goto('/projects/' + project.id + '/readiness');

  await page.getByTestId('discovery-follow-up-category-select').click();
  await page.getByRole('option', { name: 'Üzleti', exact: true }).click();
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

test('uploads, downloads, confirms removal, and retains a resolved follow-up file', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'Discovery attachment browser flow');
  const followUp = await createDiscoveryFollowUp(request, project.id);
  await page.goto('/projects/' + project.id + '/readiness');

  const item = discoveryFollowUpItem(page, followUp.id);
  const block = item.getByTestId('project-attachment-block-' + followUp.id);
  const fileInput = block.getByTestId('project-attachment-file');
  await fileInput.setInputFiles({
    name: 'ügyfél-igény.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('accepted scope', 'utf8'),
  });
  const uploadResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/projects/' + project.id + '/attachments'),
  );
  await block.getByTestId('upload-project-attachment').locator('button').click();
  const uploaded = await uploadResponse;
  expect(uploaded.status()).toBe(201);
  const attachment = (await uploaded.json()) as { readonly id: string };

  const downloadLink = block.getByTestId(
    'download-project-attachment-' + attachment.id,
  );
  const downloadPromise = page.waitForEvent('download');
  await downloadLink.click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('ügyfél-igény.txt');

  page.once('dialog', async (dialog) => dialog.dismiss());
  await block
    .getByTestId('remove-project-attachment-' + attachment.id)
    .locator('button')
    .click();
  await expect(downloadLink).toBeVisible();

  page.once('dialog', async (dialog) => dialog.accept());
  const removalResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' &&
      response.url().endsWith(
        '/api/projects/' + project.id + '/attachments/' + attachment.id,
      ),
  );
  await block
    .getByTestId('remove-project-attachment-' + attachment.id)
    .locator('button')
    .click();
  expect((await removalResponse).status()).toBe(204);
  await expect(downloadLink).toHaveCount(0);

  await fileInput.setInputFiles({
    name: 'megőrzött-forrás.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('retained scope', 'utf8'),
  });
  const retainedUploadResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response.url().endsWith('/api/projects/' + project.id + '/attachments'),
  );
  await block.getByTestId('upload-project-attachment').locator('button').click();
  const retainedUpload = await retainedUploadResponse;
  expect(retainedUpload.status()).toBe(201);
  const retainedAttachment = (await retainedUpload.json()) as { readonly id: string };

  const resolved = await request.post(
    apiOrigin + '/projects/' + project.id + '/discovery-follow-ups/' + followUp.id + '/resolve',
    {
      data: {
        status: 'Megválaszolva',
        decisionOrAnswer: 'A kapcsolódó forrás alapján lezárva.',
      },
    },
  );
  expect(resolved.status()).toBe(200);
  await page.reload();

  const retainedBlock = discoveryFollowUpItem(page, followUp.id).getByTestId(
    'project-attachment-block-' + followUp.id,
  );
  await expect(
    retainedBlock.getByTestId('download-project-attachment-' + retainedAttachment.id),
  ).toBeVisible();
  await expect(retainedBlock.getByTestId('project-attachment-file')).toHaveCount(0);
  await expect(
    retainedBlock.getByTestId('remove-project-attachment-' + retainedAttachment.id),
  ).toHaveCount(0);
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

  await page.goto('/projects/' + project.id + '/readiness');
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

test('keeps the Project context usable when Discovery loading fails and retries the real request', async ({
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

  await page.goto('/projects/' + project.id + '/readiness');

  await expect(page.getByTestId('project-context-shell')).toBeVisible();
  await expect(page.getByTestId('readiness-review-card')).toBeVisible();
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
  await expect(page.getByTestId('project-context-shell')).toBeVisible();
});

test('creates a linked discovery follow-up with full selection text and compact persisted provenance', async ({
  page,
  request,
}) => {
  const fixture = await createSourceLinkageFixture(request);
  await page.goto('/projects/' + fixture.project.id + '/readiness');

  await selectSource(
    page,
    page.getByTestId('discovery-follow-up-source-select'),
    fixture.source,
  );
  await fillDiscoveryFollowUpCreationForm(page);

  const creationResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response
        .url()
        .endsWith(
          '/api/projects/' + fixture.project.id + '/discovery-follow-ups',
        ),
  );
  await nativeButton(page, 'create-discovery-follow-up-button').click();
  const creation = await creationResponse;
  expect(creation.status()).toBe(201);
  expect(creation.request().postDataJSON()).toMatchObject({
    sourceSnapshotId: fixture.source.id,
  });

  await page.reload();
  const item = page
    .getByTestId('discovery-follow-up-item')
    .filter({ has: page.getByTestId('discovery-follow-up-source-reference') });
  await expect(item).toHaveCount(1);
  const sourceReference = item.getByTestId('discovery-follow-up-source-reference');
  await expect(sourceReference).toContainText(String(fixture.source.order));
  await expect(sourceReference).toContainText(fixture.source.topic);
  await expect(sourceReference).toContainText(fixture.source.controlPoint);
  await expect(item).not.toContainText(fixture.source.text);
});

test('opens one source-link form and disables every discovery row action', async ({
  page,
  request,
}) => {
  const fixture = await createSourceLinkageFixture(request);
  const linkedFollowUp = await createDiscoveryFollowUp(request, fixture.project.id);
  const firstUnlinkedFollowUp = await createDiscoveryFollowUp(
    request,
    fixture.project.id,
  );
  const secondUnlinkedFollowUp = await createDiscoveryFollowUp(
    request,
    fixture.project.id,
  );
  await addSourceLinkFixture(
    request,
    fixture.project.id,
    linkedFollowUp,
    fixture.source,
  );
  await page.goto('/projects/' + fixture.project.id + '/readiness');

  const firstUnlinkedItem = discoveryFollowUpItem(
    page,
    firstUnlinkedFollowUp.id,
  );
  await expect(firstUnlinkedItem).toHaveCount(1);
  await itemButton(
    firstUnlinkedItem,
    'link-discovery-follow-up-source-button',
  ).click();
  await expect(
    firstUnlinkedItem.getByTestId('discovery-follow-up-source-link-form'),
  ).toBeVisible();

  const editButtons = nativeButton(page, 'edit-discovery-follow-up-button');
  const resolveButtons = nativeButton(page, 'resolve-discovery-follow-up-button');
  const linkButtons = nativeButton(page, 'link-discovery-follow-up-source-button');
  const changeButtons = nativeButton(
    page,
    'change-discovery-follow-up-source-button',
  );
  const removeButtons = nativeButton(
    page,
    'remove-discovery-follow-up-source-button',
  );
  await expect(editButtons).toHaveCount(3);
  await expect(resolveButtons).toHaveCount(3);
  await expect(linkButtons).toHaveCount(2);
  await expect(changeButtons).toHaveCount(1);
  await expect(removeButtons).toHaveCount(1);
  for (const action of [
    editButtons,
    resolveButtons,
    linkButtons,
    changeButtons,
    removeButtons,
  ]) {
    const count = await action.count();
    for (let index = 0; index < count; index += 1) {
      await expect(action.nth(index)).toBeDisabled();
    }
  }
  await expect(
    discoveryFollowUpItem(page, secondUnlinkedFollowUp.id).getByTestId(
      'discovery-follow-up-source-link-form',
    ),
  ).toHaveCount(0);
});

test('adds a source through the row link form and persists its compact reference', async ({
  page,
  request,
}) => {
  const fixture = await createSourceLinkageFixture(request);
  const followUp = await createDiscoveryFollowUp(request, fixture.project.id);
  await page.goto('/projects/' + fixture.project.id + '/readiness');

  const item = discoveryFollowUpItem(page, followUp.id);
  await expect(item).toHaveCount(1);
  await itemButton(item, 'link-discovery-follow-up-source-button').click();
  await expect(
    item.getByTestId('discovery-follow-up-source-link-form'),
  ).toBeVisible();
  const sourceLinkForm = item.getByTestId(
    'discovery-follow-up-source-link-form',
  );
  await selectSource(
    page,
    sourceLinkForm.getByTestId('discovery-follow-up-source-link-select'),
    fixture.source,
  );

  const sourceLinkResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response
        .url()
        .endsWith(
          '/api/projects/' +
            fixture.project.id +
            '/discovery-follow-ups/' +
            followUp.id +
            '/source-link',
        ),
  );
  await itemButton(
    item,
    'save-discovery-follow-up-source-link-button',
  ).click();
  const sourceLink = await sourceLinkResponse;
  expect(sourceLink.status()).toBe(200);
  expect(sourceLink.request().postDataJSON()).toMatchObject({
    sourceSnapshotId: fixture.source.id,
    expectedVersion: followUp.version,
  });

  await page.reload();
  const reloadedItem = discoveryFollowUpItem(page, followUp.id);
  const sourceReference = reloadedItem.getByTestId(
    'discovery-follow-up-source-reference',
  );
  await expect(sourceReference).toContainText(String(fixture.source.order));
  await expect(sourceReference).toContainText(fixture.source.topic);
  await expect(sourceReference).toContainText(fixture.source.controlPoint);
  await expect(reloadedItem).not.toContainText(fixture.source.text);
});

test('refreshes source candidates after a stale source-link conflict', async ({
  page,
  request,
}) => {
  const fixture = await createSourceLinkageFixture(request);
  const followUp = await createDiscoveryFollowUp(request, fixture.project.id);
  await page.goto('/projects/' + fixture.project.id + '/readiness');

  const item = discoveryFollowUpItem(page, followUp.id);
  await itemButton(item, 'link-discovery-follow-up-source-button').click();
  const sourceLinkForm = item.getByTestId(
    'discovery-follow-up-source-link-form',
  );
  await selectSource(
    page,
    sourceLinkForm.getByTestId('discovery-follow-up-source-link-select'),
    fixture.source,
  );

  const currentSource = await createReplacementSource(
    request,
    fixture.project.id,
  );
  const sourceLinkResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response
        .url()
        .endsWith(
          '/api/projects/' +
            fixture.project.id +
            '/discovery-follow-ups/' +
            followUp.id +
            '/source-link',
        ),
  );
  const refreshedCandidatesResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response
        .url()
        .endsWith(
          '/api/projects/' +
            fixture.project.id +
            '/discovery-follow-ups/source-options',
        ),
  );
  await itemButton(
    item,
    'save-discovery-follow-up-source-link-button',
  ).click();
  expect((await sourceLinkResponse).status()).toBe(409);

  expect((await refreshedCandidatesResponse).status()).toBe(200);
  await expect(
    page.getByTestId('discovery-follow-up-action-error'),
  ).toContainText('A kezdő felmérés forráslistája frissült. Válassz újra.');
  await expect(
    itemButton(item, 'save-discovery-follow-up-source-link-button'),
  ).toBeDisabled();
  await selectSource(
    page,
    sourceLinkForm.getByTestId('discovery-follow-up-source-link-select'),
    currentSource,
  );

  const recoveredSourceLinkResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response
        .url()
        .endsWith(
          '/api/projects/' +
            fixture.project.id +
            '/discovery-follow-ups/' +
            followUp.id +
            '/source-link',
        ),
  );
  await itemButton(
    item,
    'save-discovery-follow-up-source-link-button',
  ).click();
  const recoveredSourceLink = await recoveredSourceLinkResponse;
  expect(recoveredSourceLink.status()).toBe(200);
  expect(recoveredSourceLink.request().postDataJSON()).toMatchObject({
    sourceSnapshotId: currentSource.id,
    expectedVersion: followUp.version,
  });
});

test('replaces and removes a discovery source only after explicit confirmation with managed focus', async ({
  page,
  request,
}) => {
  const fixture = await createSourceLinkageFixture(request);
  const followUp = await createDiscoveryFollowUp(request, fixture.project.id);
  await addSourceLinkFixture(
    request,
    fixture.project.id,
    followUp,
    fixture.source,
  );
  const replacementSource = await createReplacementSource(
    request,
    fixture.project.id,
  );
  await page.goto('/projects/' + fixture.project.id + '/readiness');

  const item = discoveryFollowUpItem(page, followUp.id);
  await expect(item).toHaveCount(1);
  await itemButton(item, 'change-discovery-follow-up-source-button').click();
  await expect(
    item.getByTestId('discovery-follow-up-source-link-form'),
  ).toBeVisible();
  const sourceLinkForm = item.getByTestId(
    'discovery-follow-up-source-link-form',
  );
  await selectSource(
    page,
    sourceLinkForm.getByTestId('discovery-follow-up-source-link-select'),
    replacementSource,
  );
  const replacementResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response
        .url()
        .endsWith(
          '/api/projects/' +
            fixture.project.id +
            '/discovery-follow-ups/' +
            followUp.id +
            '/source-link',
        ),
  );
  await itemButton(
    item,
    'save-discovery-follow-up-source-link-button',
  ).click();
  const replacement = await replacementResponse;
  expect(replacement.status()).toBe(200);
  expect(replacement.request().postDataJSON()).toMatchObject({
    sourceSnapshotId: replacementSource.id,
  });
  const replacedFollowUp = (await replacement.json()) as DiscoveryFollowUp;
  expect(replacedFollowUp.source?.snapshotId).toBe(replacementSource.id);
  const replacementReference = item.getByTestId(
    'discovery-follow-up-source-reference',
  );
  await expect(replacementReference).toContainText(
    String(replacementSource.order),
  );
  await expect(replacementReference).toContainText(replacementSource.topic);
  await expect(replacementReference).toContainText(
    replacementSource.controlPoint,
  );

  await page.reload();
  const persistedReplacement = await getDiscoveryFollowUp(
    request,
    fixture.project.id,
    followUp.id,
  );
  expect(persistedReplacement.source?.snapshotId).toBe(replacementSource.id);
  await expect(
    item.getByTestId('discovery-follow-up-source-reference'),
  ).toBeVisible();

  const removeSource = itemButton(
    item,
    'remove-discovery-follow-up-source-button',
  );
  await removeSource.click();
  await expect(
    page.getByTestId('discovery-follow-up-source-remove-confirmation'),
  ).toBeVisible();
  await nativeButton(
    page,
    'cancel-discovery-follow-up-source-remove-button',
  ).click();
  await expect(
    page.getByTestId('discovery-follow-up-source-remove-confirmation'),
  ).toHaveCount(0);
  await expect(removeSource).toBeFocused();
  await expect(
    item.getByTestId('discovery-follow-up-source-reference'),
  ).toBeVisible();
  const sourceAfterCancel = await getDiscoveryFollowUp(
    request,
    fixture.project.id,
    followUp.id,
  );
  expect(sourceAfterCancel.source?.snapshotId).toBe(replacementSource.id);

  await removeSource.click();
  let releaseRemoval: (() => void) | null = null;
  let notifyRemovalStarted: (() => void) | null = null;
  const removalStarted = new Promise<void>((resolve) => {
    notifyRemovalStarted = resolve;
  });
  const removalRoute =
    '**/api/projects/' +
    fixture.project.id +
    '/discovery-follow-ups/' +
    followUp.id +
    '/source-link';
  await page.route(removalRoute, async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.continue();
      return;
    }
    if (notifyRemovalStarted === null) {
      throw new Error('Source removal request was intercepted more than once.');
    }

    notifyRemovalStarted();
    notifyRemovalStarted = null;
    await new Promise<void>((resolve) => {
      releaseRemoval = resolve;
    });
    await route.continue();
  });
  const removalResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PUT' &&
      response
        .url()
        .endsWith(
          '/api/projects/' +
            fixture.project.id +
            '/discovery-follow-ups/' +
            followUp.id +
            '/source-link',
        ),
  );
  let removal: APIResponse;
  try {
    await nativeButton(
      page,
      'confirm-discovery-follow-up-source-remove-button',
    ).click();
    await removalStarted;
    await expect(item).toHaveAttribute('tabindex', '-1');
    await expect(item).toBeFocused();
    const unrelatedControl = page.getByTestId('project-context-return');
    await unrelatedControl.focus();
    await expect(unrelatedControl).toBeFocused();
    if (releaseRemoval === null) {
      throw new Error('Source removal release was not initialized.');
    }
    releaseRemoval();
    removal = await removalResponse;
  } finally {
    releaseRemoval?.();
    await page.unroute(removalRoute);
  }
  expect(removal.status()).toBe(200);
  expect(removal.request().postDataJSON()).toMatchObject({
    sourceSnapshotId: null,
  });
  const removedFollowUp = (await removal.json()) as DiscoveryFollowUp;
  expect(removedFollowUp.source).toBeNull();
  await expect(
    item.getByTestId('discovery-follow-up-source-reference'),
  ).toHaveCount(0);
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
  await expect(page.getByTestId('project-context-return')).toBeFocused();

  await page.reload();
  await expect(
    item.getByTestId('discovery-follow-up-source-reference'),
  ).toHaveCount(0);
  const persistedRemoval = await getDiscoveryFollowUp(
    request,
    fixture.project.id,
    followUp.id,
  );
  expect(persistedRemoval.source).toBeNull();
});

test('disables discovery mutations while source removal is pending and restores its trigger on cancel', async ({
  page,
  request,
}) => {
  const fixture = await createSourceLinkageFixture(request);
  const linkedFollowUp = await createDiscoveryFollowUp(
    request,
    fixture.project.id,
  );
  const unlinkedFollowUp = await createDiscoveryFollowUp(
    request,
    fixture.project.id,
  );
  await addSourceLinkFixture(
    request,
    fixture.project.id,
    linkedFollowUp,
    fixture.source,
  );
  await page.goto('/projects/' + fixture.project.id + '/readiness');

  const linkedItem = discoveryFollowUpItem(page, linkedFollowUp.id);
  const unlinkedItem = discoveryFollowUpItem(page, unlinkedFollowUp.id);
  const removeSource = itemButton(
    linkedItem,
    'remove-discovery-follow-up-source-button',
  );
  const discoveryMutations = [
    nativeButton(page, 'create-discovery-follow-up-button'),
    itemButton(linkedItem, 'edit-discovery-follow-up-button'),
    itemButton(linkedItem, 'resolve-discovery-follow-up-button'),
    itemButton(linkedItem, 'change-discovery-follow-up-source-button'),
    removeSource,
    itemButton(unlinkedItem, 'edit-discovery-follow-up-button'),
    itemButton(unlinkedItem, 'resolve-discovery-follow-up-button'),
    itemButton(unlinkedItem, 'link-discovery-follow-up-source-button'),
  ];
  for (const mutation of discoveryMutations) {
    await expect(mutation).toBeEnabled();
  }

  await removeSource.click();
  await expect(
    page.getByTestId('discovery-follow-up-source-remove-confirmation'),
  ).toBeVisible();
  for (const mutation of discoveryMutations) {
    await expect(mutation).toBeDisabled();
  }

  await nativeButton(
    page,
    'cancel-discovery-follow-up-source-remove-button',
  ).click();
  await expect(
    page.getByTestId('discovery-follow-up-source-remove-confirmation'),
  ).toHaveCount(0);
  for (const mutation of discoveryMutations) {
    await expect(mutation).toBeEnabled();
  }
  await expect(removeSource).toBeFocused();
});

test('keeps source removal non-modal and closes it with Escape from a focused background control', async ({
  page,
  request,
}) => {
  const fixture = await createSourceLinkageFixture(request);
  const followUp = await createDiscoveryFollowUp(request, fixture.project.id);
  await addSourceLinkFixture(
    request,
    fixture.project.id,
    followUp,
    fixture.source,
  );
  await page.goto('/projects/' + fixture.project.id + '/readiness');

  const item = discoveryFollowUpItem(page, followUp.id);
  const removeSource = itemButton(
    item,
    'remove-discovery-follow-up-source-button',
  );
  await removeSource.click();
  const confirmation = page.getByTestId(
    'discovery-follow-up-source-remove-confirmation',
  );
  const cancel = nativeButton(
    page,
    'cancel-discovery-follow-up-source-remove-button',
  );
  const settingsNavigation = page.getByTestId('project-context-nav-settings');
  await expect(confirmation).toBeVisible();
  await expect(cancel).toBeFocused();

  let reachedBackgroundControl = false;
  for (let attempt = 0; attempt < 20; attempt += 1) {
    await page.keyboard.press('Shift+Tab');
    if (await settingsNavigation.evaluate((element) => element === document.activeElement)) {
      reachedBackgroundControl = true;
      break;
    }
  }
  expect(reachedBackgroundControl).toBe(true);
  await expect(confirmation).toBeVisible();
  await expect(confirmation).toHaveAttribute('role', 'alertdialog');
  await expect(confirmation).not.toHaveAttribute('aria-modal');
  await expect(
    page.locator('[aria-modal="true"]').filter({ has: confirmation }),
  ).toHaveCount(0);
  await expect(confirmation).toHaveAccessibleName('Törlöd a forráshivatkozást?');
  await expect(confirmation).toHaveAccessibleDescription(
    'A rögzített eredet megszűnik. Egy későbbi felmérési kör után előfordulhat, hogy a régi forrás már nem rendelhető vissza.',
  );
  await expect(settingsNavigation).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(confirmation).toHaveCount(0);
  await expect(removeSource).toBeEnabled();
  await expect(removeSource).toBeFocused();
});

test('keeps Discovery confirmation state out of Project settings', async ({
  page,
  request,
}) => {
  const fixture = await createSourceLinkageFixture(request);
  const followUp = await createDiscoveryFollowUp(request, fixture.project.id);
  await addSourceLinkFixture(
    request,
    fixture.project.id,
    followUp,
    fixture.source,
  );
  await page.goto('/projects/' + fixture.project.id + '/readiness');

  const item = discoveryFollowUpItem(page, followUp.id);
  await itemButton(item, 'remove-discovery-follow-up-source-button').click();
  const sourceConfirmation = page.getByTestId(
    'discovery-follow-up-source-remove-confirmation',
  );
  await expect(sourceConfirmation).toBeVisible();

  await page.goto(`/projects/${fixture.project.id}/settings`);
  await expect(sourceConfirmation).toHaveCount(0);
  await nativeButton(page, 'delete-project-button').click();
  const projectConfirmation = page.getByTestId('project-delete-confirmation');
  await expect(projectConfirmation).toBeVisible();
  await expect(
    nativeButton(page, 'cancel-project-delete-button'),
  ).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(projectConfirmation).toHaveCount(0);
  await page.goto(`/projects/${fixture.project.id}/readiness`);
  await expect(page.getByTestId('discovery-follow-up-source-remove-confirmation')).toHaveCount(0);
});

test('keeps compact linked provenance after a real discovery resolution without source actions', async ({
  page,
  request,
}) => {
  const fixture = await createSourceLinkageFixture(request);
  const followUp = await createDiscoveryFollowUp(request, fixture.project.id);
  await addSourceLinkFixture(
    request,
    fixture.project.id,
    followUp,
    fixture.source,
  );
  await page.goto('/projects/' + fixture.project.id + '/readiness');

  const item = discoveryFollowUpItem(page, followUp.id);
  await itemButton(item, 'resolve-discovery-follow-up-button').click();
  const status = item
    .getByTestId('discovery-follow-up-resolution-status-select')
    .getByRole('combobox');
  await status.click();
  await status.press('ArrowDown');
  await status.press('Enter');
  await item
    .getByTestId('discovery-follow-up-decision-or-answer-input')
    .fill('The linked source supplied the answer.');
  const resolutionResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response
        .url()
        .endsWith(
          '/api/projects/' +
            fixture.project.id +
            '/discovery-follow-ups/' +
            followUp.id +
            '/resolve',
        ),
  );
  await itemButton(item, 'save-discovery-follow-up-resolution-button').click();
  expect((await resolutionResponse).status()).toBe(200);

  const resolvedSourceReference = item.getByTestId(
    'discovery-follow-up-source-reference',
  );
  await expect(resolvedSourceReference).toContainText(
    String(fixture.source.order),
  );
  await expect(resolvedSourceReference).toContainText(fixture.source.topic);
  await expect(resolvedSourceReference).toContainText(
    fixture.source.controlPoint,
  );
  await expect(item).not.toContainText(fixture.source.text);
  await expect(
    item.getByTestId('link-discovery-follow-up-source-button'),
  ).toHaveCount(0);
  await expect(
    item.getByTestId('change-discovery-follow-up-source-button'),
  ).toHaveCount(0);
  await expect(
    item.getByTestId('remove-discovery-follow-up-source-button'),
  ).toHaveCount(0);
});

test('keeps unlinked discovery creation available when source options fail and retry', async ({
  page,
  request,
}) => {
  const fixture = await createSourceLinkageFixture(request);
  let abortNextSourceOptions = true;
  await page.route(
    '**/api/projects/' +
      fixture.project.id +
      '/discovery-follow-ups/source-options',
    async (route) => {
      if (abortNextSourceOptions && route.request().method() === 'GET') {
        abortNextSourceOptions = false;
        await route.abort('failed');
        return;
      }
      await route.continue();
    },
  );
  await page.goto('/projects/' + fixture.project.id + '/readiness');

  await expect(
    page.getByTestId('discovery-follow-up-source-options-error'),
  ).toBeVisible();
  await expect(
    nativeButton(page, 'retry-discovery-follow-up-source-options-button'),
  ).toBeVisible();
  await fillDiscoveryFollowUpCreationForm(page);
  const creationResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      response
        .url()
        .endsWith(
          '/api/projects/' + fixture.project.id + '/discovery-follow-ups',
        ),
  );
  await nativeButton(page, 'create-discovery-follow-up-button').click();
  const creation = await creationResponse;
  expect(creation.status()).toBe(201);
  expect(creation.request().postDataJSON()).not.toHaveProperty(
    'sourceSnapshotId',
  );
  const createdFollowUp = (await creation.json()) as DiscoveryFollowUp;
  expect(createdFollowUp.source).toBeNull();

  const retryResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      response
        .url()
        .endsWith(
          '/api/projects/' +
            fixture.project.id +
            '/discovery-follow-ups/source-options',
        ),
  );
  await nativeButton(
    page,
    'retry-discovery-follow-up-source-options-button',
  ).click();
  expect((await retryResponse).status()).toBe(200);
  await expect(
    page.getByTestId('discovery-follow-up-source-options-error'),
  ).toHaveCount(0);
  await selectSource(
    page,
    page.getByTestId('discovery-follow-up-source-select'),
    fixture.source,
  );
});

test('clears source drafts and removal confirmation when the project is archived from settings', async ({
  page,
  request,
}) => {
  const fixture = await createSourceLinkageFixture(request);
  const followUp = await createDiscoveryFollowUp(request, fixture.project.id);
  const unlinkedFollowUp = await createDiscoveryFollowUp(
    request,
    fixture.project.id,
  );
  await addSourceLinkFixture(
    request,
    fixture.project.id,
    followUp,
    fixture.source,
  );
  const replacementSource = await createReplacementSource(
    request,
    fixture.project.id,
  );
  await page.goto('/projects/' + fixture.project.id + '/readiness');

  const item = discoveryFollowUpItem(page, followUp.id);
  const unlinkedItem = discoveryFollowUpItem(page, unlinkedFollowUp.id);
  await itemButton(item, 'change-discovery-follow-up-source-button').click();
  const sourceLinkForm = item.getByTestId(
    'discovery-follow-up-source-link-form',
  );
  await expect(sourceLinkForm).toBeVisible();
  await selectSource(
    page,
    sourceLinkForm.getByTestId('discovery-follow-up-source-link-select'),
    replacementSource,
  );
  await archiveProjectFromSettings(page, fixture.project.id);
  await expect(sourceLinkForm).toHaveCount(0);
  await expect(
    page.getByTestId('discovery-follow-up-source-remove-confirmation'),
  ).toHaveCount(0);
  await expect(
    itemButton(unlinkedItem, 'link-discovery-follow-up-source-button'),
  ).toBeDisabled();
  await expect(
    itemButton(item, 'change-discovery-follow-up-source-button'),
  ).toBeDisabled();
  await expect(
    itemButton(item, 'remove-discovery-follow-up-source-button'),
  ).toBeDisabled();

  await restoreProjectFromSettings(page, fixture.project.id);
  await expect(sourceLinkForm).toHaveCount(0);
  await expect(
    page.getByTestId('discovery-follow-up-source-remove-confirmation'),
  ).toHaveCount(0);
  await expect(
    itemButton(unlinkedItem, 'link-discovery-follow-up-source-button'),
  ).toBeEnabled();
  await expect(
    itemButton(item, 'change-discovery-follow-up-source-button'),
  ).toBeEnabled();
  await expect(
    itemButton(item, 'remove-discovery-follow-up-source-button'),
  ).toBeEnabled();
  const sourceAfterDraftClearing = await getDiscoveryFollowUp(
    request,
    fixture.project.id,
    followUp.id,
  );
  expect(sourceAfterDraftClearing.source?.snapshotId).toBe(fixture.source.id);

  await itemButton(item, 'remove-discovery-follow-up-source-button').click();
  await expect(
    page.getByTestId('discovery-follow-up-source-remove-confirmation'),
  ).toBeVisible();
  await archiveProjectFromSettings(page, fixture.project.id);
  await expect(
    page.getByTestId('discovery-follow-up-source-remove-confirmation'),
  ).toHaveCount(0);
  await expect(sourceLinkForm).toHaveCount(0);
  await expect(
    itemButton(unlinkedItem, 'link-discovery-follow-up-source-button'),
  ).toBeDisabled();
  await expect(
    itemButton(item, 'change-discovery-follow-up-source-button'),
  ).toBeDisabled();
  await expect(
    itemButton(item, 'remove-discovery-follow-up-source-button'),
  ).toBeDisabled();

  await restoreProjectFromSettings(page, fixture.project.id);
  await expect(sourceLinkForm).toHaveCount(0);
  await expect(
    page.getByTestId('discovery-follow-up-source-remove-confirmation'),
  ).toHaveCount(0);
  await expect(
    itemButton(unlinkedItem, 'link-discovery-follow-up-source-button'),
  ).toBeEnabled();
  await expect(
    itemButton(item, 'change-discovery-follow-up-source-button'),
  ).toBeEnabled();
  await expect(
    itemButton(item, 'remove-discovery-follow-up-source-button'),
  ).toBeEnabled();
  const sourceAfterConfirmationClearing = await getDiscoveryFollowUp(
    request,
    fixture.project.id,
    followUp.id,
  );
  expect(sourceAfterConfirmationClearing.source?.snapshotId).toBe(
    fixture.source.id,
  );
});
