import { expect, test, type APIRequestContext } from '@playwright/test';

const graphBaseUrl = 'http://127.0.0.1:25260';

test.beforeEach(async ({ request }) => {
  await request.post(`${graphBaseUrl}/__test/reset`);
  await request.post('/api/customer-mailbox-sync/refresh');
});

test('surfaces one safe token-correlated Customer reply across global and Portfolio views', async ({ page, request }) => {
  const setup = await createSentHandoff(request);
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
  const mailboxStats = await request.get(`${graphBaseUrl}/__test/mailbox-stats`)
    .then((response) => response.json()) as { preferHeaders: Array<string | null> };
  expect(mailboxStats.preferHeaders).toContain('IdType="ImmutableId"');

  await page.goto('/');
  await expect(page.getByTestId('global-customer-reply-count')).toHaveText('1');
  const portfolioCard = page.getByTestId(`project-card-${setup.projectId}`);
  await expect(page.getByTestId(`project-reply-count-${setup.projectId}`)).toContainText('1 új ügyfélválasz');
  await expect(portfolioCard).toContainText('Új ügyfélválasz');
  await expect(portfolioCard).toContainText('Ügyféllevelezés megnyitása');
  await portfolioCard.click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === `/projects/${setup.projectId}/customer-correspondences` &&
      url.searchParams.get('returnTo') === '/',
  );
  await expect(page.getByText('Mehet tovább.')).toBeVisible();
  await expect(page.locator('.inbound-message script')).toHaveCount(0);
  await expect(page.getByText('scope.pdf')).toBeVisible();
  const history = page.getByText('Korábbi idézett levelezés');
  await expect(history).toBeVisible();
  await expect(history.locator('xpath=..')).not.toHaveAttribute('open');

  await page.getByRole('button', { name: 'Lezárás' }).click();
  await expect(page.getByRole('alert')).toContainText('Töltsd újra az adatokat');
  await expect(page.getByText('Mehet tovább.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ügyféllevelezés újratöltése' })).toBeVisible();
  await page.getByRole('button', { name: 'Ügyféllevelezés újratöltése' }).click();
  await expect(page.getByText('Mehet tovább.')).toBeVisible();

  await page.getByRole('button', { name: 'Átnéztem' }).click();
  await expect(page.getByText('0 olvasatlan üzenet')).toBeVisible();
  await expect(page.getByTestId('global-customer-reply-count')).toHaveCount(0);
  const classification = page.getByLabel('Kézi besorolás');
  await classification.selectOption('Módosítást kér');
  await expect(classification).toHaveValue('Módosítást kér');
  await page.getByRole('button', { name: 'Új összefoglaló-verzió készítése' }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === `/projects/${setup.projectId}/interview` &&
      url.searchParams.get('roundId') === setup.roundId &&
      url.searchParams.get('returnTo') === '/' &&
      url.hash === '#customer-handoff',
  );
  await expect(page.getByTestId('handoff-modification-summary')).toBeVisible();
  await page.goto(`/projects/${setup.projectId}/customer-correspondences`);
  await page.getByRole('button', { name: 'Feldolgozás megkezdése' }).click();
  await expect(page.getByRole('heading', { name: 'Feldolgozás alatt' })).toBeVisible();
  await page.getByRole('button', { name: 'Lezárás' }).click();
  await expect(page.getByRole('heading', { name: 'Lezárva' })).toBeVisible();

  await request.post(`${graphBaseUrl}/__test/queue-mailbox-message`, { data: {
    id: `playwright-late-reply-${Date.now()}`,
    from: { emailAddress: { address: setup.customerEmail } },
    toRecipients: [{ emailAddress: { address: replyToAddress } }],
    subject: 'Re: Projektösszefoglaló',
    body: { contentType: 'text', content: 'Újabb Customer válasz.' },
    receivedDateTime: '2026-08-18T18:30:00.000Z',
  } });
  await request.post('/api/customer-mailbox-sync/refresh');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Új válasz' })).toBeVisible();
  await expect(page.getByText('1 olvasatlan üzenet')).toBeVisible();
  await expect(page.getByText('Újabb Customer válasz.')).toBeVisible();
  await expect(page.getByLabel('Kézi besorolás').first()).toHaveValue('Módosítást kér');
});

