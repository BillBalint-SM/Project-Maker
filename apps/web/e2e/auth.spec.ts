import { expect, test } from '@playwright/test';

import { tabTo } from './keyboard-assertions';

test('a belső felhasználó regisztrál, belép az appba, majd kijelentkezik', async ({ page }) => {
  const email = `playwright-${crypto.randomUUID()}@example.test`;

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page).toHaveURL(/\/login\?returnUrl=%2F$/);
  await expect(page.getByRole('heading', { name: 'Bejelentkezés' })).toBeVisible();

  const registration = page.getByRole('button', { name: 'Regisztráció' });
  await tabTo(page, registration);
  await page.keyboard.press('Enter');
  const emailInput = page.getByLabel('E-mail-cím');
  await tabTo(page, emailInput);
  await emailInput.fill(email);
  const passwordInput = page.getByLabel('Jelszó');
  await tabTo(page, passwordInput);
  await passwordInput.fill('playwright-biztonsagos-jelszo-42');
  const createAccount = page.getByRole('button', { name: 'Fiók létrehozása', exact: true });
  await tabTo(page, createAccount);
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('navigation', { name: 'Fő navigáció' })).toBeVisible();
  await expect(page.getByRole('link', { name: email })).toBeVisible();

  const projectResponse = await page.request.post('/api/projects', {
    headers: { Origin: 'http://127.0.0.1:4200' },
    data: {
      name: 'Akadálymentes mintaprojekt',
      customerContactName: 'Minta Ügyfél',
      customerContactEmail: 'minta-ugyfel@example.test',
      internalOwnerName: 'Minta PO',
      nextActionOwnerRole: 'INTERNAL_OWNER',
    },
  });
  expect(projectResponse.status()).toBe(201);
  const project = (await projectResponse.json()) as { readonly id: string };
  await page.goto(`/projects/${project.id}/status`);
  await expect(page.getByRole('heading', { name: 'Projektállapot' })).toBeVisible();
  const skipLink = page.getByRole('link', { name: 'Ugrás a fő tartalomra' });
  await tabTo(page, skipLink);
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  const mainBox = await page.locator('#main-content').boundingBox();
  expect(mainBox?.y ?? 844).toBeLessThan(430);

  await page.reload();
  await expect(page.getByRole('link', { name: email })).toBeVisible();
  await page.getByRole('button', { name: 'Kijelentkezés' }).click();
  await expect(page).toHaveURL('/login');
});
