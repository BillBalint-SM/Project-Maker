import { expect, test } from '@playwright/test';

import { tabTo } from './keyboard-assertions';

test('an Internal user creates an account, enters the application, and signs out', async ({ page }) => {
  const email = `playwright-${crypto.randomUUID()}@example.test`;

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto('/');
  await expect(page).toHaveURL(/\/login\?returnUrl=%2F$/);
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();

  const registration = page.getByRole('button', { name: 'Create account' });
  await tabTo(page, registration);
  await page.keyboard.press('Enter');
  const emailInput = page.getByLabel('Email address');
  await tabTo(page, emailInput);
  await emailInput.fill(email);
  const passwordInput = page.getByLabel('Password');
  await tabTo(page, passwordInput);
  await passwordInput.fill('playwright-biztonsagos-jelszo-42');
  const createAccount = page.locator('form').getByRole('button', {
    name: 'Create account',
    exact: true,
  });
  await tabTo(page, createAccount);
  await page.keyboard.press('Enter');

  await expect(page).toHaveURL('/');
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
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
  await expect(page.getByRole('heading', { name: 'Project status' })).toBeVisible();
  const skipLink = page.getByRole('link', { name: 'Skip to main content' });
  await tabTo(page, skipLink);
  await page.keyboard.press('Enter');
  await expect(page.locator('#main-content')).toBeFocused();
  const mainBox = await page.locator('#main-content').boundingBox();
  expect(mainBox?.y ?? 844).toBeLessThan(430);

  await page.reload();
  await expect(page.getByRole('link', { name: email })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/login');
});
