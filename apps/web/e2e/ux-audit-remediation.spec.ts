import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

test.describe('UX audit remediation', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
  });

  test('recovers each shell attention resource independently without a retry storm', async ({ page }) => {
    let replyRequests = 0;
    let notificationRequests = 0;
    await page.route('**/api/customer-correspondences/summary', async (route) => {
      replyRequests += 1;
      if (replyRequests === 1) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Unavailable"}' });
        return;
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ newReplyCount: 4, projectCount: 1, projects: [] }),
      });
    });
    await page.route('**/api/notifications', async (route) => {
      notificationRequests += 1;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ items: [], totalCount: 0, limit: 25 }),
      });
    });

    await page.goto('/');
    await openNavigation(page);
    await expect(page.getByTestId('customer-reply-load-error')).toBeVisible();
    await page.getByTestId('retry-customer-reply-summary').click();

    await expect(page.getByTestId('global-customer-reply-count')).toHaveText('4');
    expect(replyRequests).toBe(2);
    expect(notificationRequests).toBe(1);

    await page.unrouteAll({ behavior: 'wait' });
    replyRequests = 0;
    notificationRequests = 0;
    await page.route('**/api/customer-correspondences/summary', async (route) => {
      replyRequests += 1;
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ newReplyCount: 0, projectCount: 0, projects: [] }),
      });
    });
    await page.route('**/api/notifications', async (route) => {
      notificationRequests += 1;
      if (notificationRequests === 1) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Unavailable"}' });
        return;
      }
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ items: [], totalCount: 5, limit: 25 }),
      });
    });

    await page.reload();
    await openNavigation(page);
    await expect(page.getByTestId('notification-load-error')).toBeVisible();
    await page.getByTestId('retry-notifications').click();

    await expect(page.getByLabel('5 active notifications')).toHaveText('5');
    expect(replyRequests).toBe(1);
    expect(notificationRequests).toBe(2);
  });

  test('keeps the authenticated navigation actionable when Sign out fails, then completes one retry', async ({ page }) => {
    let logoutRequests = 0;
    await page.route('**/api/auth/logout', async (route) => {
      logoutRequests += 1;
      if (logoutRequests === 1) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Sign out is temporarily unavailable."}' });
        return;
      }
      await route.fulfill({ status: 204 });
    });

    await page.goto('/');
    await openNavigation(page);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();

    await expect(page.getByTestId('navigation-panel')).toHaveClass(/open/);
    await expect(page.getByTestId('logout-error')).toContainText('Sign out is temporarily unavailable.');
    await page.getByRole('button', { name: 'Retry sign out', exact: true }).click();

    await expect(page).toHaveURL('/login');
    expect(logoutRequests).toBe(2);
  });

  test('guides first-time follow-up setup through the existing draft composer and persists enablement', async ({ page, request }) => {
    const project = await createProject(request, 'Follow-up prerequisite');

    await page.goto(`/projects/${project.id}/settings`);
    const enabled = page.getByTestId('follow-up-enabled-input');
    await expect(enabled).toBeDisabled();
    await page.getByTestId('open-follow-up-draft-composer').click();

    await expect(page).toHaveURL(`/projects/${project.id}/customer-correspondences#customer-communication`);
    await expect(page.getByTestId('follow-up-message-draft')).toBeVisible();
    await page.getByTestId('follow-up-message-draft').fill('Please confirm the remaining delivery decision.');
    await nativeButton(page, 'save-follow-up-draft-button').click();
    await expect(page.getByTestId('follow-up-draft-feedback')).toContainText('Customer follow-up draft saved');

    await page.goto(`/projects/${project.id}/settings`);
    await expect(enabled).toBeEnabled();
    await enabled.check();
    await nativeButton(page, 'save-follow-up-settings-button').click();
    await expect(page.getByTestId('follow-up-draft-feedback')).toContainText('settings saved');
    await page.reload();
    await expect(page.getByTestId('follow-up-enabled-value')).toHaveText('Enabled');
  });

  test('fails Formal Decision closed until an archived Project can be confirmed on Retry', async ({ page, request }) => {
    const project = await createProject(request, 'Archived decision guard');
    expect((await request.post(`/api/projects/${project.id}/archive`)).status()).toBe(201);
    let failProjectReads = true;
    let decisionPosts = 0;
    await page.route('**/api/projects', async (route) => {
      if (route.request().method() === 'GET' && failProjectReads) {
        await route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Unavailable"}' });
        return;
      }
      await route.continue();
    });
    await page.route(`**/api/projects/${project.id}/decisions`, async (route) => {
      if (route.request().method() === 'POST') decisionPosts += 1;
      await route.continue();
    });

    await page.goto(`/projects/${project.id}/decision-review`);
    await expect(page.getByTestId('formal-decision-availability-error')).toBeVisible();
    await expect(page.getByTestId('formal-decision-form')).toHaveCount(0);

    failProjectReads = false;
    await nativeButton(page, 'retry-formal-decision-availability').click();
    await expect(page.getByTestId('formal-decision-availability-archived')).toBeVisible();
    await expect(page.getByTestId('formal-decision-form')).toHaveCount(0);
    expect(decisionPosts).toBe(0);
  });
});

async function openNavigation(page: Page): Promise<void> {
  const toggle = page.getByTestId('navigation-toggle');
  if (await toggle.isVisible()) {
    if (await toggle.getAttribute('aria-expanded') !== 'true') await toggle.click();
  }
}

async function createProject(
  request: APIRequestContext,
  prefix: string,
): Promise<{ readonly id: string }> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const response = await request.post('/api/projects', {
    data: {
      name: `${prefix} ${suffix}`,
      customerContactName: 'Customer Contact',
      customerContactEmail: `ux-audit-${suffix}@example.test`,
      internalOwnerName: 'Internal Owner',
      nextActionOwnerRole: 'INTERNAL_OWNER',
    },
  });
  expect(response.status()).toBe(201);
  return response.json() as Promise<{ readonly id: string }>;
}

function nativeButton(page: Page, testId: string) {
  return page.getByTestId(testId).locator('button');
}
