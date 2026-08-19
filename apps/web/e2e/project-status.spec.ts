import { expect, test } from '@playwright/test';

test('redirects the legacy Project root to the daily status while preserving return context', async ({
  page,
}) => {
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const created = await page.request.post('/api/projects', {
    data: {
      name: `Régi projektút ${uniquePart}`,
      customerContactName: 'Régi út Kapcsolattartó',
      customerContactEmail: `legacy-status-${uniquePart}@example.test`,
      internalOwnerName: 'Régi út PO/PM',
    },
  });
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { readonly id: string };
  const returnTo = '/projects/active?q=fontos';

  await page.goto(`/projects/${project.id}?returnTo=${encodeURIComponent(returnTo)}`);

  await expect(page).toHaveURL(
    `/projects/${project.id}/status?returnTo=${encodeURIComponent(returnTo)}`,
  );
  await expect(page.getByRole('heading', { name: 'Projektállapot' })).toBeVisible();
});

test('resumes schema-required projects directly and keeps the server-derived status available', async ({ page }) => {
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const created = await page.request.post('/api/projects', {
    data: {
      name: `Projektállapot út ${uniquePart}`,
      customerContactName: 'Projektállapot Kapcsolattartó',
      customerContactEmail: `project-status-${uniquePart}@example.test`,
      internalOwnerName: 'Projektstátusz PO/PM',
    },
  });
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { readonly id: string };

  await page.goto('/');
  await page.getByTestId(`project-card-${project.id}`).click();
  await expect(page).toHaveURL(
    new RegExp(`/projects/${project.id}/interview\\?returnTo=`),
  );

  await page.goto(`/projects/${project.id}/status`);

  await expect(page.getByRole('heading', { name: 'Projektállapot' })).toBeVisible();
  await expect(page.getByTestId('project-context-shell')).toContainText(
    'Kérdésséma szükséges',
  );
  await page.getByTestId('project-context-primary-action').click();
  await expect(page).toHaveURL(
    new RegExp(`/projects/${project.id}/interview\\?returnTo=`),
  );

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
      internalOwnerName: 'Kovács Anna',
    },
  });
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { readonly id: string };

  const updatedWorkspace = await page.request.patch(`/api/projects/${project.id}/workspace`, {
    data: {
      internalOwnerName: 'Kovács Anna',
      nextActionOwnerRole: 'INTERNAL_OWNER',
      nextAction: 'Egyeztesd a következő interjú időpontját.',
      dueAt: '2026-08-20T12:00:00.000Z',
      status: 'DRAFT',
    },
  });
  expect(updatedWorkspace.status()).toBe(200);
  const archived = await page.request.post(`/api/projects/${project.id}/archive`);
  expect(archived.status()).toBe(201);
  const restored = await page.request.post(`/api/projects/${project.id}/restore`);
  expect(restored.status()).toBe(201);

  await page.goto(`/projects/${project.id}/status`);

  await expect(page.getByTestId('project-status-coordination')).toContainText('Kovács Anna');
  await expect(page.getByTestId('project-status-coordination')).toContainText(
    'Egyeztesd a következő interjú időpontját.',
  );
  await expect(page.getByTestId('project-status-coordination')).toContainText('2026. 08. 20.');
  await expect(page.getByTestId('project-status-customer-communication')).toContainText(
    'Nincs feldolgozatlan új ügyfélválasz.',
  );
  await expect(page.getByTestId('project-status-activity')).toContainText(
    'A projekt archiválva lett.',
  );
  await expect(page.getByTestId('project-status-activity')).not.toContainText('PROJECT_ARCHIVED');

  await page.getByTestId('project-status-edit-coordination').click();
  await expect(page).toHaveURL(`/projects/${project.id}/status`);
  await expect(page.getByTestId('workspace-form')).toBeVisible();

  await page.goto(`/projects/${project.id}/status`);
  await page.getByTestId('project-status-open-customer-communication').click();
  await expect(page).toHaveURL(`/projects/${project.id}/customer-correspondences`);
  await expect(page.getByTestId('follow-up-card')).toBeVisible();
});

test('keeps lifecycle editing in Project settings and persists the selected state', async ({
  page,
}) => {
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const created = await page.request.post('/api/projects', {
    data: {
      name: `Életciklus-beállítás ${uniquePart}`,
      customerContactName: 'Életciklus Kapcsolattartó',
      customerContactEmail: `lifecycle-settings-${uniquePart}@example.test`,
      internalOwnerName: 'Életciklus PO/PM',
    },
  });
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { readonly id: string };

  await page.goto(`/projects/${project.id}/status`);
  await expect(page.getByTestId('project-lifecycle-status-select')).toHaveCount(0);
  await page.getByTestId('project-context-nav-settings').click();

  const statusSelect = page.getByTestId('project-lifecycle-status-select');
  await statusSelect.click();
  await page.getByRole('option', { name: 'Ügyfélre vár', exact: true }).click();
  const saveResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      response.url().endsWith(`/api/projects/${project.id}/workspace`),
  );
  await page.getByTestId('save-project-lifecycle-status').locator('button').click();
  expect((await saveResponse).status()).toBe(200);
  await expect(page.getByTestId('project-lifecycle-feedback')).toContainText(
    'A projekt életciklus-állapota frissítve lett.',
  );

  await page.reload();
  await expect(page.getByTestId('project-lifecycle-status-select')).toContainText(
    'Ügyfélre vár',
  );
});
