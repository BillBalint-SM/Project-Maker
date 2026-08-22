import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

const apiOrigin = 'http://127.0.0.1:3000';

interface ProjectWorkspace {
  readonly id: string;
}

async function createProject(request: APIRequestContext, name: string): Promise<ProjectWorkspace> {
  const response = await request.post(`${apiOrigin}/projects`, {
    data: {
      name,
      customerContactName: 'Deletion E2E Contact',
      customerContactEmail: `delete-${Date.now()}@example.test`,
      internalOwnerName: 'Delete Test PO/PM',
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()) as ProjectWorkspace;
}

function nativeButton(page: Page, testId: string): Locator {
  return page.getByTestId(testId).locator('button');
}

test('does not send DELETE when the user cancels', async ({ page, request }) => {
  const project = await createProject(request, 'Cancel deletion');
  let deleteCount = 0;
  page.on('request', (requestEvent) => {
    if (
      requestEvent.method() === 'DELETE' &&
      requestEvent.url().includes(`/api/projects/${project.id}`)
    ) {
      deleteCount += 1;
    }
  });

  await page.goto(`/projects/${project.id}/settings`);
  await nativeButton(page, 'delete-project-button').click();
  await expect(page.getByTestId('project-delete-confirmation')).toBeVisible();
  await expect(nativeButton(page, 'cancel-project-delete-button')).toBeFocused();
  await nativeButton(page, 'cancel-project-delete-button').click();
  expect(deleteCount).toBe(0);
});

test('deletes an eligible draft and returns to the list', async ({ page, request }) => {
  const project = await createProject(request, 'Confirm deletion');
  await page.goto(`/projects/${project.id}/settings`);
  await nativeButton(page, 'delete-project-button').click();
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' &&
      response.url().includes(`/api/projects/${project.id}`),
  );
  await nativeButton(page, 'confirm-project-delete-button').click();
  expect((await deleteResponse).status()).toBe(204);
  await expect(page).toHaveURL(/\/$/);
  expect((await request.get(`${apiOrigin}/projects/${project.id}/work-state`)).status()).toBe(404);
});

test('keeps stale Project settings open after a server-side delete conflict', async ({ page, request }) => {
  const project = await createProject(request, 'Stale deletion conflict');
  await page.goto(`/projects/${project.id}/settings`);
  await nativeButton(page, 'delete-project-button').click();
  expect(
    (
      await request.patch(`${apiOrigin}/projects/${project.id}/workspace`, {
        data: { status: 'WAITING_INTERNAL' },
      })
    ).status(),
  ).toBe(200);

  const deleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' &&
      response.url().includes(`/api/projects/${project.id}`),
  );
  await nativeButton(page, 'confirm-project-delete-button').click();
  expect((await deleteResponse).status()).toBe(409);
  await expect(page).toHaveURL(new RegExp(`/projects/${project.id}/settings$`));
  await expect(page.getByTestId('project-settings-action-error')).toContainText(
    'Csak DRAFT projekt törölhető. Ügyfélkommunikációs vagy Git-átadási előzmény esetén archiváld a projektet.',
  );
  await expect(page.getByTestId('project-settings-action-error')).not.toContainText(
    /PostgreSQL|customer_follow_ups|audit_events|stack/i,
  );
});

test('hides deletion for non-DRAFT Project settings', async ({ page, request }) => {
  const project = await createProject(request, 'Hidden non-draft deletion');
  expect(
    (
      await request.patch(`${apiOrigin}/projects/${project.id}/workspace`, {
        data: { status: 'WAITING_INTERNAL' },
      })
    ).status(),
  ).toBe(200);
  await page.goto(`/projects/${project.id}/settings`);
  await expect(page.getByTestId('delete-project-button')).toHaveCount(0);
});
