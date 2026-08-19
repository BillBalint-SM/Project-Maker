import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const graphFakeUrl = `http://127.0.0.1:${process.env.GRAPH_FAKE_PORT ?? '25260'}`;
const requireFromApi = createRequire(resolve(process.cwd(), '..', 'api', 'package.json'));
const { Client } = requireFromApi('pg') as {
  readonly Client: new (configuration: { readonly connectionString: string }) => DatabaseClient;
};

interface DatabaseClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(sql: string, parameters?: readonly unknown[]): Promise<unknown>;
}

test.beforeEach(async ({ request }) => { await request.post(`${graphFakeUrl}/__test/reset`); });

test('authors, previews, cancels, and explicitly sends one referenced customer ping', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'happy-path');
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
  await page.getByTestId('follow-up-message-draft').fill(`  ${message}  `);
  await page.getByTestId('follow-up-reference-select').selectOption(reference.id);
  await nativeButton(page, 'save-follow-up-draft-button').click();
  await expect(page.getByTestId('follow-up-draft-feedback')).toContainText('Piszkozat mentve');
  await expect(page.getByTestId('follow-up-message-draft')).toHaveValue(message);

  await page.reload();
  await expect(page.getByTestId('follow-up-message-draft')).toHaveValue(message);
  await expect(page.getByTestId('follow-up-reference-select')).toHaveValue(reference.id);
  await page.getByTestId('follow-up-sender-custom').check();
  await page.getByTestId('follow-up-sender-name').fill('PO Ping');
  await page.getByTestId('follow-up-sender-address').fill('po.ping@pte.hu');

  const previewTrigger = nativeButton(page, 'preview-follow-up-ping-button');
  await previewTrigger.focus();
  await previewTrigger.click();
  const preview = page.getByRole('alertdialog', { name: 'Ügyfél-emlékeztető előnézete' });
  await expect(preview).toContainText(project.customerContactEmail);
  await expect(preview).toContainText('PO Ping <po.ping@pte.hu>');
  await expect(preview).toContainText(message);
  await expect(preview).toContainText('Kérdés: Melyik jóváhagyás hiányzik?');
  await expect(preview).toContainText('Következő lépés: Az ügyfél elküldi a jóváhagyást.');
  await expect(preview).toContainText('Határidő: 2026-09-15');
  await expect(preview).not.toContainText('Belső Tulajdonos');
  await expect(preview).not.toContainText('BUSINESS');

  await page.getByRole('button', { name: 'Mégse' }).click();
  await expect(preview).toBeHidden();
  await expect(previewTrigger).toBeFocused();

  await previewTrigger.click();
  await page.getByRole('button', { name: 'Küldés az ügyfélnek' }).click();
  await expect(page.getByTestId('follow-up-send-result')).toContainText(
    'Átadva a levelezőrendszernek',
  );
  await expect(page.getByTestId('follow-up-send-result')).toBeFocused();
  await expect(page.getByTestId('follow-up-last-delivery-status-value')).toContainText(
    'Sikeresen elküldve',
  );
  const graphMessages = await graphMessagesFor(request);
  const graphRequest = graphMessages[0] as {
    saveToSentItems?: unknown;
    __senderAddress?: string;
    message?: {
      from?: { emailAddress?: { name?: string; address?: string } };
      replyTo?: Array<{ emailAddress?: { address?: string } }>;
    };
  };
  expect(graphRequest.saveToSentItems).toBe(true);
  expect(graphRequest.__senderAddress).toBe('po.ping@pte.hu');
  expect(graphRequest.message?.from?.emailAddress).toEqual({
    name: 'PO Ping',
    address: 'po.ping@pte.hu',
  });
  expect(graphRequest.message?.replyTo?.[0]?.emailAddress?.address)
    .toMatch(/^project-maker\+[a-f0-9]{48}@pte\.hu$/);
});

