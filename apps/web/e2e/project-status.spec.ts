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