test('opens the exact ping source without resolving it and retains UNKNOWN evidence through archive and restore', async ({ page, request }) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const customerEmail = `ping-outcome-${suffix}@example.test`;
  const project = await request.post('/api/projects', { data: {
    name: `Ping outcome ${suffix}`,
    customerContactName: 'Ügyfél Anna',
    customerContactEmail: customerEmail,
    internalOwnerName: 'PO Péter',
    nextActionOwnerRole: 'CUSTOMER_CONTACT',
  } }).then((response) => response.json()) as { id: string };
  const followUp = await request.post(`/api/projects/${project.id}/discovery-follow-ups`, { data: {
    category: 'BUSINESS',
    question: 'Melyik jóváhagyás hiányzik?',
    owner: 'PO Péter',
    dueDate: '2026-09-15',
    nextStep: 'Az ügyfél pontosítja a jóváhagyást.',
  } }).then((response) => response.json()) as { id: string; status: string };
  await request.patch(`/api/projects/${project.id}/follow-up/draft`, { data: {
    messageDraft: 'Kérlek, pontosítsd a hiányzó jóváhagyást.',
    referencedFollowUpId: followUp.id,
    expectedVersion: 1,
  } });
  const preview = await request.post(`/api/projects/${project.id}/follow-up/ping/preview`, { data: {
    expectedVersion: 2,
  } }).then((response) => response.json()) as { previewToken: string };
  await request.post(`${graphBaseUrl}/__test/unknown-next`);
  const unknown = await request.post(`/api/projects/${project.id}/follow-up/ping`, { data: {
    previewToken: preview.previewToken,
  } });
  expect(unknown.status()).toBe(503);
  const sent = await request.get(`${graphBaseUrl}/__test/messages`).then((response) => response.json()) as Array<{
    message: { replyTo: Array<{ emailAddress: { address: string } }> };
  }>;
  const replyToAddress = sent.at(-1)?.message.replyTo[0]?.emailAddress.address;
  expect(replyToAddress).toBeTruthy();
  await queueReply(request, `unknown-ping-${suffix}`, customerEmail, replyToAddress!, 'Átvettük, pontosítjuk.');
  await request.post('/api/customer-mailbox-sync/refresh');

  await page.goto(`/projects/${project.id}/customer-correspondences`);
  await expect(page.getByTestId('unknown-delivery-receipt-evidence')).toContainText(
    'igazolja az átvételt',
  );
  await page.getByRole('link', { name: 'Kapcsolódó tisztázási tétel áttekintése' }).click();
  await expect(page).toHaveURL(new RegExp(`reviewFollowUpId=${followUp.id}`));
  await expect(page.getByTestId('reply-review-context')).toContainText(
    'nem módosította és nem zárta le',
  );
  const afterReview = await request.get(`/api/projects/${project.id}/discovery-follow-ups`)
    .then((response) => response.json()) as Array<{ id: string; status: string; version: number }>;
  expect(afterReview.find((item) => item.id === followUp.id)?.status).toBe(followUp.status);
  expect(afterReview.find((item) => item.id === followUp.id)?.version).toBe(1);

  await request.post(`/api/projects/${project.id}/archive`);
  await queueReply(request, `archived-ping-${suffix}`, customerEmail, replyToAddress!, 'Archiválás után érkezett válasz.');
  await request.post('/api/customer-mailbox-sync/refresh');
  await page.goto(`/projects/${project.id}/customer-correspondences`);
  await expect(page.getByText('Archiválás után érkezett válasz.')).toBeVisible();
  await expect(page.getByLabel('Kézi besorolás').first()).toBeDisabled();
  await request.post(`/api/projects/${project.id}/restore`);
  await page.reload();
  await expect(page.getByLabel('Kézi besorolás').first()).toBeEnabled();
  await expect(page.getByText('2 olvasatlan üzenet')).toBeVisible();
  await expect(page.getByTestId('unknown-delivery-receipt-evidence')).toBeVisible();
});

