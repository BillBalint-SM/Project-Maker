import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';
import type { BaseQuestionBank } from '@project-maker/contracts';

const requireFromApi = createRequire(resolve(process.cwd(), '..', 'api', 'package.json'));
const { Client } = requireFromApi('pg') as {
  readonly Client: new (configuration: { readonly connectionString: string }) => DatabaseClient;
};

interface DatabaseClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<Result extends Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[],
  ): Promise<{ readonly rows: readonly Result[] }>;
}

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
    await expect(projectCard).toContainText('Question schema required');
    await projectCard.click();
    await expect(page).toHaveURL(
      (url) =>
        /\/projects\/[^/]+\/interview$/.test(url.pathname) &&
        url.searchParams.get('returnTo') === '/',
    );
    await expect(page.getByTestId('project-schema-status')).toBeVisible();
  });

  test('opens a focused schema selection before the first Initial Intake exists', async ({ page }) => {
    await createProjectAndOpenSchema(page);

    await expect(page).toHaveURL(/\/projects\/[^/]+\/interview$/);
    await expect(page.getByTestId('project-schema-status')).toBeVisible();
    await expect(page.getByTestId('interview-question-selection')).toBeVisible();
    await expect(page.getByText(/active questions selected/)).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Initial Intake round' })).toHaveCount(0);
    await expect(page.getByTestId('create-interview-round-button')).toHaveCount(0);
    await expect(page.getByText(/snapshot questions/)).toHaveCount(0);
  });

  test('keeps an accepted schema and offers only focused round-start recovery after refresh', async ({
    page,
  }) => {
    await createProjectAndOpenSchema(page);
    const projectId = projectIdFromInterviewUrl(page);
    let roundStartRequests = 0;
    await page.route(`**/api/projects/${projectId}/rounds`, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      roundStartRequests += 1;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Controlled round-start failure' }),
      });
    });

    await (await nativeButton(page, 'publish-project-schema-button')).click();
    await expect(page.getByTestId('project-schema-status')).toContainText('Accepted question schema');
    await expect(await nativeButton(page, 'retry-initial-intake-button')).toBeVisible();

    await page.reload();
    await expect(await nativeButton(page, 'retry-initial-intake-button')).toBeVisible();
    await expect(page.getByTestId('publish-project-schema-button')).toHaveCount(0);
    await expect(page.getByTestId('interview-question-selection')).toHaveCount(0);
    await expect(page.getByTestId('create-interview-round-button')).toHaveCount(0);

    await page.unroute(`**/api/projects/${projectId}/rounds`);
    await (await nativeButton(page, 'retry-initial-intake-button')).click();
    await expect(page.getByTestId('active-round-resume-state')).toBeVisible();
    expect(roundStartRequests).toBe(1);
  });

  test('recovers the one created Initial Intake when its response is lost and activation is retried', async ({
    page,
  }) => {
    await createProjectAndOpenSchema(page);
    const projectId = projectIdFromInterviewUrl(page);
    let roundStartRequests = 0;
    let loseFirstResponse = true;
    await page.route(`**/api/projects/${projectId}/rounds`, async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      roundStartRequests += 1;
      if (!loseFirstResponse) {
        await route.continue();
        return;
      }
      loseFirstResponse = false;
      const response = await route.fetch();
      expect(response.status()).toBe(201);
      await route.abort('connectionreset');
    });

    await (await nativeButton(page, 'publish-project-schema-button')).click();
    await expect(await nativeButton(page, 'retry-initial-intake-button')).toBeVisible();
    await (await nativeButton(page, 'retry-initial-intake-button')).click();

    await expect(page.getByTestId('active-round-resume-state')).toBeVisible();
    const activeRound = await page.request.get(`/api/projects/${projectId}/rounds/active`);
    expect(activeRound.status()).toBe(200);
    expect((await activeRound.json() as { id: string }).id).toMatch(/^[0-9a-f-]{36}$/);
    expect(roundStartRequests).toBe(2);
  });

  test('accepts the schema and starts exactly one Initial Intake when activation is repeated', async ({
    page,
  }) => {
    await createProjectAndOpenSchema(page);
    const projectId = projectIdFromInterviewUrl(page);
    let schemaRequests = 0;
    let roundStartRequests = 0;
    page.on('request', (request) => {
      const requestPath = new URL(request.url()).pathname;
      if (request.method() === 'POST' && requestPath === `/api/projects/${projectId}/question-schema`) {
        schemaRequests += 1;
      }
      if (request.method() === 'POST' && requestPath === `/api/projects/${projectId}/rounds`) {
        roundStartRequests += 1;
      }
    });

    const acceptButton = await nativeButton(page, 'publish-project-schema-button');
    await acceptButton.dblclick();

    await expect(page.getByTestId('active-round-resume-state')).toBeVisible();
    await expect(page.getByTestId('project-context-preparation')).toContainText(
      'Initial Intake in progress',
    );
    expect(schemaRequests).toBe(1);
    expect(roundStartRequests).toBe(1);
    const activeRound = await page.request.get(`/api/projects/${projectId}/rounds/active`);
    expect(activeRound.status()).toBe(200);
    expect((await activeRound.json() as { id: string }).id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await countInitialIntakeRounds(projectId)).toBe(1);
  });

  test('serializes concurrent recovery activation to one persisted Initial Intake', async ({
    page,
  }) => {
    await createProjectAndOpenSchema(page);
    const projectId = projectIdFromInterviewUrl(page);
    await page.route(`**/api/projects/${projectId}/rounds`, async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Controlled round-start failure' }),
      });
    });
    await (await nativeButton(page, 'publish-project-schema-button')).click();
    await expect(await nativeButton(page, 'retry-initial-intake-button')).toBeVisible();
    await page.unroute(`**/api/projects/${projectId}/rounds`);

    const responses = await Promise.all([
      page.request.post(`/api/projects/${projectId}/rounds`, {
        data: { type: 'INITIAL_INTAKE' },
      }),
      page.request.post(`/api/projects/${projectId}/rounds`, {
        data: { type: 'INITIAL_INTAKE' },
      }),
    ]);

    expect(responses.map((response) => response.status()).sort()).toEqual([201, 409]);
    expect(await countInitialIntakeRounds(projectId)).toBe(1);
    await page.reload();
    await expect(page.getByTestId('active-round-resume-state')).toBeVisible();
  });

  test('edits and reloads valid Project basics before schema acceptance', async ({ page }) => {
    const { projectId, customerContactEmail } = await createProjectAndOpenSchema(page);
    const updatedName = `Módosított projektindítás ${Date.now()}`;
    const updatedEmail = `updated-project-start-${Date.now()}@example.test`;

    const coordinationUpdate = await page.request.patch(
      `/api/projects/${projectId}/workspace`,
      {
        data: {
          status: 'WAITING_CUSTOMER',
          internalOwnerName: 'Projektindító PO/PM',
          nextActionOwnerRole: null,
          nextAction: null,
          dueAt: null,
        },
      },
    );
    expect(coordinationUpdate.status()).toBe(200);

    await page.getByTestId('edit-project-basics-link').click();
    await expect(page).toHaveURL(new RegExp(`/projects/${projectId}/settings(?:#project-basics)?$`));
    await expect(page.getByTestId('project-basics-editor')).toBeVisible();
    await expect(page.getByTestId('draft-customer-contact-email-input')).toHaveValue(
      customerContactEmail,
    );
    await page.getByTestId('draft-project-name-input').fill(updatedName);
    await page.getByTestId('draft-customer-contact-email-input').fill(updatedEmail);

    const updateResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'PATCH' &&
        new URL(response.url()).pathname === `/api/projects/${projectId}/basics`,
    );
    await (await nativeButton(page, 'save-project-basics')).click();
    expect((await updateResponse).status()).toBe(200);
    await expect(page.getByTestId('project-basics-feedback')).toContainText(
      'Project details have been saved.',
    );

    await page.reload();
    await expect(page.getByTestId('draft-project-name-input')).toHaveValue(updatedName);
    await expect(page.getByTestId('draft-customer-contact-email-input')).toHaveValue(updatedEmail);
  });

  test('keeps the basics command single-flight while an independent archive command stays usable', async ({ page }) => {
    await createProjectAndOpenSchema(page);
    const projectId = projectIdFromInterviewUrl(page);
    await page.getByTestId('edit-project-basics-link').click();

    let releaseBasicsRequest: (() => void) | undefined;
    const basicsRequestIntercepted = new Promise<void>((resolveIntercepted) => {
      void page.route(`**/api/projects/${projectId}/basics`, async (route) => {
        resolveIntercepted();
        await new Promise<void>((resolveRelease) => {
          releaseBasicsRequest = resolveRelease;
        });
        await route.continue();
      });
    });

    await page.getByTestId('draft-project-name-input').fill(`Zárolt mentés ${Date.now()}`);
    await (await nativeButton(page, 'save-project-basics')).click();
    await basicsRequestIntercepted;

    await expect(await nativeButton(page, 'save-project-basics')).toBeDisabled();
    await expect(await nativeButton(page, 'archive-project-button')).toBeEnabled();
    await (await nativeButton(page, 'archive-project-button')).click();
    await expect(page.getByTestId('project-archive-confirmation')).toBeVisible();
    await (await nativeButton(page, 'cancel-project-archive-button')).click();
    releaseBasicsRequest?.();
    await expect(page.getByTestId('project-basics-feedback')).toContainText(
      'Project details have been saved.',
    );
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

  test('blocks Project creation clearly when no published Question Template is available', async ({
    page,
  }) => {
    const initialBankResponse = await page.request.get('/api/settings/base-questions');
    expect(initialBankResponse.status()).toBe(200);
    const activeStableKeys = ((await initialBankResponse.json()) as BaseQuestionBank).questions
      .filter((question) => question.active)
      .map((question) => question.stableKey);

    try {
      await setBaseQuestionActivity(page, activeStableKeys, false);
      await page.goto('/projects/new');
      await page.getByTestId('project-name-input').fill('Unavailable Question Template draft');

      await expect(page.getByTestId('project-question-template-select')).toBeDisabled();
      await expect(page.getByText(
        'Create and publish a Question Template before creating a Project.',
      )).toBeVisible();
      await expect(await nativeButton(page, 'save-project-draft')).toBeDisabled();
      await expect(await nativeButton(page, 'create-project-submit')).toBeDisabled();
      await expect(page.getByTestId('project-name-input')).toHaveValue(
        'Unavailable Question Template draft',
      );
    } finally {
      await setBaseQuestionActivity(page, activeStableKeys, true);
    }
  });
});

