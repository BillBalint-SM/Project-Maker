import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { expect, test, type Locator, type Page } from '@playwright/test';

const requireFromApi = createRequire(resolve(process.cwd(), '..', 'api', 'package.json'));
const { Client } = requireFromApi('pg') as {
  readonly Client: new (configuration: { readonly connectionString: string }) => DatabaseClient;
};

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

  test('offers a dedicated retry when the first automatic interview start fails', async ({ page }) => {
    await createProjectAndOpenSchema(page);
    const projectId = projectIdFromInterviewUrl(page);
    const clearStartFailure = await installInitialIntakeStartFailure(projectId);

    try {
      const schemaResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          /\/api\/projects\/[^/]+\/question-schema$/.test(new URL(response.url()).pathname),
      );
      const failedStartResponse = page.waitForResponse(
        (response) =>
          response.request().method() === 'POST' &&
          new URL(response.url()).pathname === `/api/projects/${projectId}/rounds`,
      );
      await (await nativeButton(page, 'publish-project-schema-button')).click();
      expect((await schemaResponse).status()).toBe(201);
      expect((await failedStartResponse).status()).toBeGreaterThanOrEqual(500);

      await expect(page.getByTestId('interview-action-error-text')).toContainText(
        'A kérdésséma elfogadva van, de a kezdő interjúkör nem indult el.',
      );
      await expect(page.getByTestId('retry-initial-intake-button')).toBeVisible();
    } finally {
      await clearStartFailure();
    }

    const retriedStartResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname === `/api/projects/${projectId}/rounds`,
    );
    await (await nativeButton(page, 'retry-initial-intake-button')).click();
    expect((await retriedStartResponse).status()).toBe(201);
    await expect(page.getByTestId('active-round-resume-state')).toBeVisible();
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

async function installInitialIntakeStartFailure(projectId: string): Promise<() => Promise<void>> {
  const objectSuffix = requireUuidSuffix(projectId);
  const triggerName = `e2e_initial_start_${objectSuffix}`;
  const functionName = `e2e_initial_start_${objectSuffix}`;
  const client = new Client({ connectionString: requireE2eDatabaseUrl() });
  await client.connect();
  try {
    await client.query(`
      CREATE FUNCTION ${functionName}()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      BEGIN
        IF NEW.project_id = '${projectId}'::uuid THEN
          RAISE EXCEPTION 'E2E configured initial intake start failure';
        END IF;
        RETURN NEW;
      END;
      $$;
    `);
    await client.query(`
      CREATE TRIGGER ${triggerName}
      BEFORE INSERT ON interview_rounds
      FOR EACH ROW
      EXECUTE FUNCTION ${functionName}();
    `);
  } catch (error) {
    await client.end();
    throw error;
  }

  return async () => {
    try {
      await client.query(`DROP TRIGGER IF EXISTS ${triggerName} ON interview_rounds`);
      await client.query(`DROP FUNCTION IF EXISTS ${functionName}()`);
    } finally {
      await client.end();
    }
  };
}

function requireUuidSuffix(projectId: string): string {
  const uuidSuffix = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i
    .exec(projectId)?.[0]
    ?.replaceAll('-', '');
  if (!uuidSuffix) {
    throw new Error(`The project-start browser test expected a UUID project ID: ${projectId}`);
  }
  return uuidSuffix;
}

function requireE2eDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for the project-start browser tests.');
  }
  const databaseName = new URL(databaseUrl).pathname.slice(1).toLowerCase();
  if (!databaseName.includes('e2e') && !databaseName.includes('test')) {
    throw new Error('The project-start browser tests require an isolated E2E/test database.');
  }
  return databaseUrl;
}

interface DatabaseClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(sql: string, parameters?: readonly unknown[]): Promise<unknown>;
}