test('preserves the local draft after a stale preview and reloads only on explicit request', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'stale-preview');
  const saved = await apiJson<{ draftVersion: number }>(
    request,
    'PATCH',
    `/projects/${project.id}/follow-up/draft`,
    {
      messageDraft: 'Helyi, még ellenőrzött ügyfélüzenet',
      referencedFollowUpId: null,
      expectedVersion: 1,
    },
  );
  await page.goto(`/projects/${project.id}/customer-correspondences`);
  await nativeButton(page, 'preview-follow-up-ping-button').click();
  await expect(page.getByRole('alertdialog', { name: 'Ügyfél-emlékeztető előnézete' })).toBeVisible();

  await apiJson(request, 'PATCH', `/projects/${project.id}/follow-up/draft`, {
    messageDraft: 'Szerveren időközben mentett ügyfélüzenet',
    referencedFollowUpId: null,
    expectedVersion: saved.draftVersion,
  });
  await page.getByRole('button', { name: 'Küldés az ügyfélnek' }).click();
  await expect(page.getByTestId('follow-up-action-error')).toBeVisible();
  await expect(page.getByTestId('follow-up-message-draft')).toHaveValue(
    'Helyi, még ellenőrzött ügyfélüzenet',
  );

  await nativeButton(page, 'reload-follow-up-draft-button').click();
  await expect(page.getByTestId('follow-up-message-draft')).toHaveValue(
    'Szerveren időközben mentett ügyfélüzenet',
  );
});

test('keeps the saved ping readable and mutation controls disabled after archive', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'archived');
  await apiJson(request, 'PATCH', `/projects/${project.id}/follow-up/draft`, {
    messageDraft: 'Archiválás után is olvasható ügyfélüzenet',
    referencedFollowUpId: null,
    expectedVersion: 1,
  });
  await apiJson(request, 'POST', `/projects/${project.id}/archive`, {});

  await page.goto(`/projects/${project.id}/customer-correspondences`);
  await expect(page.getByTestId('follow-up-message-draft')).toHaveValue(
    'Archiválás után is olvasható ügyfélüzenet',
  );
  await expect(page.getByTestId('follow-up-message-draft')).toBeDisabled();
  await expect(page.getByTestId('follow-up-reference-select')).toBeDisabled();
  await expect(nativeButton(page, 'save-follow-up-draft-button')).toBeDisabled();
  await expect(nativeButton(page, 'preview-follow-up-ping-button')).toBeDisabled();
});

test('keeps ping work and automatic scheduling on dedicated persistent surfaces', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'independent-forms');
  await apiJson(request, 'PATCH', `/projects/${project.id}/follow-up/draft`, {
    messageDraft: 'Szerveren mentett kiinduló üzenet',
    referencedFollowUpId: null,
    expectedVersion: 1,
  });
  await page.goto(`/projects/${project.id}/customer-correspondences`);

  const messageInput = page.getByTestId('follow-up-message-draft');
  await expect(messageInput).toHaveValue('Szerveren mentett kiinduló üzenet');
  await expect(page.getByTestId('follow-up-interval-input')).toHaveCount(0);
  await messageInput.fill('Mentett napi ügyfélüzenet');
  await nativeButton(page, 'save-follow-up-draft-button').click();
  await expect(page.getByTestId('follow-up-draft-feedback')).toContainText('Piszkozat mentve');

  await page.goto(`/projects/${project.id}/settings`);
  await expect(page.getByTestId('follow-up-message-draft')).toHaveCount(0);
  const intervalInput = page.getByTestId('follow-up-interval-input');
  await intervalInput.fill('1440');
  await nativeButton(page, 'save-follow-up-settings-button').click();
  await expect(page.getByTestId('follow-up-interval-value')).toContainText('1440 perc');

  await page.goto(`/projects/${project.id}/customer-correspondences`);
  await expect(page.getByTestId('follow-up-message-draft')).toHaveValue(
    'Mentett napi ügyfélüzenet',
  );
  await expect(nativeButton(page, 'save-follow-up-settings-button')).toHaveCount(0);

  await page.goto(`/projects/${project.id}/settings`);
  await expect(page.getByTestId('follow-up-interval-input')).toHaveValue('1440');
});

