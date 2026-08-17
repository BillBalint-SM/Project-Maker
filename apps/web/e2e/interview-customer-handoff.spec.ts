import { createServer, type Server, type Socket } from 'node:net';

import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const smtpPort = Number(process.env.SMTP_PORT ?? '25260');
const messages: string[] = [];
let smtpServer: Server;

test.describe.serial('interview customer handoff browser journey', () => {
  test.setTimeout(120_000);

  test.beforeAll(async () => {
    smtpServer = createSmtpCaptureServer(messages);
    await new Promise<void>((resolve, reject) => {
      smtpServer.once('error', reject);
      smtpServer.listen(smtpPort, '127.0.0.1', resolve);
    });
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
    await expect(page.getByRole('button', { name: /1\. verzió – SENT/ })).toBeVisible();

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
    await sendCurrentPreview(page, fixture.projectId, fixture.roundId);
    await expect.poll(() => messages.length).toBe(2);
    await expect(page.getByRole('button', { name: /2\. verzió – SENT/ })).toBeVisible();
    expect(messages[0]).not.toContain(answer);
    expect(messages[1]).toContain(answer);
    expect(messages[1]).toContain('Az ügyfél pontosította az elvárt eredményt.');

    await page.getByRole('button', { name: /1\. verzió – SENT/ }).click();
    await expect(page.locator('.history-content')).toContainText('Nincs rögzített válasz');
    await page.getByRole('button', { name: /2\. verzió – SENT/ }).click();
    await expect(page.locator('.history-content')).toContainText(answer);
  });
});

async function sendCurrentPreview(page: Page, projectId: string, roundId: string): Promise<void> {
  await nativeButton(page, 'send-handoff-button').click();
  await expect(page.getByRole('alertdialog', { name: 'Interjú-összefoglaló küldése' })).toBeVisible();
  const responsePromise = page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes(`/api/projects/${projectId}/rounds/${roundId}/customer-handoffs/`) && response.url().endsWith('/send'));
  await page.getByRole('button', { name: 'Küldés az ügyfélnek', exact: true }).last().click();
  expect((await responsePromise).status()).toBe(201);
}

async function createOpenInterview(request: APIRequestContext, testInfo: { readonly workerIndex: number }): Promise<{ projectId: string; roundId: string; snapshotId: string }> {
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
  return { projectId: project.id, roundId: round.id, snapshotId: round.questions[0].id };
}

async function apiJson<T>(request: APIRequestContext, method: 'GET' | 'POST', path: string, data?: unknown): Promise<T> {
  const response = await request.fetch(`http://127.0.0.1:3000${path}`, { method, data });
  expect(response.ok(), `${method} ${path} returned ${response.status()}`).toBeTruthy();
  return response.json() as Promise<T>;
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
      else if (command === 'DATA') { dataMode = true; socket.write('354 end with dot\r\n'); }
      else socket.write('500 unsupported\r\n');
    }
  });
}
