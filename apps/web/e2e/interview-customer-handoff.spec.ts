import { createRequire } from 'node:module';
import { createServer, type Server, type Socket } from 'node:net';
import { resolve } from 'node:path';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const smtpPort = Number(process.env.SMTP_PORT ?? '25260');
const messages: string[] = [];
const requireFromApi = createRequire(resolve(process.cwd(), '..', 'api', 'package.json'));
const { Client } = requireFromApi('pg') as {
  readonly Client: new (configuration: { readonly connectionString: string }) => DatabaseClient;
};
let smtpServer: Server;
let rejectNextMessage = false;

interface DatabaseClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query(sql: string, parameters?: readonly unknown[]): Promise<unknown>;
}

test.describe.serial('interview customer handoff browser journey', () => {
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    smtpServer = createSmtpCaptureServer(messages);
    await new Promise<void>((resolve, reject) => {
      smtpServer.once('error', reject);
      smtpServer.listen(smtpPort, '127.0.0.1', resolve);
    });
  });

  test.beforeEach(() => {
    messages.length = 0;
    rejectNextMessage = false;
  });

  test.afterAll(async () => {
    await new Promise<void>((resolve, reject) => smtpServer.close((error) => error ? reject(error) : resolve()));
  });

  test('finishes incomplete work, sends v1, edits v2, resends, and inspects immutable history', async ({ page, request }, testInfo) => {
    const fixture = await createOpenInterview(request, testInfo);
    await page.goto(`/projects/${fixture.projectId}/interview`);
    await expect(page.getByTestId('active-round-resume-state')).toBeVisible();

    await nativeButton(page, 'finish-interview-and-send-button').click();
    await expect(page.getByTestId('handoff-preview-button')).toBeVisible();
    await expect(page.getByText('1. verzió előnézete')).toBeVisible();
    await sendCurrentPreview(page, fixture.projectId, fixture.roundId);
    await expect.poll(() => messages.length).toBe(1);
    await expect(page.getByRole('heading', { name: /Verzióelőzmények/ })).toBeVisible();
    await expect(page.getByTestId('handoff-version-heading-1')).toContainText('Elküldve');
    await expect(page.getByTestId('handoff-version-heading-1')).toBeFocused();

    await nativeButton(page, 'start-handoff-version').click();
    await expect(page.getByTestId('handoff-modification-summary')).toBeVisible();
    await page.getByTestId('handoff-modification-summary').fill('Az ügyfél pontosította az elvárt eredményt.');
    await page.getByRole('button', { name: 'Összefoglalás mentése' }).click();

    const answer = 'Az ügyfél által jóváhagyott, pontosított üzleti eredmény.';
    const answerResponse = page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().includes(`/api/projects/${fixture.projectId}/rounds/${fixture.roundId}/answers/${fixture.snapshotId}`));
    await page.getByTestId(`round-answer-textarea-${fixture.snapshotId}`).fill(answer);
    expect((await answerResponse).status()).toBe(200);
    await expect(page.getByTestId(`round-answer-save-state-${fixture.snapshotId}`)).toContainText('Mentve');

    await nativeButton(page, 'handoff-preview-button').click();
    await expect(page.getByText('2. verzió előnézete')).toBeVisible();
    await expect(page.locator('.preview pre')).toContainText(answer);

    const locallyEditedAnswer = 'Az előnézet után a felületen pontosított üzleti eredmény.';
    const localEditResponse = page.waitForResponse((response) => response.request().method() === 'PATCH' && response.url().includes(`/answers/${fixture.snapshotId}`));
    await page.getByTestId(`round-answer-textarea-${fixture.snapshotId}`).fill(locallyEditedAnswer);
    await expect(page.locator('.preview')).toBeHidden();
    expect((await localEditResponse).status()).toBe(200);
    await nativeButton(page, 'handoff-preview-button').click();
    await expect(page.locator('.preview pre')).toContainText(locallyEditedAnswer);

    const answerAfterPreview = 'Az előnézet után szerveren pontosított üzleti eredmény.';
    await apiJson(request, 'PATCH', `/projects/${fixture.projectId}/rounds/${fixture.roundId}/answers/${fixture.snapshotId}`, { value: answerAfterPreview });
    await sendCurrentPreview(page, fixture.projectId, fixture.roundId, 409);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.locator('.preview')).toBeHidden();
    await expect(await nativeButton(page, 'handoff-preview-button')).toBeFocused();
    await nativeButton(page, 'handoff-preview-button').click();
    await expect(page.locator('.preview pre')).toContainText(answerAfterPreview);
    await sendCurrentPreview(page, fixture.projectId, fixture.roundId);
    await expect.poll(() => messages.length).toBe(2);
    await expect(page.getByTestId('handoff-version-heading-2')).toContainText('Elküldve');
    await expect(page.getByTestId('handoff-version-heading-2')).toBeFocused();
    expect(messages[0]).not.toContain(answer);
    expect(messages[1]).toContain(answerAfterPreview);
    expect(messages[1]).toContain('Az ügyfél pontosította az elvárt eredményt.');

    await page.getByTestId('inspect-handoff-version-1').click();
    await expect(page.locator('.history-content')).toContainText('Nincs rögzített válasz');
    await page.getByTestId('inspect-handoff-version-2').click();
    await expect(page.locator('.history-content')).toContainText(answerAfterPreview);
  });

  test('recovers a known delivery failure, resumes editing, and preserves read-only history after archive', async ({ page, request }, testInfo) => {
    const fixture = await createOpenInterview(request, testInfo);
    await page.goto(`/projects/${fixture.projectId}/interview`);
    await nativeButton(page, 'finish-interview-and-send-button').click();

    rejectNextMessage = true;
    await sendCurrentPreview(page, fixture.projectId, fixture.roundId);
    await expect(page.getByTestId('handoff-state-message')).toContainText('ismert hibával');
    await expect(page.getByTestId('handoff-version-heading-1')).toContainText('Sikertelen');
    await expect(page.getByTestId('handoff-version-heading-1')).toBeFocused();

    await nativeButton(page, 'retry-failed-handoff').click();
    await expect.poll(() => messages.length).toBe(1);
    await expect(page.getByTestId('handoff-version-heading-1')).toContainText('Elküldve');

    await nativeButton(page, 'start-handoff-version').click();
    await page.getByTestId('handoff-modification-summary').fill('Az ügyfél további pontosítást kért.');
    await page.getByRole('button', { name: 'Összefoglalás mentése' }).click();
    await nativeButton(page, 'handoff-preview-button').click();
    rejectNextMessage = true;
    await sendCurrentPreview(page, fixture.projectId, fixture.roundId);
    await nativeButton(page, 'resume-handoff-editing').click();
    await expect(page.getByTestId('handoff-modification-summary')).toBeEnabled();

    await apiJson(request, 'POST', `/projects/${fixture.projectId}/archive`);
    await page.reload();
    await expect(page.getByText('Az archivált projekt ügyfélcsomagjai csak olvashatók.')).toBeVisible();
    await expect(await nativeButton(page, 'handoff-preview-button')).toBeDisabled();
    await page.getByTestId('inspect-handoff-version-1').click();
    await expect(page.locator('.history-content')).toBeVisible();
  });

  test('requires explicit duplicate-risk acknowledgement for UNKNOWN retry and restores keyboard focus', async ({ page, request }, testInfo) => {
    const fixture = await createOpenInterview(request, testInfo);
    await page.goto(`/projects/${fixture.projectId}/interview`);
    await nativeButton(page, 'finish-interview-and-send-button').click();
    rejectNextMessage = true;
    await sendCurrentPreview(page, fixture.projectId, fixture.roundId);

    const handoffs = await apiJson<readonly { id: string }[]>(request, 'GET', `/projects/${fixture.projectId}/rounds/${fixture.roundId}/customer-handoffs`);
    await forceUnknownDelivery(handoffs[0].id);
    await page.reload();
    const retryTrigger = await nativeButton(page, 'retry-unknown-handoff');
    await retryTrigger.focus();
    await retryTrigger.click();
    const dialog = page.getByRole('alertdialog', { name: 'Ismeretlen kézbesítés ellenőrzése' });
    await expect(dialog).toContainText('esetleges kettős küldést');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(retryTrigger).toBeFocused();

    await retryTrigger.click();
    await page.getByRole('button', { name: 'Ellenőriztem, újrapróbálom' }).click();
    await expect.poll(() => messages.length).toBe(1);
    await expect(page.getByTestId('handoff-version-heading-1')).toContainText('Elküldve');
    await expect(page.getByTestId('handoff-version-heading-1')).toBeFocused();
  });

  test('renders Hungarian project status and makes an archived open interview read-only', async ({ page, request }, testInfo) => {
    const fixture = await createOpenInterview(request, testInfo);
    await page.goto('/');
    const projectCard = page.getByTestId(`project-card-${fixture.projectId}`);
    await expect(projectCard).toContainText('Előkészítés alatt');
    await expect(projectCard).not.toContainText('DRAFT');

    await apiJson(request, 'POST', `/projects/${fixture.projectId}/archive`);
    await page.goto(`/projects/${fixture.projectId}/interview`);
    await expect(page.getByTestId('archived-interview-read-only')).toBeVisible();
    await expect(page.getByTestId(`schema-question-${fixture.stableKey}`).locator('input')).toBeDisabled();
    await expect(page.locator(`[data-testid="round-answer-input-${fixture.snapshotId}"], [data-testid="round-answer-textarea-${fixture.snapshotId}"]`)).toBeDisabled();
    await expect(await nativeButton(page, 'finish-interview-later-button')).toBeDisabled();
    await expect(await nativeButton(page, 'finish-interview-and-send-button')).toBeDisabled();
  });
});

