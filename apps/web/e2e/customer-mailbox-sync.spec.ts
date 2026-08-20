import { expect, test, type APIRequestContext } from '@playwright/test';

test('runs single-flight manual refreshes and recovers from a bounded temporary IMAP failure', async ({
  page,
  request,
}) => {
  const gatewayFixtureUrl = `http://127.0.0.1:${process.env.MAIL_GATEWAY_FIXTURE_PORT ?? '25260'}`;
  await request.post(`${gatewayFixtureUrl}/__test/reset`);
  await request.post('/api/customer-mailbox-sync/refresh');
  await page.goto('/');

  await expect(page.getByTestId('mailbox-sync-status')).toContainText('Postafiók naprakész', {
    timeout: 5_000,
  });
  await expect(page.getByText('Utolsó sikeres frissítés:')).not.toContainText('még nem történt');

  const before = await request.get(`${gatewayFixtureUrl}/__test/mailbox-stats`).then((response) =>
    response.json() as Promise<{ readAttempts: number }>,
  );
  await queueMailboxProbe(request, gatewayFixtureUrl, 'single-flight');
  await request.post(`${gatewayFixtureUrl}/__test/delay-next-read`);
  const refreshes = await Promise.all([
    request.post('/api/customer-mailbox-sync/refresh'),
    request.post('/api/customer-mailbox-sync/refresh'),
  ]);
  expect(refreshes.every((response) => response.ok())).toBe(true);
  const after = await request.get(`${gatewayFixtureUrl}/__test/mailbox-stats`).then((response) =>
    response.json() as Promise<{ readAttempts: number }>,
  );
  expect(after.readAttempts - before.readAttempts).toBe(1);

  const beforeRetry = await request.get(`${gatewayFixtureUrl}/__test/mailbox-stats`).then((response) =>
    response.json() as Promise<{ readAttempts: number }>,
  );
  await queueMailboxProbe(request, gatewayFixtureUrl, 'retry');
  await request.post(`${gatewayFixtureUrl}/__test/fail-next-read`);
  await request.post(`${gatewayFixtureUrl}/__test/delay-next-read`);
  const retryStartedAt = Date.now();
  const refreshButton = page.getByTestId('refresh-customer-mailbox').locator('button');
  await refreshButton.click();
  await expect(refreshButton).toBeDisabled();
  await expect(refreshButton).toBeEnabled();
  await expect(page.getByTestId('mailbox-sync-status')).toContainText(
    'Postafiók naprakész',
  );
  const afterRetry = await request.get(`${gatewayFixtureUrl}/__test/mailbox-stats`).then((response) =>
    response.json() as Promise<{ readAttempts: number }>,
  );
  expect(afterRetry.readAttempts - beforeRetry.readAttempts).toBe(2);
  expect(Date.now() - retryStartedAt).toBeGreaterThanOrEqual(100);
  await expect(page.getByTestId('new-project-button')).toBeEnabled();
});

async function queueMailboxProbe(
  request: APIRequestContext,
  gatewayFixtureUrl: string,
  label: string,
): Promise<void> {
  const response = await request.post(`${gatewayFixtureUrl}/__test/queue-imap-message`, {
    data: {
      internetMessageId: `<mailbox-sync-${label}@example.test>`,
      senderAddress: 'mailbox-sync@example.test',
      recipientAddresses: ['project-maker@pte.hu'],
      subject: `Mailbox sync ${label}`,
      textContent: `Mailbox sync probe ${label}.`,
      receivedAt: '2026-08-20T08:00:00.000Z',
    },
  });
  expect(response.ok()).toBe(true);
}