async function setBaseQuestionActivity(
  page: Page,
  stableKeys: readonly string[],
  active: boolean,
): Promise<void> {
  for (const stableKey of stableKeys) {
    const currentBankResponse = await page.request.get('/api/settings/base-questions');
    expect(currentBankResponse.status()).toBe(200);
    const currentBank = (await currentBankResponse.json()) as BaseQuestionBank;
    const currentQuestion = currentBank.questions.find(
      (question) => question.stableKey === stableKey,
    );
    if (!currentQuestion) {
      throw new Error(`Base question disappeared while changing its activity: ${stableKey}`);
    }
    const updateResponse = await page.request.patch('/api/settings/base-questions', {
      data: { id: currentQuestion.id, active },
    });
    expect(updateResponse.status()).toBe(200);
  }
}

async function createProjectAndOpenSchema(page: Page) {
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const customerContactEmail = `project-start-${uniquePart}@example.test`;

  await page.goto('/projects/new');

  await expect(page.getByRole('heading', { name: 'New project' })).toBeVisible();
  await page.getByTestId('project-name-input').fill(`Új projekt út ${uniquePart}`);
  await page.getByTestId('internal-owner-name-input').fill('Projektindító PO/PM');
  await page.getByTestId('customer-contact-name-input').fill('Projektindító Kapcsolattartó');
  await page
    .getByTestId('customer-contact-email-input')
    .fill(customerContactEmail);

  const createResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === '/api/projects',
  );
  await (await nativeButton(page, 'create-project-submit')).click();
  expect((await createResponse).status()).toBe(201);
  await expect(page).toHaveURL(/\/projects\/[^/]+\/interview$/);
  return {
    projectId: projectIdFromInterviewUrl(page),
    customerContactEmail,
  };
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

async function countInitialIntakeRounds(projectId: string): Promise<number> {
  const connectionString = process.env['DATABASE_URL'];
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for the persisted round-count assertion.');
  }
  const client = new Client({ connectionString });
  await client.connect();
  try {
    const result = await client.query<{ readonly count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM interview_rounds
       WHERE project_id = $1 AND type = 'INITIAL_INTAKE'`,
      [projectId],
    );
    return Number(result.rows[0]?.count ?? Number.NaN);
  } finally {
    await client.end();
  }
}
