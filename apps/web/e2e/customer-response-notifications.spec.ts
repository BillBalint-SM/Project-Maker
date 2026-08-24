import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

test('sends a narrow Customer request, accepts the public response, and clears its review notice', async ({ browser, page, request }) => {
  test.setTimeout(60_000);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await page.goto('/projects/new');
  await page.getByTestId('project-name-input').fill(`Ügyfél-pontosítás ${unique}`);
  await page.getByTestId('internal-owner-name-input').fill('Belső PO');
  await page.getByTestId('customer-contact-name-input').fill('Ügyfél Anna');
  const customerEmail = `response-${unique}@example.test`;
  await page.getByTestId('customer-contact-email-input').fill(customerEmail);
  await (await nativeButton(page, 'create-project-submit')).click();
  await (await nativeButton(page, 'publish-project-schema-button')).click();
  await expect(page.getByTestId('active-round-resume-state')).toBeVisible();
  const projectId = /\/projects\/([^/]+)/.exec(page.url())?.[1];
  expect(projectId).toBeTruthy();
  const bank = await request.get('/api/settings/base-questions');
  const stableKey = (await bank.json() as { questions: Array<{ stableKey: string }> }).questions[0]!.stableKey;
  const round = await request.post(`/api/projects/${projectId}/rounds`, {
    data: { type: 'STAKEHOLDER', selectedStableKeys: [stableKey] },
  });
  expect(round.ok()).toBe(true);
  await page.goto(`/projects/${projectId}/customer-correspondences`);
  await page.getByTestId('eligible-response-prompt').first().check();
  await (await nativeButton(page, 'preview-customer-response')).click();
  await expect(page.getByTestId('customer-response-preview')).toContainText('Ügyfél Anna');
  await (await nativeButton(page, 'confirm-customer-response')).click();
  await expect(page.getByTestId('customer-response-requests')).toContainText('Sent');
  const notificationCountBeforeResponse = await notificationCount(request);

  let link: string | null = null;
  await expect.poll(async () => {
    link = await responseLinkForRecipient(request, customerEmail);
    return link;
  }, { timeout: 10_000 }).toBeTruthy();
  if (!link) throw new Error('Clarification-request link is missing from the email.');
  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  await publicPage.goto(link);
  await expect(publicPage.getByRole('heading', { name: 'Project clarification' })).toBeVisible();
  await publicPage.getByTestId('public-response-answer').first().fill('A pilot ügyfélcsoporttal induljunk.');
  await (await nativeButton(publicPage, 'submit-customer-response')).click();
  await expect(publicPage.getByRole('status')).toContainText('Thank you');
  await publicContext.close();

  await expect.poll(
    () => notificationCount(request),
    { timeout: 15_000 },
  ).toBe(notificationCountBeforeResponse + 1);
  await page.goto(`/projects/${projectId}/customer-correspondences`);
  await expect(page.getByTestId('customer-response-requests')).toContainText('A pilot ügyfélcsoporttal induljunk.');
  await (await nativeButton(page, 'review-customer-response')).click();
  await expect.poll(
    () => notificationCount(request),
    { timeout: 15_000 },
  ).toBe(notificationCountBeforeResponse);
});

async function notificationCount(request: APIRequestContext): Promise<number> {
  const response = await request.get('/api/notifications');
  const notifications = await response.json() as { totalCount: number };
  return notifications.totalCount;
}

async function responseLinkForRecipient(
  request: APIRequestContext,
  recipient: string,
): Promise<string | null> {
  const response = await request.get('http://127.0.0.1:25260/__test/sent-messages');
  const messages = await response.json() as Array<{
    recipientAddresses: string[];
    textContent: string | null;
  }>;
  const message = messages.findLast((candidate) =>
    candidate.recipientAddresses.includes(recipient),
  );
  return /(http:\/\/127\.0\.0\.1:4200\/respond#[A-Za-z0-9_-]+)/.exec(
    message?.textContent ?? '',
  )?.[1] ?? null;
}

async function nativeButton(page: Page, testId: string): Promise<Locator> {
  const host = page.getByTestId(testId);
  const nested = host.locator('button');
  return (await nested.count()) === 1 ? nested : host;
}
