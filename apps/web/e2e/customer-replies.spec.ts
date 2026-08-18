import { expect, test, type APIRequestContext } from '@playwright/test';

test('surfaces one safe token-correlated Customer reply across global and Portfolio views', async ({ page, request }) => {
  await request.post('/api/customer-mailbox-sync/refresh');
  const setup = await createSentHandoff(request);
  const graphBaseUrl = 'http://127.0.0.1:25260';
  const sent = await request.get(`${graphBaseUrl}/__test/messages`).then((response) => response.json()) as Array<{
    message: { replyTo: Array<{ emailAddress: { address: string } }> };
  }>;
  const replyToAddress = sent.at(-1)?.message.replyTo[0]?.emailAddress.address;
  expect(replyToAddress).toBeTruthy();
  await request.post(`${graphBaseUrl}/__test/queue-mailbox-message`, { data: {
    id: `playwright-reply-${Date.now()}`,
    internetMessageId: '<playwright-reply@example.test>',
    from: { emailAddress: { address: setup.customerEmail } },
    toRecipients: [{ emailAddress: { address: replyToAddress } }],
    subject: 'Re: Projektösszefoglaló',
    body: { contentType: 'html', content: '<p>Mehet tovább.</p><script>steal()</script><p>On Monday wrote:</p><blockquote>Korábbi tartalom</blockquote>' },
    receivedDateTime: '2026-08-18T18:00:00.000Z',
    attachments: [{ name: 'scope.pdf', contentType: 'application/pdf', size: 2048 }],
  } });
  await request.post('/api/customer-mailbox-sync/refresh');

  await page.goto('/');
  await expect(page.getByTestId('global-customer-reply-count')).toContainText('(1)');
  await expect(page.getByTestId(`project-reply-count-${setup.projectId}`)).toContainText('1 új Customer válasz');
  await page.getByTestId(`project-card-${setup.projectId}`).click();
  await expect(page).toHaveURL(new RegExp(`/projects/${setup.projectId}/customer-correspondences$`));
  await expect(page.getByText('Mehet tovább.')).toBeVisible();
  await expect(page.locator('.inbound-message script')).toHaveCount(0);
  await expect(page.getByText('scope.pdf')).toBeVisible();
  const history = page.getByText('Korábbi idézett levelezés');
  await expect(history).toBeVisible();
  await expect(history.locator('xpath=..')).not.toHaveAttribute('open');
});

async function createSentHandoff(request: APIRequestContext) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const customerEmail = `customer-${suffix}@example.test`;
  const project = await request.post('/api/projects', { data: {
    name: `Customer reply ${suffix}`,
    customerContactName: 'Ügyfél Anna',
    customerContactEmail: customerEmail,
    internalOwnerName: 'PO Péter',
    nextActionOwnerRole: 'CUSTOMER_CONTACT',
  } }).then((response) => response.json()) as { id: string };
  const bank = await request.get('/api/settings/base-questions').then((response) => response.json()) as { questions: Array<{ stableKey: string }> };
  await request.post(`/api/projects/${project.id}/question-schema`, { data: { questions: [{ stableKey: bank.questions[0]?.stableKey, required: true, blocking: true }] } });
  const round = await request.post(`/api/projects/${project.id}/rounds`, { data: { type: 'INITIAL_INTAKE' } }).then((response) => response.json()) as { id: string };
  await request.post(`/api/projects/${project.id}/rounds/${round.id}/finish`, { data: {} });
  const handoffs = await request.get(`/api/projects/${project.id}/rounds/${round.id}/customer-handoffs`).then((response) => response.json()) as Array<{ id: string }>;
  const handoffId = handoffs[0]?.id;
  const preview = await request.post(`/api/projects/${project.id}/rounds/${round.id}/customer-handoffs/${handoffId}/preview`, {
    data: { mode: 'CUSTOM', name: 'PO Péter', address: 'po.peter@pte.hu' },
  }).then((response) => response.json()) as { sourceContentVersion: number; previewDigest: string; senderName: string; senderAddress: string };
  const sent = await request.post(`/api/projects/${project.id}/rounds/${round.id}/customer-handoffs/${handoffId}/send`, { data: {
    sourceContentVersion: preview.sourceContentVersion,
    previewDigest: preview.previewDigest,
    senderName: preview.senderName,
    senderAddress: preview.senderAddress,
  } });
  expect(sent.ok()).toBe(true);
  return { projectId: project.id, customerEmail };
}
