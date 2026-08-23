import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({ contentType: 'application/json', body: 'null' });
  });
});

test('defaults to dark and persists an explicit light-theme choice', async ({ page }) => {
  await page.goto('/login');
  await page.evaluate(() => window.localStorage.removeItem('project-maker:theme'));
  await page.reload();

  await expect(page.locator('html')).toHaveClass(/pm-dark/);
  await expect(page.getByRole('button', { name: 'Switch to light theme' })).toBeVisible();

  await page.getByRole('button', { name: 'Switch to light theme' }).click();

  await expect(page.locator('html')).toHaveClass(/pm-light/);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem('project-maker:theme'))).toBe('light');

  await page.reload();
  await expect(page.locator('html')).toHaveClass(/pm-light/);
  await expect(page.getByRole('button', { name: 'Switch to dark theme' })).toBeVisible();
});

test('keeps authentication usable without horizontal overflow on compact viewports', async ({ page }) => {
  for (const width of [320, 375, 414, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
    const themeToggle = page.getByRole('button', { name: /Switch to (light|dark) theme/ });
    await expect(themeToggle).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth))
      .toBe(true);

    const [themeBox, lockupBox] = await Promise.all([
      themeToggle.boundingBox(),
      page.locator('.auth-lockup').boundingBox(),
    ]);
    expect(themeBox).not.toBeNull();
    expect(lockupBox).not.toBeNull();
    expect(
      themeBox!.x + themeBox!.width <= lockupBox!.x ||
      lockupBox!.x + lockupBox!.width <= themeBox!.x ||
      themeBox!.y + themeBox!.height <= lockupBox!.y ||
      lockupBox!.y + lockupBox!.height <= themeBox!.y,
    ).toBe(true);
  }
});

test('keeps the authenticated workspace map single-column and scrollable on compact viewports', async ({ page }) => {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: '11111111-1111-4111-8111-111111111111',
        email: 'long.project.owner@example.test',
      }),
    });
  });
  await page.route('**/api/customer-correspondences/summary', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ newReplyCount: 0, projectCount: 0, projects: [] }),
    });
  });
  await page.route('**/api/notifications', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [], totalCount: 0, limit: 25 }),
    });
  });
  await page.route('**/api/projects/portfolio-page**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [], totalCount: 0, page: 1, pageSize: 20, pageCount: 0 }),
    });
  });
  await page.route('**/api/customer-mailbox-sync', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        mailboxAddress: null,
        state: 'NOT_CONFIGURED',
        baselineEstablished: false,
        lastSuccessfulSyncAt: null,
        refreshInProgress: false,
      }),
    });
  });

  for (const width of [320, 375, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');

    const toggle = page.getByTestId('navigation-toggle');
    await expect(toggle).toBeVisible();
    await toggle.click();

    const panel = page.getByTestId('navigation-panel');
    const navigation = page.getByRole('navigation', { name: 'Main navigation' });
    await expect(panel).toHaveClass(/open/);
    await expect(navigation).toBeVisible();

    const geometry = await panel.evaluate((element) => {
      const panelBox = element.getBoundingClientRect();
      const navBox = element.querySelector('nav')!.getBoundingClientRect();
      return {
        documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
        navWidth: navBox.width,
        panelLeft: panelBox.left,
        panelRight: panelBox.right,
        panelScrolls: getComputedStyle(element).overflowY === 'auto',
      };
    });
    expect(geometry.documentFits).toBe(true);
    expect(geometry.navWidth).toBeGreaterThan(width - 40);
    expect(geometry.panelLeft).toBeGreaterThanOrEqual(0);
    expect(geometry.panelRight).toBeLessThanOrEqual(width);
    expect(geometry.panelScrolls).toBe(true);

    const signOut = page.getByRole('button', { name: 'Sign out' });
    await signOut.scrollIntoViewIfNeeded();
    await expect(signOut).toBeVisible();
    await expect(signOut).toHaveCSS('white-space', 'nowrap');
  }
});

test('loads one selected interactive Workspace Map and follows the application theme', async ({ page }) => {
  await page.route('**/api/auth/session', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        id: '11111111-1111-4111-8111-111111111111',
        email: 'po@example.test',
      }),
    });
  });
  await page.route('**/api/customer-correspondences/summary', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ newReplyCount: 0, projectCount: 0, projects: [] }),
    });
  });
  await page.route('**/api/notifications', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ items: [], totalCount: 0, limit: 25 }),
    });
  });

  await page.setViewportSize({ width: 375, height: 900 });
  await page.goto('/workspace-map?view=user-workflow');

  await expect(page.getByRole('heading', { name: 'Project Maker Workspace Map' })).toBeVisible();
  await expect(page.locator('.map-selector a')).toHaveCount(5);
  await expect(page.getByTestId('workspace-map-option-user-workflow')).toHaveAttribute(
    'aria-current',
    'page',
  );
  const frame = page.getByTestId('workspace-map-frame');
  await expect(frame).toHaveAttribute(
    'src',
    /project-maker-user-workflow\.html\?embed=1&theme=dark$/,
  );
  await expect(
    page.frameLocator('[data-testid="workspace-map-frame"]').locator('svg[role="img"]'),
  ).toBeVisible();

  await page.getByRole('button', { name: 'Switch to light theme' }).click();
  await expect(frame).toHaveAttribute(
    'src',
    /project-maker-user-workflow\.html\?embed=1&theme=light$/,
  );

  await page.getByTestId('workspace-map-option-customer-communication').click();
  await expect(page).toHaveURL(/\/workspace-map\?view=customer-communication$/);
  await expect(
    page.getByRole('heading', { name: 'Customer Correspondence Send and Reply Flow' }),
  ).toBeVisible();
  await expect(frame).toHaveAttribute(
    'src',
    /project-maker-customer-communication\.html\?embed=1&theme=light$/,
  );
  await expect
    .poll(() =>
      page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    )
    .toBe(true);
});
