import { expect, test } from '@playwright/test';

test('runs single-flight manual refreshes and recovers from Graph throttling with bounded backoff', async ({
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

  const beforeRetry = await request.get(`${graphBaseUrl}/__test/mailbox-stats`).then((response) =>
    response.json() as Promise<{ deltaRequests: number }>,
  );
  await request.post(`${graphBaseUrl}/__test/throttle-next-mailbox-delta`);
  const retryStartedAt = Date.now();
  const refreshButton = page.getByTestId('refresh-customer-mailbox').locator('button');
  await refreshButton.click();
  await expect(refreshButton).toBeDisabled();
  await expect(refreshButton).toBeEnabled();
  await expect(page.getByTestId('mailbox-sync-status')).toContainText(
    'Postafiók naprakész',
  );
  const afterRetry = await request.get(`${graphBaseUrl}/__test/mailbox-stats`).then((response) =>
    response.json() as Promise<{ deltaRequests: number }>,
  );
  expect(afterRetry.deltaRequests - beforeRetry.deltaRequests).toBe(2);
  expect(Date.now() - retryStartedAt).toBeGreaterThanOrEqual(900);
  await expect(page.getByTestId('new-project-button')).toBeEnabled();
});
