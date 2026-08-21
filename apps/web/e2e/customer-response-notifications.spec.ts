import { expect, test, type APIRequestContext, type Locator, type Page } from '@playwright/test';

test('sends a narrow Customer request, accepts the public response, and clears its review notice', async ({ browser, page, request }) => {
  test.setTimeout(60_000);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await page.goto('/projects/new');
  await page.getByTestId('project-name-input').fill(`Ügyfél-pontosítás ${unique}`);
  await page.getByTestId('internal-owner-name-input').fill('Belső PO');
  await page.getByTestId('customer-contact-name-input').fill('Ügyfél Anna');
  await page.getByTestId('customer-contact-email-input').fill(`response-${unique}@example.test`);
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
  await expect(page.getByTestId('customer-response-requests')).toContainText('Elküldve');

  const link = await latestResponseLink(request);
  const publicContext = await browser.newContext();
  const publicPage = await publicContext.newPage();
  await publicPage.goto(link);
  await expect(publicPage.getByRole('heading', { name: 'Pontosítás a projekthez' })).toBeVisible();
  await publicPage.getByTestId('public-response-answer').first().fill('A pilot ügyfélcsoporttal induljunk.');
  await (await nativeButton(publicPage, 'submit-customer-response')).click();
  await expect(publicPage.getByRole('status')).toContainText('Köszönjük');
  await publicContext.close();

  await page.getByTestId('global-notifications-link').click();
  await expect(page.getByTestId('notification-list')).toContainText('Új ügyfél-pontosítás');
  await page.getByRole('link', { name: 'Megnyitás' }).first().click();
  await expect(page.getByTestId('customer-response-requests')).toContainText('A pilot ügyfélcsoporttal induljunk.');
  await (await nativeButton(page, 'review-customer-response')).click();
  await page.getByTestId('global-notifications-link').click();
  await expect(page.getByTestId('notification-list')).not.toContainText('Új ügyfél-pontosítás');
});

async function latestResponseLink(request: APIRequestContext): Promise<string> {
  const response = await request.get('http://127.0.0.1:25260/__test/sent-messages');
  const messages = await response.json() as Array<{ textContent: string | null }>;
  const link = /(http:\/\/127\.0\.0\.1:4200\/respond#[A-Za-z0-9_-]+)/.exec(messages.at(-1)?.textContent ?? '')?.[1];
  if (!link) throw new Error('A válaszkérő levél hivatkozása hiányzik.');
  return link;
}

async function nativeButton(page: Page, testId: string): Promise<Locator> {
  const host = page.getByTestId(testId);
  const nested = host.locator('button');
  return (await nested.count()) === 1 ? nested : host;
}
