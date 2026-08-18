import { expect, test } from '@playwright/test';

test('shows mailbox freshness and completes a manual refresh through the real application', async ({
  page,
}) => {
  await page.goto('/');

  await expect(page.getByTestId('mailbox-sync-status')).toContainText(
    'Postafiók kapcsolódása folyamatban',
  );
  await page.getByTestId('refresh-customer-mailbox').locator('button').click();

  await expect(page.getByTestId('mailbox-sync-status')).toContainText('Postafiók naprakész');
  await expect(page.getByText('Utolsó sikeres frissítés:')).not.toContainText('még nem történt');
});
