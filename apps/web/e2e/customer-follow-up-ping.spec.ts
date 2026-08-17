import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { createServer, type Server, type Socket } from 'node:net';
import { resolve } from 'node:path';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const smtpPort = Number(process.env.SMTP_PORT ?? '25261');
const smtpMessages: string[] = [];
const requireFromApi = createRequire(resolve(process.cwd(), '..', 'api', 'package.json'));
const { Client } = requireFromApi('pg') as {
  readonly Client: new (configuration: { readonly connectionString: string }) => DatabaseClient;
};
let smtpServer: Server;

interface DatabaseClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(sql: string, parameters?: readonly unknown[]): Promise<unknown>;
}

test.beforeAll(async () => {
  smtpServer = createSmtpCaptureServer(smtpMessages);
  await new Promise<void>((resolve, reject) => {
    smtpServer.once('error', reject);
    smtpServer.listen(smtpPort, '127.0.0.1', resolve);
  });
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) =>
    smtpServer.close((error) => (error ? reject(error) : resolve())),
  );
});

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

  await page.goto(`/projects/${project.id}`);
  const message = 'Kérlek, küldd el a hiányzó üzleti jóváhagyást.';
  await page.getByTestId('follow-up-message-draft').fill(`  ${message}  `);
  await page.getByTestId('follow-up-reference-select').selectOption(reference.id);
  await nativeButton(page, 'save-follow-up-draft-button').click();
  await expect(page.getByTestId('follow-up-draft-feedback')).toContainText('Piszkozat mentve');
  await expect(page.getByTestId('follow-up-message-draft')).toHaveValue(message);

  await page.reload();
  await expect(page.getByTestId('follow-up-message-draft')).toHaveValue(message);
  await expect(page.getByTestId('follow-up-reference-select')).toHaveValue(reference.id);

  const previewTrigger = nativeButton(page, 'preview-follow-up-ping-button');
  await previewTrigger.focus();
  await previewTrigger.click();
  const preview = page.getByRole('alertdialog', { name: 'Customer follow-up ping előnézete' });
  await expect(preview).toContainText(project.customerContactEmail);
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
  await expect(page.getByTestId('follow-up-send-result')).toContainText('Ping elküldve');
  await expect(page.getByTestId('follow-up-send-result')).toBeFocused();
  await expect(page.getByTestId('follow-up-last-delivery-status-value')).toContainText('SENT');
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
  await page.goto(`/projects/${project.id}`);
  await nativeButton(page, 'preview-follow-up-ping-button').click();
  await expect(page.getByRole('alertdialog', { name: 'Customer follow-up ping előnézete' })).toBeVisible();

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

  await page.goto(`/projects/${project.id}`);
  await expect(page.getByTestId('follow-up-message-draft')).toHaveValue(
    'Archiválás után is olvasható ügyfélüzenet',
  );
  await expect(page.getByTestId('follow-up-message-draft')).toBeDisabled();
  await expect(page.getByTestId('follow-up-reference-select')).toBeDisabled();
  await expect(nativeButton(page, 'save-follow-up-draft-button')).toBeDisabled();
  await expect(nativeButton(page, 'preview-follow-up-ping-button')).toBeDisabled();
});

