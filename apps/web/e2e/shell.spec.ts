import { expect, test } from '@playwright/test';

test('renders Project Maker', async ({ page }) => {
  await page.goto('/');

  await expect(
    page.getByRole('heading', { name: 'Project Maker' }),
  ).toBeVisible();
});