async function sendCurrentPreview(page: Page, projectId: string, roundId: string, expectedStatus = 201): Promise<void> {
  await nativeButton(page, 'send-handoff-button').click();
  await expect(page.getByRole('alertdialog', { name: 'Interjú-összefoglaló küldése' })).toBeVisible();
  const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes(`/api/projects/${projectId}/rounds/${roundId}/customer-handoffs/`) && response.url().endsWith('/send'));
  await page.getByRole('button', { name: 'Küldés az ügyfélnek', exact: true }).last().click();
  expect((await responsePromise).status()).toBe(expectedStatus);
}

async function createOpenInterview(request: APIRequestContext, testInfo: { readonly workerIndex: number }): Promise<{ projectId: string; roundId: string; snapshotId: string; stableKey: string }> {
  const suffix = `${Date.now()}-${testInfo.workerIndex}-${Math.random().toString(36).slice(2, 8)}`;
  const project = await apiJson<{ id: string }>(request, 'POST', '/projects', {
    name: `Ügyfélcsomag E2E ${suffix}`,
    customerContactName: 'Teszt Ügyfél',
    customerContactEmail: `handoff-${suffix}@example.test`,
    internalOwnerName: 'Teszt PO',
    nextActionOwnerRole: 'CUSTOMER_CONTACT',
  });
  const bank = await apiJson<{ questions: readonly { stableKey: string }[] }>(request, 'GET', '/settings/base-questions');
  await apiJson(request, 'POST', `/projects/${project.id}/question-schema`, { questions: [{ stableKey: bank.questions[0].stableKey, required: true, blocking: true }] });
  const round = await apiJson<{ id: string; questions: readonly { id: string }[] }>(request, 'POST', `/projects/${project.id}/rounds`, { type: 'INITIAL_INTAKE' });
  return { projectId: project.id, roundId: round.id, snapshotId: round.questions[0].id, stableKey: bank.questions[0].stableKey };
}