test('requires a saved valid draft before automatic scheduling can be enabled', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'schedule-prerequisite');
  await page.goto(`/projects/${project.id}/settings`);

  await page.getByTestId('follow-up-enabled-input').check();
  await nativeButton(page, 'save-follow-up-settings-button').click();

  await expect(page.getByTestId('follow-up-action-error')).toContainText(
    'Előbb ments egy nem üres ügyfél-emlékeztetőt.',
  );
  await expect(page.getByTestId('follow-up-enabled-value')).toContainText('Kikapcsolva');
});

test('shows a validation-paused schedule and resumes it after a valid draft save', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'schedule-validation-pause');
  const reference = await apiJson<{ id: string }>(
    request,
    'POST',
    `/projects/${project.id}/discovery-follow-ups`,
    {
      category: 'BUSINESS',
      question: 'Melyik döntésre várunk?',
      owner: 'Belső Tulajdonos',
      dueDate: '2026-09-15',
      nextStep: 'Az ügyfél megerősíti a döntést.',
    },
  );
  await apiJson(request, 'PATCH', `/projects/${project.id}/follow-up/draft`, {
    messageDraft: 'Kérlek, jelezd a döntés állapotát.',
    referencedFollowUpId: reference.id,
    expectedVersion: 1,
  });
  await apiJson(request, 'PATCH', `/projects/${project.id}/follow-up`, {
    enabled: true,
    intervalMinutes: 60,
  });
  await apiJson(
    request,
    'POST',
    `/projects/${project.id}/discovery-follow-ups/${reference.id}/resolve`,
    { status: 'Megválaszolva', decisionOrAnswer: 'A döntés megérkezett.' },
  );
  await pauseCustomerSchedule(project.id);

  await page.goto(`/projects/${project.id}/customer-correspondences`);
  await expect(page.getByTestId('follow-up-schedule-validation-pause')).toContainText(
    'Az automatikus ügyfél-emlékeztető szünetel',
  );
  await page.getByTestId('follow-up-reference-select').selectOption('');
  await nativeButton(page, 'save-follow-up-draft-button').click();

  await expect(page.getByTestId('follow-up-schedule-validation-pause')).toBeHidden();
  await expect(page.getByTestId('follow-up-next-ping-at-value')).not.toContainText('Nincs ütemezve');
});

test('requires an explicit duplicate-risk acknowledgement after an expired delivery lease', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'unknown-delivery');
  await apiJson(request, 'PATCH', `/projects/${project.id}/follow-up/draft`, {
    messageDraft: 'Csak ellenőrzés után küldhető újra',
    referencedFollowUpId: null,
    expectedVersion: 1,
  });
  await page.goto(`/projects/${project.id}/customer-correspondences`);
  await nativeButton(page, 'preview-follow-up-ping-button').click();
  const preview = page.getByRole('alertdialog', { name: 'Ügyfél-emlékeztető előnézete' });
  await expect(preview).toBeVisible();
  await forceExpiredCustomerPingAttempt(project.id, project.customerContactEmail);

  const messagesBefore = await graphMessageCount(request);
  await page.getByRole('button', { name: 'Küldés az ügyfélnek' }).click();
  const warning = page.getByTestId('follow-up-unknown-recovery');
  await expect(warning).toContainText('bizonytalan');
  await expect(warning).toContainText('duplikált');
  await expect(preview).toBeHidden();
  expect(await graphMessageCount(request)).toBe(messagesBefore);

  await nativeButton(page, 'retry-unknown-follow-up-ping-button').click();
  await nativeButton(page, 'confirm-follow-up-retry-button').click();
  await expect(page.getByTestId('follow-up-send-result')).toContainText('Átadva a levelezőrendszernek');
  expect(await graphMessageCount(request)).toBe(messagesBefore + 1);
});

