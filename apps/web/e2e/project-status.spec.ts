import { expect, test } from '@playwright/test';

test('shows the server-derived next action and opens the project interview', async ({ page }) => {
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const created = await page.request.post('/api/projects', {
    data: {
      name: `Projektállapot út ${uniquePart}`,
      customerContactName: 'Projektállapot Kapcsolattartó',
      customerContactEmail: `project-status-${uniquePart}@example.test`,
    },
  });
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { readonly id: string };

  await page.goto('/');
  await page.getByTestId(`project-card-${project.id}`).click();
  await expect(page).toHaveURL(`/projects/${project.id}/status`);

  await expect(page.getByRole('heading', { name: 'Projektállapot' })).toBeVisible();
  await expect(page.getByTestId('project-preparation-state')).toHaveText(
    'Kérdésséma szükséges',
  );
  await page.getByTestId('project-preparation-primary-action').click();
  await expect(page).toHaveURL(`/projects/${project.id}/interview`);

  await page.goto(`/projects/${project.id}/readiness`);
  await expect(page.getByRole('heading', { name: 'Felkészültség', exact: true })).toBeVisible();
  await expect(page.getByTestId('readiness-review-card')).toBeVisible();

  await page.goto(`/projects/${project.id}/decision-review`);
  await expect(
    page.getByRole('heading', { name: 'Döntési értékelés', exact: true }),
  ).toBeVisible();
  await expect(page.getByTestId('decision-review-card')).toBeVisible();
});

test('surfaces project coordination and redacted recent activity', async ({ page }) => {
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const created = await page.request.post('/api/projects', {
    data: {
      name: `Projektállapot központ ${uniquePart}`,
      customerContactName: 'Koordinációs Kapcsolattartó',
      customerContactEmail: `status-hub-${uniquePart}@example.test`,
    },
  });
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { readonly id: string };

  const updatedWorkspace = await page.request.patch(`/api/projects/${project.id}/workspace`, {
    data: {
      ballOwner: 'Kovács Anna',
      nextAction: 'Egyeztesd a következő interjú időpontját.',
      dueAt: '2026-08-20T12:00:00.000Z',
      status: 'DRAFT',
    },
  });
  expect(updatedWorkspace.status()).toBe(200);
  const archived = await page.request.post(`/api/projects/${project.id}/archive`);
  expect(archived.status()).toBe(201);

  await page.goto(`/projects/${project.id}/status`);

  await expect(page.getByTestId('project-status-coordination')).toContainText('Kovács Anna');
  await expect(page.getByTestId('project-status-coordination')).toContainText(
    'Egyeztesd a következő interjú időpontját.',
  );
  await expect(page.getByTestId('project-status-coordination')).toContainText('Aug 20, 2026');
  await expect(page.getByTestId('project-status-customer-communication')).toContainText(
    'Koordinációs Kapcsolattartó',
  );
  await expect(page.getByTestId('project-status-activity')).toContainText(
    'A projekt archiválva lett.',
  );
  await expect(page.getByTestId('project-status-activity')).not.toContainText('PROJECT_ARCHIVED');

  await page.getByTestId('project-status-edit-coordination').click();
  await expect(page).toHaveURL(`/projects/${project.id}#workspace`);
  await expect(page.getByTestId('workspace-form')).toBeVisible();

  await page.goto(`/projects/${project.id}/status`);
  await page.getByTestId('project-status-open-customer-communication').click();
  await expect(page).toHaveURL(`/projects/${project.id}#customer-communication`);
  await expect(page.getByTestId('follow-up-card')).toBeVisible();
});
