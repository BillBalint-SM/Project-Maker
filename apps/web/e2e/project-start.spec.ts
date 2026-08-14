import { expect, test, type Locator, type Page } from '@playwright/test';

test.describe('project start journey', () => {
  test('creates a project from its own page and opens the project schema', async ({ page }) => {
    await createProjectAndOpenSchema(page);

    await expect(page).toHaveURL(/\/projects\/[^/]+\/interview$/);
    await expect(page.getByTestId('project-schema-status')).toBeVisible();
  });

  test('starts exactly one initial interview when the first project schema is accepted', async ({ page }) => {
    await createProjectAndOpenSchema(page);

    const roundRequests: string[] = [];
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        /\/api\/projects\/[^/]+\/rounds$/.test(new URL(request.url()).pathname)
      ) {
        roundRequests.push(request.url());
      }
    });

    const schemaResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        /\/api\/projects\/[^/]+\/question-schema$/.test(new URL(response.url()).pathname),
    );
    await (await nativeButton(page, 'publish-project-schema-button')).click();
    expect((await schemaResponse).status()).toBe(201);

    await expect(page.getByTestId('active-round-resume-state')).toBeVisible();
    await expect(page.getByTestId('round-questions')).toBeVisible();
    expect(roundRequests).toHaveLength(1);
    await expect(page.getByTestId('create-interview-round-button')).toHaveCount(0);
  });
});

async function createProjectAndOpenSchema(page: Page) {
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await page.goto('/projects/new');

  await expect(page.getByRole('heading', { name: 'Új projekt' })).toBeVisible();
  await page.getByTestId('project-name-input').fill(`Új projekt út ${uniquePart}`);
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
}

async function nativeButton(page: { getByTestId(testId: string): Locator }, testId: string) {
  const button = page.getByTestId(testId).locator('button');
  await expect(button).toHaveCount(1);
  return button;
}