test('preserves unsaved ping and cadence edits when the other form is saved', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'independent-forms');
  await apiJson(request, 'PATCH', `/projects/${project.id}/follow-up/draft`, {
    messageDraft: 'Szerveren mentett kiinduló üzenet',
    referencedFollowUpId: null,
    expectedVersion: 1,
  });
  await page.goto(`/projects/${project.id}`);

  const messageInput = page.getByTestId('follow-up-message-draft');
  const intervalInput = page.getByTestId('follow-up-interval-input');
  await messageInput.fill('Még nem mentett helyi üzenet');
  await intervalInput.fill('1440');
  await nativeButton(page, 'save-follow-up-settings-button').click();
  await expect(page.getByTestId('follow-up-interval-value')).toContainText('1440 minutes');
  await expect(messageInput).toHaveValue('Még nem mentett helyi üzenet');

  await nativeButton(page, 'save-follow-up-draft-button').click();
  await expect(page.getByTestId('follow-up-draft-feedback')).toContainText('Piszkozat mentve');
  await intervalInput.fill('2880');
  await messageInput.fill('Második mentendő üzenet');
  await nativeButton(page, 'save-follow-up-draft-button').click();
  await expect(messageInput).toHaveValue('Második mentendő üzenet');
  await expect(intervalInput).toHaveValue('2880');
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
  await page.goto(`/projects/${project.id}`);
  await nativeButton(page, 'preview-follow-up-ping-button').click();
  const preview = page.getByRole('alertdialog', { name: 'Customer follow-up ping előnézete' });
  await expect(preview).toBeVisible();
  await forceExpiredCustomerPingAttempt(project.id, project.customerContactEmail);

  const messagesBefore = smtpMessages.length;
  await page.getByRole('button', { name: 'Küldés az ügyfélnek' }).click();
  const warning = page.getByTestId('follow-up-unknown-recovery');
  await expect(warning).toContainText('bizonytalan');
  await expect(warning).toContainText('duplikált');
  await expect(preview).toBeHidden();
  expect(smtpMessages).toHaveLength(messagesBefore);

  await nativeButton(page, 'retry-unknown-follow-up-ping-button').click();
  await nativeButton(page, 'confirm-follow-up-retry-button').click();
  await expect(page.getByTestId('follow-up-send-result')).toContainText('Ping elküldve');
  expect(smtpMessages).toHaveLength(messagesBefore + 1);
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

  await page.goto(`/projects/${project.id}`);
  const retryTrigger = nativeButton(page, 'retry-failed-follow-up-ping-button');
  await expect(page.getByTestId('follow-up-failed-recovery')).toContainText('sikertelen');
  await retryTrigger.focus();
  await retryTrigger.click();
  const confirmation = page.getByRole('alertdialog', { name: 'Ügyfél-ping újraküldése' });
  await expect(nativeButton(page, 'cancel-follow-up-retry-button')).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(confirmation).toBeHidden();
  await expect(retryTrigger).toBeFocused();

  const messagesBefore = smtpMessages.length;
  await retryTrigger.click();
  const confirm = nativeButton(page, 'confirm-follow-up-retry-button');
  await confirm.dblclick();
  await started;
  await expect(page.getByTestId('follow-up-message-draft')).toBeDisabled();
  await expect(nativeButton(page, 'save-follow-up-settings-button')).toBeDisabled();
  releaseRetry();
  await expect(page.getByTestId('follow-up-send-result')).toContainText('Ping elküldve');
  await expect(page.getByTestId('follow-up-send-result')).toBeFocused();
  expect(smtpMessages).toHaveLength(messagesBefore + 1);
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

  await page.goto(`/projects/${project.id}`);
  const warning = page.getByTestId('follow-up-unknown-recovery');
  await expect(warning).toContainText('bizonytalan');
  await expect(warning).toContainText('duplikált');
  await nativeButton(page, 'retry-unknown-follow-up-ping-button').click();
  await expect(page.getByRole('alertdialog', { name: 'Ügyfél-ping újraküldése' })).toContainText(
    'duplikált levelet',
  );
  await nativeButton(page, 'confirm-follow-up-retry-button').click();
  await expect(page.getByTestId('follow-up-send-result')).toContainText('Ping elküldve');
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

  await page.goto(`/projects/${project.id}`);
  const message = page.getByTestId('follow-up-message-draft');
  await message.fill('A bizonytalan küldés után javított piszkozat');
  await nativeButton(page, 'save-follow-up-draft-button').click();
  await expect(page.getByTestId('follow-up-unknown-recovery')).toBeVisible();

  await nativeButton(page, 'preview-follow-up-ping-button').click();
  const confirmation = page.getByRole('alertdialog', {
    name: 'Customer follow-up ping előnézete',
  });
  await expect(confirmation).toContainText('duplikált levelet');
  await nativeButton(page, 'acknowledge-fresh-follow-up-ping-button').click();
  await expect(page.getByTestId('follow-up-send-result')).toContainText('Ping elküldve');
  expect(sendBody).toEqual({
    previewToken: expect.any(String),
    acknowledgeDuplicateRiskForAttemptId: attemptId,
  });
});

test('keeps unrelated cockpit mutations disabled while a recovered attempt is pending', async ({
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

  await page.goto(`/projects/${project.id}`);
  await expect(page.getByTestId('follow-up-sending-recovery')).toContainText('folyamatban');
  await expect(page.getByTestId('follow-up-message-draft')).toBeDisabled();
  await expect(nativeButton(page, 'save-follow-up-draft-button')).toBeDisabled();
  await expect(nativeButton(page, 'save-follow-up-settings-button')).toBeDisabled();
  await expect(nativeButton(page, 'preview-follow-up-ping-button')).toBeDisabled();
  await expect(nativeButton(page, 'save-workspace-button')).toBeDisabled();
  await expect(nativeButton(page, 'archive-project-button')).toBeDisabled();

  await transitionCustomerPingAttempt(attemptId, 'FAILED');
  await expect(page.getByTestId('follow-up-failed-recovery')).toBeVisible({ timeout: 10_000 });
  await expect(page.getByTestId('follow-up-message-draft')).toBeEnabled();
  await expect(nativeButton(page, 'save-workspace-button')).toBeEnabled();
  await expect(nativeButton(page, 'archive-project-button')).toBeEnabled();
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

function createSmtpCaptureServer(target: string[]): Server {
  return createServer((socket) => handleSmtpConnection(socket, target));
}

function handleSmtpConnection(socket: Socket, target: string[]): void {
  let buffer = '';
  let dataMode = false;
  socket.setEncoding('utf8');
  socket.write('220 project-maker-test ESMTP\r\n');
  socket.on('data', (chunk: string) => {
    buffer += chunk;
    if (dataMode) {
      const end = buffer.indexOf('\r\n.\r\n');
      if (end < 0) return;
      target.push(buffer.slice(0, end));
      buffer = buffer.slice(end + 5);
      dataMode = false;
      socket.write('250 accepted\r\n');
    }
    while (!dataMode) {
      const end = buffer.indexOf('\r\n');
      if (end < 0) return;
      const command = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (/^EHLO /i.test(command)) socket.write('250 project-maker-test\r\n');
      else if (/^(MAIL FROM|RCPT TO):/i.test(command)) socket.write('250 ok\r\n');
      else if (command === 'DATA') {
        dataMode = true;
        socket.write('354 end with dot\r\n');
      } else socket.write('500 unsupported\r\n');
    }
  });
}
