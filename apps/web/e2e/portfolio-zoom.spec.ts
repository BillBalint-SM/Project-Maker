import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

test('scales Journey and Queue progressively across browser zoom-equivalent viewports', async ({
  page,
  request,
}) => {
  const runKey = `zoom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await createProject(request, `Zoom route ${runKey}`, `${runKey}@example.test`);
  await createProject(
    request,
    `Zoom route later ${runKey}`,
    `${runKey}-later@example.test`,
  );

  const widths = [
    { width: 1024, minimumRatio: 0.9, maximumRatio: 1 },
    { width: 1920, minimumRatio: 0.75, maximumRatio: 0.9 },
    { width: 2560, minimumRatio: 0.64, maximumRatio: 0.82 },
    { width: 3840, minimumRatio: 0.55, maximumRatio: 0.72 },
  ] as const;

  for (const expectation of widths) {
    await page.setViewportSize({ width: expectation.width, height: 1000 });
    await page.goto(`/?q=${runKey}`);
    await expect(page.getByRole('heading', { name: 'Project Journey' })).toBeVisible();
    await expect(page.locator('.journey-stage')).toHaveCount(6);
    await expect(page.locator('.journey-node')).toHaveCount(2);
    await expectShellRatio(page, expectation);

    await page.getByTestId('active-project-queue-link').click();
    await expect(page).toHaveURL(new RegExp(`/projects/active\\?q=${runKey}`));
    await expect(page.getByRole('heading', { name: 'Queue', exact: true })).toBeVisible();
    await expect(page.locator('.queue-row')).toHaveCount(2);
    await expectShellRatio(page, expectation);
  }
});

async function expectShellRatio(
  page: Page,
  expectation: {
    readonly width: number;
    readonly minimumRatio: number;
    readonly maximumRatio: number;
  },
): Promise<void> {
  const geometry = await page.locator('.app-main').evaluate((main) => {
    const mainBox = main.getBoundingClientRect();
    const headerBox = document.querySelector('.header-inner')!.getBoundingClientRect();
    return {
      documentFits:
        document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      mainLeft: mainBox.left,
      mainWidth: mainBox.width,
      headerLeft: headerBox.left,
      headerWidth: headerBox.width,
      viewportWidth: document.documentElement.clientWidth,
    };
  });

  expect(geometry.documentFits).toBe(true);
  expect(geometry.mainWidth / geometry.viewportWidth).toBeGreaterThanOrEqual(
    expectation.minimumRatio,
  );
  expect(geometry.mainWidth / geometry.viewportWidth).toBeLessThanOrEqual(
    expectation.maximumRatio,
  );
  expect(Math.abs(geometry.mainWidth - geometry.headerWidth)).toBeLessThan(1);
  expect(Math.abs(geometry.mainLeft - geometry.headerLeft)).toBeLessThan(1);
}

async function createProject(
  request: APIRequestContext,
  name: string,
  customerContactEmail: string,
): Promise<void> {
  const response = await request.post('/api/projects', {
    data: {
      name,
      customerContactName: 'Zoom Test Customer',
      customerContactEmail,
      internalOwnerName: 'Zoom Test Owner',
      nextActionOwnerRole: 'INTERNAL_OWNER',
      nextAction: 'Validate the responsive portfolio.',
    },
  });
  expect(response.status()).toBe(201);
}