test('recovers a failed ping after reload with cancel, Escape, and deterministic focus', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'failed-recovery');
  await apiJson(request, 'PATCH', `/projects/${project.id}/follow-up/draft`, {
    messageDraft: 'Ismert hiba után kézzel újraküldhető',
    referencedFollowUpId: null,
    expectedVersion: 1,
  });
  await forceCustomerPingAttempt(project.id, project.customerContactEmail, 'FAILED');

  let releaseRetry!: () => void;
  let retryStarted!: () => void;
  const retryGate = new Promise<void>((resolve) => { releaseRetry = resolve; });
  const started = new Promise<void>((resolve) => { retryStarted = resolve; });
  let retryRequests = 0;
  await page.route('**/follow-up/ping/retry', async (route) => {
    retryRequests += 1;
    retryStarted();
    await retryGate;
    await route.continue();
  });

  await page.goto(`/projects/${project.id}/customer-correspondences`);
  const retryTrigger = nativeButton(page, 'retry-failed-follow-up-ping-button');
  await expect(page.getByTestId('follow-up-failed-recovery')).toContainText('sikertelen');
  await retryTrigger.focus();
  await retryTrigger.click();
  const confirmation = page.getByRole('alertdialog', {
    name: 'Ügyfél-emlékeztető újraküldése',
  });
  await expect(nativeButton(page, 'cancel-follow-up-retry-button')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(confirmation).toBeHidden();
  await expect(retryTrigger).toBeFocused();

  const messagesBefore = await graphMessageCount(request);
  await retryTrigger.click();
  const confirm = nativeButton(page, 'confirm-follow-up-retry-button');
  await confirm.dblclick();
  await started;
  await expect(page.getByTestId('follow-up-message-draft')).toBeDisabled();
  await expect(nativeButton(page, 'save-follow-up-settings-button')).toHaveCount(0);
  releaseRetry();
  await expect(page.getByTestId('follow-up-send-result')).toContainText('Átadva a levelezőrendszernek');
  await expect(page.getByTestId('follow-up-send-result')).toBeFocused();
  expect(await graphMessageCount(request)).toBe(messagesBefore + 1);
  expect(retryRequests).toBe(1);
});

test('requires a visible request-specific acknowledgement for an uncertain ping', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'unknown-recovery');
  await apiJson(request, 'PATCH', `/projects/${project.id}/follow-up/draft`, {
    messageDraft: 'Bizonytalan eredmény után csak tudatosan küldhető újra',
    referencedFollowUpId: null,
    expectedVersion: 1,
  });
  const attemptId = await forceCustomerPingAttempt(
    project.id,
    project.customerContactEmail,
    'UNKNOWN',
  );
  let retryBody: unknown = null;
  page.on('request', (outbound) => {
    if (outbound.url().endsWith('/follow-up/ping/retry')) retryBody = outbound.postDataJSON();
  });

  await page.goto(`/projects/${project.id}/customer-correspondences`);
  const warning = page.getByTestId('follow-up-unknown-recovery');
  await expect(warning).toContainText('bizonytalan');
  await expect(warning).toContainText('duplikált');
  await nativeButton(page, 'retry-unknown-follow-up-ping-button').click();
  await expect(
    page.getByRole('alertdialog', { name: 'Ügyfél-emlékeztető újraküldése' }),
  ).toContainText('duplikált levelet');
  await nativeButton(page, 'confirm-follow-up-retry-button').click();
  await expect(page.getByTestId('follow-up-send-result')).toContainText('Átadva a levelezőrendszernek');
  expect(retryBody).toEqual({ attemptId, acknowledgeDuplicateRisk: true });
});

