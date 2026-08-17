import { expect, test, type Locator, type Page } from '@playwright/test';

test.describe('project start journey', () => {
  test('rejects invalid basics through both Project-start actions without creating a Project', async ({ page }) => {
    let createRequests = 0;
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname === '/api/projects'
      ) {
        createRequests += 1;
      }
    });

    await page.goto('/projects/new');
    await (await nativeButton(page, 'save-project-draft')).click();
    await page.getByTestId('project-name-input').fill('Részlegesen kitöltött projekt');
    await page.getByTestId('internal-owner-name-input').fill('Teszt PO/PM');
    await page.getByTestId('customer-contact-name-input').fill('Teszt ügyfél');
    await page.getByTestId('customer-contact-email-input').fill('hibás-email');
    await (await nativeButton(page, 'create-project-submit')).click();

    await expect(page.getByTestId('customer-contact-email-input')).toHaveAttribute('aria-invalid', 'true');
    await expect(page).toHaveURL(/\/projects\/new$/);
    expect(createRequests).toBe(0);
  });

  test('saves a valid Project-start draft, returns to the Portfolio, and resumes at schema selection', async ({ page }) => {
    const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const projectName = `Mentett projektindítás ${uniquePart}`;

    await page.goto('/projects/new');
    await page.getByTestId('project-name-input').fill(projectName);
    await page.getByTestId('internal-owner-name-input').fill('Projektindító PO/PM');
    await page.getByTestId('customer-contact-name-input').fill('Projektindító Kapcsolattartó');
    await page
      .getByTestId('customer-contact-email-input')
      .fill(`saved-project-start-${uniquePart}@example.test`);

    const createResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === '/api/projects',
    );
    await (await nativeButton(page, 'save-project-draft')).click();
    expect((await createResponse).status()).toBe(201);

    await expect(page).toHaveURL(/\/$/);
    const projectCard = page.getByRole('link', { name: new RegExp(projectName) });
    await expect(projectCard).toContainText('Kérdésséma szükséges');
    await projectCard.click();
    await expect(page).toHaveURL(/\/projects\/[^/]+\/interview$/);
    await expect(page.getByTestId('project-schema-status')).toBeVisible();
  });

  test('creates a project from its own page and opens the project schema', async ({ page }) => {
    await createProjectAndOpenSchema(page);

    await expect(page).toHaveURL(/\/projects\/[^/]+\/interview$/);
    await expect(page.getByTestId('project-schema-status')).toBeVisible();
  });

  test('edits and reloads valid Project basics before schema acceptance', async ({ page }) => {
    await createProjectAndOpenSchema(page);
    const projectId = projectIdFromInterviewUrl(page);
    const updatedName = `Módosított projektindítás ${Date.now()}`;
    const updatedEmail = `updated-project-start-${Date.now()}@example.test`;

    await page.getByTestId('edit-project-basics-link').click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}(?:#project-basics)?$`));
    await expect(page.getByTestId('project-basics-editor')).toBeVisible();
    await page.getByTestId('draft-project-name-input').fill(updatedName);
    await page.getByTestId('draft-customer-contact-email-input').fill(updatedEmail);

    const updateResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        new URL(response.url()).pathname === `/api/projects/${projectId}/basics`,
    );
    await (await nativeButton(page, 'save-project-basics')).click();
    expect((await updateResponse).status()).toBe(200);
    await expect(page.getByTestId('project-basics-feedback')).toContainText('Alapadatok mentve');

    await page.reload();
    await expect(page.getByTestId('draft-project-name-input')).toHaveValue(updatedName);
    await expect(page.getByTestId('draft-customer-contact-email-input')).toHaveValue(updatedEmail);
  });

  test('retries a lost create response without persisting a duplicate Project', async ({ page }) => {
    const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const projectName = `Idempotens projektindítás ${uniquePart}`;
    let intercepted = false;
    await page.route('**/api/projects', async (route) => {
      if (route.request().method() !== 'POST' || intercepted) {
        await route.continue();
        return;
      }
      intercepted = true;
      await route.fetch();
      await route.abort('connectionreset');
    });

    await page.goto('/projects/new');
    await page.getByTestId('project-name-input').fill(projectName);
    await page.getByTestId('internal-owner-name-input').fill('Projektindító PO/PM');
    await page.getByTestId('customer-contact-name-input').fill('Projektindító Kapcsolattartó');
    await page.getByTestId('customer-contact-email-input').fill(`retry-${uniquePart}@example.test`);
    await (await nativeButton(page, 'save-project-draft')).click();
    await expect(page.getByTestId('create-project-error')).toBeVisible();

    const retryResponse = page.waitForResponse(
      (response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/api/projects',
    );
    await (await nativeButton(page, 'save-project-draft')).click();
    expect((await retryResponse).status()).toBe(201);
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('link', { name: new RegExp(projectName) })).toHaveCount(1);
  });
});

async function createProjectAndOpenSchema(page: Page) {
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await page.goto('/projects/new');

  await expect(page.getByRole('heading', { name: 'Új projekt' })).toBeVisible();
  await page.getByTestId('project-name-input').fill(`Új projekt út ${uniquePart}`);
  await page.getByTestId('internal-owner-name-input').fill('Projektindító PO/PM');
  await page.getByTestId('customer-contact-name-input').fill('Projektindító Kapcsolattartó');
  await page
    .getByTestId('customer-contact-email-input')
    .fill(`project-start-${uniquePart}@example.test`);

  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/projects',
  );
  await (await nativeButton(page, 'create-project-submit')).click();
  expect((await createResponse).status()).toBe(201);
  await expect(page).toHaveURL(/\/projects\/[^/]+\/interview$/);
}

async function nativeButton(page: { getByTestId(testId: string): Locator }, testId: string) {
  const button = page.getByTestId(testId).locator('button');
  await expect(button).toHaveCount(1);
  return button;
}

function projectIdFromInterviewUrl(page: Page): string {
  const projectId = /\/projects\/([^/]+)\/interview$/.exec(new URL(page.url()).pathname)?.[1];
  if (!projectId) {
    throw new Error(`The project interview URL did not contain a project ID: ${page.url()}`);
  }
  return projectId;
}