test('triages unmatched mail and separates automated mailbox events without creating false replies', async ({ page, request }) => {
  const setup = await createSentHandoff(request);
  const sent = await request.get(`${graphBaseUrl}/__test/messages`).then((response) => response.json()) as Array<{
    message: { replyTo: Array<{ emailAddress: { address: string } }> };
  }>;
  const replyToAddress = sent.at(-1)?.message.replyTo[0]?.emailAddress.address;
  expect(replyToAddress).toBeTruthy();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const messages = [
    {
      id: `unmatched-${suffix}`,
      from: { emailAddress: { address: setup.customerEmail } },
      toRecipients: [{ emailAddress: { address: 'project-maker@pte.hu' } }],
      subject: 'Kézzel társítandó levél',
      body: { contentType: 'text', content: 'Ezt a levelet a megfelelő projekthez kell kapcsolni.' },
      receivedDateTime: '2026-08-18T19:00:00.000Z',
    },
    {
      id: `unknown-automation-${suffix}`,
      from: { emailAddress: { address: 'automation@example.test' } },
      toRecipients: [{ emailAddress: { address: replyToAddress } }],
      subject: 'Ellenőrzendő automatikus levél',
      body: { contentType: 'text', content: 'Bizonytalan automatikus tartalom.' },
      receivedDateTime: '2026-08-18T19:01:00.000Z',
      internetMessageHeaders: [{ name: 'Auto-Submitted', value: 'auto-generated' }],
    },
    {
      id: `dsn-${suffix}`,
      from: { emailAddress: { address: 'mailer-daemon@example.test' } },
      toRecipients: [{ emailAddress: { address: replyToAddress } }],
      subject: 'Delivery status',
      body: { contentType: 'text', content: 'Nem kézbesített belső részlet.' },
      receivedDateTime: '2026-08-18T19:02:00.000Z',
      internetMessageHeaders: [{ name: 'Content-Type', value: 'multipart/report; report-type=delivery-status' }],
    },
    {
      id: `ooo-${suffix}`,
      from: { emailAddress: { address: setup.customerEmail } },
      toRecipients: [{ emailAddress: { address: replyToAddress } }],
      subject: 'Out of office',
      body: { contentType: 'text', content: 'Távolléti belső részlet.' },
      receivedDateTime: '2026-08-18T19:03:00.000Z',
      internetMessageHeaders: [{ name: 'Auto-Submitted', value: 'auto-replied' }],
    },
    {
      id: `loop-${suffix}`,
      from: { emailAddress: { address: 'PROJECT-MAKER@PTE.HU' } },
      toRecipients: [{ emailAddress: { address: replyToAddress } }],
      subject: 'Saját levél',
      body: { contentType: 'text', content: 'Ezt nem szabad megjeleníteni.' },
      receivedDateTime: '2026-08-18T19:04:00.000Z',
    },
  ];
  for (const message of messages) {
    await request.post(`${graphBaseUrl}/__test/queue-mailbox-message`, { data: message });
  }
  await request.post('/api/customer-mailbox-sync/refresh');

  await page.goto('/');
  await page.getByTestId('customer-mail-triage-link').click();
  await expect(page).toHaveURL(/\/customer-mail-triage$/);
  await expect(page.getByText('Kézbesítési jelentés')).toBeVisible();
  await expect(page.getByText('Automatikus távolléti válasz')).toBeVisible();
  await expect(page.getByText('Ezt nem szabad megjeleníteni.')).toHaveCount(0);

  const humanMessage = page.locator('article').filter({ hasText: 'Ezt a levelet a megfelelő projekthez kell kapcsolni.' });
  await humanMessage.getByLabel('Ügyféllevelezés').selectOption(setup.correspondenceId);
  await humanMessage.getByRole('button', { name: 'Társítás' }).click();
  await expect(humanMessage).toHaveCount(0);

  const automatedMessage = page.locator('article').filter({ hasText: 'Bizonytalan automatikus tartalom.' });
  await automatedMessage.getByRole('button', { name: 'Nem releváns' }).click();
  await expect(automatedMessage).toHaveCount(0);

  await page.goto(`/projects/${setup.projectId}/customer-correspondences`);
  await expect(page.getByText('Ezt a levelet a megfelelő projekthez kell kapcsolni.')).toBeVisible();
  await expect(page.getByText('1 olvasatlan üzenet')).toBeVisible();
});

async function createSentHandoff(request: APIRequestContext) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const projectName = `Customer reply ${suffix}`;
  const customerEmail = `customer-${suffix}@example.test`;
  const project = await request.post('/api/projects', { data: {
    name: projectName,
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
  const sentBody = await sent.json() as { correspondenceId: string };
  return {
    projectId: project.id,
    projectName,
    roundId: round.id,
    customerEmail,
    correspondenceId: sentBody.correspondenceId,
  };
}

async function queueReply(
  request: APIRequestContext,
  id: string,
  senderAddress: string,
  replyToAddress: string,
  content: string,
): Promise<void> {
  await request.post(`${graphBaseUrl}/__test/queue-mailbox-message`, { data: {
    id,
    from: { emailAddress: { address: senderAddress } },
    toRecipients: [{ emailAddress: { address: replyToAddress } }],
    subject: 'Re: Customer follow-up',
    body: { contentType: 'text', content },
    receivedDateTime: new Date().toISOString(),
  } });
}
