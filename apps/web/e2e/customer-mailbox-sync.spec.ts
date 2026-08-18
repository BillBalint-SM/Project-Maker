import { expect, test } from '@playwright/test';

test('runs scheduled and single-flight manual mailbox refreshes and isolates Graph failure', async ({
  page,
  request,
}) => {
  await page.goto('/');

  await expect(page.getByTestId('mailbox-sync-status')).toContainText('Postafiók naprakész', {
    timeout: 5_000,
  });
  await expect(page.getByText('Utolsó sikeres frissítés:')).not.toContainText('még nem történt');

  const graphBaseUrl = 'http://127.0.0.1:25260';
  const before = await request.get(`${graphBaseUrl}/__test/mailbox-stats`).then((response) =>
    response.json() as Promise<{ deltaRequests: number }>,
  );
  await request.post(`${graphBaseUrl}/__test/delay-next-mailbox-delta`);
  const refreshes = await Promise.all([
    request.post('/api/customer-mailbox-sync/refresh'),
    request.post('/api/customer-mailbox-sync/refresh'),
  ]);
  expect(refreshes.every((response) => response.ok())).toBe(true);
  const after = await request.get(`${graphBaseUrl}/__test/mailbox-stats`).then((response) =>
    response.json() as Promise<{ deltaRequests: number }>,
  );
  expect(after.deltaRequests - before.deltaRequests).toBe(1);

  await request.post(`${graphBaseUrl}/__test/fail-next-mailbox-delta`);
  await page.getByTestId('refresh-customer-mailbox').locator('button').click();
  await expect(page.getByTestId('mailbox-sync-status')).toContainText(
    'Postafiók átmenetileg nem érhető el',
  );
  await expect(page.getByTestId('new-project-button')).toBeEnabled();
});