async function apiJson<T>(request: APIRequestContext, method: 'GET' | 'POST' | 'PATCH', path: string, data?: unknown): Promise<T> {
  const response = await request.fetch(`http://127.0.0.1:3000${path}`, { method, data });
  expect(response.ok(), `${method} ${path} returned ${response.status()}`).toBeTruthy();
  return response.json() as Promise<T>;
}

async function forceUnknownDelivery(handoffId: string): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for the UNKNOWN browser fixture.');
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query(
      'UPDATE "interview_customer_handoffs" SET "state" = \'UNKNOWN\', "failure_code" = \'DELIVERY_RESULT_UNKNOWN\', "updated_at" = CURRENT_TIMESTAMP WHERE "id" = $1',
      [handoffId],
    );
  } finally {
    await client.end();
  }
}

function nativeButton(page: Page, testId: string) {
  return page.getByTestId(testId).locator('button');
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
      const message = buffer.slice(0, end);
      buffer = buffer.slice(end + 5);
      dataMode = false;
      if (rejectNextMessage) {
        rejectNextMessage = false;
        socket.write('550 rejected by test SMTP\r\n');
      } else {
        target.push(message);
        socket.write('250 accepted\r\n');
      }
    }
    while (!dataMode) {
      const end = buffer.indexOf('\r\n');
      if (end < 0) return;
      const command = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      if (/^EHLO /i.test(command)) socket.write('250 project-maker-test\r\n');
      else if (/^(MAIL FROM|RCPT TO):/i.test(command)) socket.write('250 ok\r\n');
      else if (command === 'DATA') { dataMode = true; socket.write('354 end with dot\r\n'); }
      else socket.write('500 unsupported\r\n');
    }
  });
}
