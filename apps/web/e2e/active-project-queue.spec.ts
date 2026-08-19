import { expect, test } from '@playwright/test';

test('searches and filters the Active project queue with reload-safe replace-history state', async ({ page }) => {
  const uniquePart = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const created = await page.request.post('/api/projects', {
    data: {
      name: `Árvíztűrő munkasor ${uniquePart}`,
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
  const ordinary = await page.request.post('/api/projects', {
    data: {
      name: `Árvíztűrő munkasor ${uniquePart} később`,
      customerContactName: 'Munkasor Kapcsolattartó',
      customerContactEmail: `active-queue-later-${uniquePart}@example.test`,
      internalOwnerName: 'Kovács Anna',
    },
  });
  expect(ordinary.status()).toBe(201);
  const ordinaryProject = (await ordinary.json()) as { readonly id: string };

  await page.goto('/');
  await page.getByTestId('active-project-queue-link').click();
  await expect(page).toHaveURL('/projects/active');
  await expect(page.getByRole('heading', { name: 'Aktív munkasor' })).toBeVisible();
  await page.getByTestId('queue-search').fill(`  ARVIZTURO MUNKASOR ${uniquePart.toUpperCase()}  `);

  const projectLink = page.getByTestId(`queue-project-${project.id}`);
  await expect(projectLink).toBeVisible();
  await expect(page.getByTestId(`queue-project-${ordinaryProject.id}`)).toBeVisible();
  await page.getByLabel('Lejárt', { exact: true }).check();
  await expect(projectLink).toBeVisible();
  await expect(page.getByTestId(`queue-project-${ordinaryProject.id}`)).toHaveCount(0);
  await expect(page).toHaveURL(/q=ARVIZTURO(?:%20|\+)MUNKASOR/);
  await expect(page).toHaveURL(/urgency=OVERDUE/);

  await page.reload();
  await expect(page.getByTestId('queue-search')).toHaveValue(`ARVIZTURO MUNKASOR ${uniquePart.toUpperCase()}`);
  await expect(page.getByLabel('Lejárt', { exact: true })).toBeChecked();
  await expect(projectLink).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL('/');
});

test('pages through one urgency group with history and recovers an obsolete cursor URL', async ({ page }) => {
  const uniquePart = `cursor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  for (let index = 0; index < 11; index += 1) {
    const created = await page.request.post('/api/projects', {
      data: {
        name: `${uniquePart} ${String(index).padStart(2, '0')}`,
        customerContactName: 'Munkasor Kapcsolattartó',
        customerContactEmail: `${uniquePart}-${index}@example.test`,
        internalOwnerName: 'Kovács Anna',
        dueAt: '2000-01-01T00:00:00.000Z',
      },
    });
    expect(created.status()).toBe(201);
  }

  await page.goto('/projects/active');
  await page.getByTestId('queue-search').fill(uniquePart);
  await expect(page).toHaveURL(new RegExp(`q=${uniquePart}`));
  await expect(page.locator('.queue-row')).toHaveCount(10);
  await expect(page.getByRole('heading', { name: 'Lejárt a következő lépés' })).toBeVisible();
  await page.getByTestId('queue-next-page').click();
  await expect(page).toHaveURL(/cursor=/);
  await expect(page.locator('.queue-row')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Lejárt a következő lépés' })).toBeVisible();

  await page.goBack();
  await expect(page).not.toHaveURL(/cursor=/);
  await expect(page.getByTestId('queue-search')).toHaveValue(uniquePart);
  await expect(page.locator('.queue-row')).toHaveCount(10);

  await page.goto(`/projects/active?q=${encodeURIComponent(uniquePart)}&cursor=invalid`);
  await expect(page).not.toHaveURL(/cursor=/);
  await expect(page.getByTestId('queue-cursor-recovery')).toContainText(
    'A korábbi oldal már nem állítható helyre. Az első oldalt mutatjuk.',
  );
  await expect(page.locator('.queue-row')).toHaveCount(10);
});
