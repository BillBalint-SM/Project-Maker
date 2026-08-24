import { expect, test } from '@playwright/test';

test('renders Project Maker', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('link', { name: 'Project Maker portfolio overview' }),
  ).toBeVisible();
});

test('loads identity-dependent Account settings in test-auth mode', async ({ page }) => {
  await page.goto('/account');

  await expect(page.getByRole('heading', { name: 'Account settings' })).toBeVisible();
  await expect(page.getByText('No active token', { exact: true })).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