test('keeps uncertain recovery visible after editing and explicitly acknowledges a fresh send', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'unknown-fresh-send');
  await apiJson(request, 'PATCH', `/projects/${project.id}/follow-up/draft`, {
    messageDraft: 'A bizonytalan küldés eredeti piszkozata',
    referencedFollowUpId: null,
    expectedVersion: 1,
  });
  const attemptId = await forceCustomerPingAttempt(
    project.id,
    project.customerContactEmail,
    'UNKNOWN',
  );
  let sendBody: unknown = null;
  page.on('request', (outbound) => {
    if (outbound.url().endsWith('/follow-up/ping')) sendBody = outbound.postDataJSON();
  });

  await page.goto(`/projects/${project.id}/customer-correspondences`);
  const message = page.getByTestId('follow-up-message-draft');
  await message.fill('A bizonytalan küldés után javított piszkozat');
  await nativeButton(page, 'save-follow-up-draft-button').click();
  await expect(page.getByTestId('follow-up-unknown-recovery')).toBeVisible();

  await nativeButton(page, 'preview-follow-up-ping-button').click();
  const confirmation = page.getByRole('alertdialog', {
    name: 'Ügyfél-emlékeztető előnézete',
  });
  await expect(confirmation).toContainText('duplikált levelet');
  await nativeButton(page, 'acknowledge-fresh-follow-up-ping-button').click();
  await expect(page.getByTestId('follow-up-send-result')).toContainText('Átadva a levelezőrendszernek');
  expect(sendBody).toEqual({
    previewToken: expect.any(String),
    acknowledgeDuplicateRiskForAttemptId: attemptId,
  });
});

test('locks only the ping work surface while a recovered attempt is pending', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'pending-recovery');
  await apiJson(request, 'PATCH', `/projects/${project.id}/follow-up/draft`, {
    messageDraft: 'Folyamatban lévő kézbesítés',
    referencedFollowUpId: null,
    expectedVersion: 1,
  });
  const attemptId = await forceCustomerPingAttempt(
    project.id,
    project.customerContactEmail,
    'SENDING',
  );

  await page.goto(`/projects/${project.id}/customer-correspondences`);
  await expect(page.getByTestId('follow-up-sending-recovery')).toContainText('folyamatban');
  await expect(page.getByTestId('follow-up-message-draft')).toBeDisabled();
  await expect(nativeButton(page, 'save-follow-up-draft-button')).toBeDisabled();
  await expect(nativeButton(page, 'preview-follow-up-ping-button')).toBeDisabled();
  await expect(nativeButton(page, 'save-follow-up-settings-button')).toHaveCount(0);
  await expect(nativeButton(page, 'archive-project-button')).toHaveCount(0);

  await transitionCustomerPingAttempt(attemptId, 'FAILED');
  await expect(page.getByTestId('follow-up-failed-recovery')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('follow-up-message-draft')).toBeEnabled();
  await expect(nativeButton(page, 'preview-follow-up-ping-button')).toBeEnabled();
});

test('reconciles a recovered pending lease expiry without reloading the page', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'pending-expiry');
  await apiJson(request, 'PATCH', `/projects/${project.id}/follow-up/draft`, {
    messageDraft: 'Lejáró kézbesítési lease',
    referencedFollowUpId: null,
    expectedVersion: 1,
  });
  const attemptId = await forceCustomerPingAttempt(
    project.id,
    project.customerContactEmail,
    'SENDING',
  );

  await page.goto(`/projects/${project.id}/customer-correspondences`);
  await expect(page.getByTestId('follow-up-sending-recovery')).toBeVisible();
  await expireCustomerPingAttempt(attemptId);

  await expect(page.getByTestId('follow-up-unknown-recovery')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('follow-up-message-draft')).toBeEnabled();
  await expect(nativeButton(page, 'preview-follow-up-ping-button')).toBeEnabled();
});

