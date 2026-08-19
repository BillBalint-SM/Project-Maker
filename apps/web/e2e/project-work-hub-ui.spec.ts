import { expect, test } from '@playwright/test';
import path from 'node:path';

const captureScreenshots = process.env.CAPTURE_PROJECT_WORK_HUB_SCREENSHOTS === '1';
const screenshotDirectory = path.resolve(
  __dirname,
  '../../../docs/assets/user-guide',
);

const globalNavigationLabels = [
  'Áttekintő',
  'Új projekt',
  'Folyamatban lévő ügyek',
  'Utánkövetések',
  'Markdown beállítások',
  'Kérdésbank beállítások',
] as const;

test('exposes the exact global navigation and sends the reply count to the filtered work list', async ({
  page,
}) => {
  await page.route('**/api/customer-correspondences/summary', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ newReplyCount: 3, projectCount: 1, projects: [] }),
    });
  });
  if (captureScreenshots) {
    const project = await page.request.post('/api/projects', {
      data: {
        name: 'Weboldal megújítás',
        customerContactName: 'Minta Kapcsolattartó',
        customerContactEmail: 'weboldal-megujitas@example.test',
        internalOwnerName: 'Kovács Anna',
        nextActionOwnerRole: 'INTERNAL_OWNER',
        nextAction: 'Egyeztesd a jóváhagyási időpontot.',
        dueAt: '2026-08-25T10:00:00.000Z',
      },
    });
    expect(project.status()).toBe(201);
  }

  await page.goto('/');

  await expect(page.locator('[data-nav-label]')).toHaveText(globalNavigationLabels);
  const replyCount = page.getByTestId('global-customer-reply-count');
  await expect(replyCount).toHaveAccessibleName('3 új ügyfélválasz megnyitása');
  if (captureScreenshots) {
    await expect(page.getByText('Weboldal megújítás', { exact: true })).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotDirectory, '11-project-work-hub-desktop.png'),
      fullPage: true,
    });
  }
  await replyCount.focus();
  await expect(replyCount).toBeFocused();
  await replyCount.press('Enter');
  await expect(page).toHaveURL('/projects/active?urgency=CUSTOMER_REPLY');
  await expect(page.getByRole('checkbox', { name: 'Új ügyfélválasz' })).toBeChecked();
});

test('recovers the global follow-up list, reflows at 390 px, and returns to its exact context', async ({
  page,
}) => {
  const suffix = captureScreenshots
    ? 'minta'
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const projectName = `Átadási próba ${suffix}`;
  const question = `Ki hagyja jóvá a csomagot ${suffix}?`;
  const createdProject = await page.request.post('/api/projects', {
    data: {
      name: projectName,
      customerContactName: 'Minta Kapcsolattartó',
      customerContactEmail: `ui-copy-${suffix}@example.test`,
      internalOwnerName: 'Kovács Anna',
    },
  });
  expect(createdProject.status()).toBe(201);
  const project = (await createdProject.json()) as { readonly id: string };
  const createdFollowUp = await page.request.post(
    `/api/projects/${project.id}/discovery-follow-ups`,
    {
      data: {
        category: 'BUSINESS',
        question,
        owner: 'Kovács Anna',
        dueDate: '2026-09-21',
        nextStep: 'Egyeztesd a jóváhagyási időpontot.',
      },
    },
  );
  expect(createdFollowUp.status()).toBe(201);

  let failFirstRead = true;
  await page.route('**/api/discovery-follow-ups/open', async (route) => {
    if (failFirstRead) {
      failFirstRead = false;
      await route.abort('failed');
      return;
    }
    await route.continue();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/follow-ups');

  await expect(
    page.getByRole('heading', { name: 'Az utánkövetések most nem tölthetők be' }),
  ).toBeVisible();
  await page.getByTestId('follow-ups-retry').click();

  const row = page.getByTestId('open-follow-up-row').filter({ hasText: question });
  await expect(row).toBeVisible();
  await expect(row.getByRole('term')).toHaveText(['Felelős', 'Határidő', 'Következő lépés']);
  await expect(row).toContainText(projectName);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  if (captureScreenshots) {
    await page.screenshot({
      path: path.join(screenshotDirectory, '12-project-work-hub-narrow.png'),
      fullPage: true,
    });
  }

  const openAction = row.getByTestId('open-follow-up-action');
  await openAction.focus();
  await expect(openAction).toBeFocused();
  await openAction.press('Enter');
  await expect(page).toHaveURL(
    `/projects/${project.id}/readiness?returnTo=%2Ffollow-ups#discovery-follow-ups`,
  );
  const returnLink = page.getByTestId('project-context-return');
  await expect(returnLink).toContainText('Vissza az utánkövetésekhez');
  await returnLink.press('Enter');
  await expect(page).toHaveURL('/follow-ups');
  await expect(page.getByTestId('open-follow-up-row').filter({ hasText: question })).toBeVisible();
});
