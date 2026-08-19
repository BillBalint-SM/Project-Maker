import { expect, test } from '@playwright/test';

test('opens the prioritized Active project queue from the Portfolio and follows its public actions', async ({ page }) => {
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const created = await page.request.post('/api/projects', {
    data: {
      name: `Aktív munkasor próba ${uniquePart}`,
      customerContactName: 'Munkasor Kapcsolattartó',
      customerContactEmail: `active-queue-${uniquePart}@example.test`,
      internalOwnerName: 'Kovács Anna',
      nextActionOwnerRole: 'INTERNAL_OWNER',
      nextAction: 'Folytasd a projekt felmérését.',
      dueAt: '2000-01-01T00:00:00.000Z',
    },
  });
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { readonly id: string };

  await page.goto('/');
  await page.getByTestId('active-project-queue-link').click();
  await expect(page).toHaveURL('/projects/active');
  await expect(page.getByRole('heading', { name: 'Aktív munkasor' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Lejárt a következő lépés' })).toBeVisible();

  const projectLink = page.getByTestId(`queue-project-${project.id}`);
  await expect(projectLink).toBeVisible();
  await projectLink.click();
  await expect(page).toHaveURL(`/projects/${project.id}/status`);

  await page.goBack();
  await expect(page).toHaveURL('/projects/active');
  await page.getByTestId(`queue-action-${project.id}`).click();
  await expect(page).toHaveURL(`/projects/${project.id}/interview`);
});
