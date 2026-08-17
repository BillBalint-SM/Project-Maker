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
  const warning = page.getByTestId('follow-up-duplicate-risk-warning');
  await expect(warning).toContainText('nem bizonyítható');
  await expect(warning).toContainText('duplikált');
  await expect(preview).toBeVisible();
  expect(smtpMessages).toHaveLength(messagesBefore);

  await nativeButton(page, 'acknowledge-follow-up-duplicate-risk-button').click();
  await expect(page.getByTestId('follow-up-send-result')).toContainText('Ping elküldve');
  expect(smtpMessages).toHaveLength(messagesBefore + 1);
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