async function createProject(
  request: APIRequestContext,
  label: string,
): Promise<{ readonly id: string; readonly customerContactEmail: string }> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const customerContactEmail = `customer-ping-${suffix}@example.test`;
  return apiJson(request, 'POST', '/projects', {
    name: `Customer ping ${label} ${suffix}`,
    customerContactName: 'Ügyfél Anna',
    customerContactEmail,
    internalOwnerName: 'PO Péter',
    nextActionOwnerRole: 'CUSTOMER_CONTACT',
  });
}

async function apiJson<T>(
  request: APIRequestContext,
  method: 'GET' | 'POST' | 'PATCH',
  path: string,
  data?: unknown,
): Promise<T> {
  const response = await request.fetch(`/api${path}`, { method, data });
  if (!response.ok()) {
    throw new Error(`${method} ${path} failed with HTTP ${response.status()}.`);
  }
  return response.json() as Promise<T>;
}

function nativeButton(page: Page, testId: string) {
  return page.getByTestId(testId).locator('button');
}

async function forceExpiredCustomerPingAttempt(
  projectId: string,
  recipientEmail: string,
): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for the UNKNOWN customer ping fixture.');
  }
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query(
      `INSERT INTO customer_follow_up_delivery_attempts (
        id, project_id, draft_version, state, recipient_email,
        subject_length, text_length, failure_code, attempted_at
      ) VALUES ($1, $2, 2, 'SENDING', $3, 1, 1, NULL, $4)`,
      [randomUUID(), projectId, recipientEmail, new Date(Date.now() - 16 * 60_000)],
    );
  } finally {
    await client.end();
  }
}

async function forceCustomerPingAttempt(
  projectId: string,
  recipientEmail: string,
  state: 'SENDING' | 'FAILED' | 'UNKNOWN',
): Promise<string> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for the recovery fixture.');
  const client = new Client({ connectionString: databaseUrl });
  const attemptId = randomUUID();
  try {
    await client.connect();
    await client.query(
      `INSERT INTO customer_follow_up_delivery_attempts (
        id, project_id, draft_version, state, recipient_email,
        subject_length, text_length, failure_code, attempted_at
      ) VALUES ($1, $2, 2, $3, $4, 1, 1, $5, CURRENT_TIMESTAMP)`,
      [
        attemptId,
        projectId,
        state,
        recipientEmail,
        state === 'FAILED'
          ? 'SMTP_SEND_FAILED'
          : state === 'UNKNOWN'
            ? 'SMTP_DELIVERY_UNKNOWN'
            : null,
      ],
    );
  } finally {
    await client.end();
  }
  return attemptId;
}

async function transitionCustomerPingAttempt(
  attemptId: string,
  state: 'FAILED' | 'UNKNOWN',
): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for the recovery fixture.');
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query(
      `UPDATE customer_follow_up_delivery_attempts
       SET state = $2, failure_code = $3
       WHERE id = $1`,
      [
        attemptId,
        state,
        state === 'FAILED' ? 'SMTP_SEND_FAILED' : 'SMTP_DELIVERY_UNKNOWN',
      ],
    );
  } finally {
    await client.end();
  }
}

async function expireCustomerPingAttempt(attemptId: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for the recovery fixture.');
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query(
      `UPDATE customer_follow_up_delivery_attempts
       SET attempted_at = $2
       WHERE id = $1`,
      [attemptId, new Date(Date.now() - 16 * 60_000)],
    );
  } finally {
    await client.end();
  }
}

async function graphMessageCount(request: APIRequestContext): Promise<number> {
  const response = await request.get(`${graphFakeUrl}/__test/messages`);
  return ((await response.json()) as unknown[]).length;
}

async function graphMessagesFor(request: APIRequestContext): Promise<unknown[]> {
  const response = await request.get(`${graphFakeUrl}/__test/messages`);
  return await response.json() as unknown[];
}

async function pauseCustomerSchedule(projectId: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for the schedule pause fixture.');
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query(
      'UPDATE customer_follow_ups SET next_ping_at = NULL WHERE project_id = $1 AND enabled = true',
      [projectId],
    );
  } finally {
    await client.end();
  }
}
