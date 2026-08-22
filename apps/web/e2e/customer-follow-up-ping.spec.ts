import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

import {
  correspondenceMailboxAddress,
  correspondenceMailboxIdentity,
  correspondenceMailboxName,
  correspondenceReplyToPattern,
} from './mail-gateway-test-identity';

const gatewayFixtureUrl =
  `http://127.0.0.1:${process.env.MAIL_GATEWAY_FIXTURE_PORT ?? '25260'}`;

test('reviews and sends one Customer reminder, then surfaces its correlated reply', async ({
  page,
  request,
}) => {
  await request.post(`${gatewayFixtureUrl}/__test/reset`);
  await request.post('/api/customer-mailbox-sync/refresh');

  const project = await createProject(request);
  const reference = await apiJson<{ id: string }>(
    request,
    'POST',
    `/projects/${project.id}/discovery-follow-ups`,
    {
      category: 'BUSINESS',
      question: 'Melyik jóváhagyás hiányzik?',
      owner: 'Belső Tulajdonos',
      dueDate: '2026-09-15',
      nextStep: 'Az ügyfél elküldi a jóváhagyást.',
    },
  );

  await page.goto(`/projects/${project.id}/customer-correspondences`);
  const message = 'Kérlek, küldd el a hiányzó üzleti jóváhagyást.';
  await page.getByTestId('follow-up-message-draft').fill(message);
  await page.getByTestId('follow-up-reference-select').selectOption(reference.id);
  await nativeButton(page, 'save-follow-up-draft-button').click();
  await expect(page.getByTestId('follow-up-draft-feedback')).toContainText('Customer follow-up draft saved');

  const previewTrigger = nativeButton(page, 'preview-follow-up-ping-button');
  await previewTrigger.click();
  const preview = page.getByRole('alertdialog', { name: 'Customer follow-up preview' });
  await expect(preview).toContainText(project.customerContactEmail);
  await expect(preview).toContainText(correspondenceMailboxIdentity);
  await expect(preview).toContainText(message);
  await expect(preview).toContainText('Question: Melyik jóváhagyás hiányzik?');
  await expect(preview).not.toContainText('Belső Tulajdonos');
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(previewTrigger).toBeFocused();

  await previewTrigger.click();
  await page.getByRole('button', { name: 'Send to Customer' }).click();
  await expect(page.getByTestId('follow-up-send-result')).toContainText(
    'Accepted by the mail system for delivery',
  );

  const submission = (await sentMessages(request)).at(-1);
  expect(submission).toMatchObject({
    envelope: { from: correspondenceMailboxAddress },
    from: {
      name: correspondenceMailboxName,
      address: correspondenceMailboxAddress,
    },
  });
  expect(submission?.textContent).toContain(message);
  expect(submission?.replyToAddress).toMatch(correspondenceReplyToPattern());

  await queueImapMessage(request, {
    internetMessageId: `<customer-reply-${Date.now()}@example.test>`,
    senderAddress: project.customerContactEmail,
    recipientAddresses: [submission?.replyToAddress],
    subject: 'Re: Ügyfél-emlékeztető',
    textContent: 'A hiányzó jóváhagyást elküldtük.',
    receivedAt: new Date().toISOString(),
  });
  await request.post('/api/customer-mailbox-sync/refresh');
  await page.reload();

  await expect(page.getByText('A hiányzó jóváhagyást elküldtük.')).toBeVisible();
  await expect(page.getByText('1 unread message')).toBeVisible();
  await expect(page.getByRole('link', {
    name: 'Review related Discovery follow-up',
  })).toBeVisible();
});

async function createProject(
  request: APIRequestContext,
): Promise<{ readonly id: string; readonly customerContactEmail: string }> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return apiJson(request, 'POST', '/projects', {
    name: `Customer ping ${suffix}`,
    customerContactName: 'Ügyfél Anna',
    customerContactEmail: `customer-ping-${suffix}@example.test`,
    internalOwnerName: 'PO Péter',
    nextActionOwnerRole: 'CUSTOMER_CONTACT',
  });
}

async function apiJson<T>(
  request: APIRequestContext,
  method: 'POST',
  path: string,
  data?: unknown,
): Promise<T> {
  const response = await request.fetch(`/api${path}`, { method, data });
  expect(response.ok(), `${method} ${path} returned ${response.status()}`).toBeTruthy();
  return response.json() as Promise<T>;
}

function nativeButton(page: Page, testId: string) {
  return page.getByTestId(testId).locator('button');
}

interface SentMessage {
  readonly envelope?: { readonly from?: string | null };
  readonly from?: { readonly name?: string; readonly address?: string } | null;
  readonly replyToAddress?: string | null;
  readonly textContent?: string | null;
}

async function sentMessages(request: APIRequestContext): Promise<SentMessage[]> {
  const response = await request.get(`${gatewayFixtureUrl}/__test/sent-messages`);
  return response.json() as Promise<SentMessage[]>;
}

async function queueImapMessage(
  request: APIRequestContext,
  message: unknown,
): Promise<void> {
  const response = await request.post(
    `${gatewayFixtureUrl}/__test/queue-imap-message`,
    { data: message },
  );
  expect(response.ok()).toBeTruthy();
}
