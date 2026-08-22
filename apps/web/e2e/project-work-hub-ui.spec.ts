import { expect, test, type Locator, type Page } from '@playwright/test';
import path from 'node:path';

import {
  expectVisibleKeyboardFocus,
  tabTo,
} from './keyboard-assertions';

const captureScreenshots = process.env.CAPTURE_PROJECT_WORK_HUB_SCREENSHOTS === '1';
const screenshotDirectory = path.resolve(
  __dirname,
  '../../../docs/assets/user-guide',
);

const globalNavigationLabels = [
  'Portfolio',
  'Roadmap',
  'Notifications',
  'New project',
  'Active project queue',
  'Discovery follow-ups',
  'Specification templates',
  'Git connections',
  'Question Bank',
] as const;

test('exposes the exact global navigation and sends the reply count to the filtered work list', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
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
  await expect(replyCount).toHaveAccessibleName('Open 3 new Customer replies');
  if (captureScreenshots) {
    await expect(page.getByText('Weboldal megújítás', { exact: true })).toBeVisible();
    await page.screenshot({
      path: path.join(screenshotDirectory, '11-project-work-hub-desktop.png'),
      fullPage: true,
    });
  }
  const mainNavigation = page.getByRole('navigation', { name: 'Main navigation' });
  const navigationToggle = page.getByTestId('navigation-toggle');
  await expect(navigationToggle).toHaveAttribute('aria-expanded', 'false');
  await tabTo(
    page,
    page.getByRole('link', { name: 'Project Maker portfolio overview' }),
  );
  await tabTo(page, navigationToggle);
  await page.keyboard.press('Enter');
  await expect(navigationToggle).toHaveAttribute('aria-expanded', 'true');
  await expect(mainNavigation).toBeVisible();

  const focusSequence = [
    mainNavigation.getByRole('link', { name: 'Portfolio', exact: true }),
    mainNavigation.getByRole('link', { name: 'Roadmap', exact: true }),
    mainNavigation.getByRole('link', { name: 'Notifications', exact: true }),
    mainNavigation.getByRole('link', { name: 'New project', exact: true }),
    mainNavigation.getByRole('link', {
      name: 'Active project queue',
      exact: true,
    }),
    replyCount,
    mainNavigation.getByRole('link', { name: 'Discovery follow-ups', exact: true }),
    mainNavigation.getByRole('link', {
      name: 'Specification templates',
      exact: true,
    }),
    mainNavigation.getByRole('link', { name: 'Git connections', exact: true }),
    mainNavigation.getByRole('link', {
      name: 'Question Bank',
      exact: true,
    }),
    page.getByTestId('active-project-queue-link'),
  ];
  for (const target of focusSequence) {
    await tabTo(page, target);
  }
  for (let step = 0; step < 7; step += 1) {
    await page.keyboard.press('Shift+Tab');
  }
  await expectVisibleKeyboardFocus(replyCount);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/projects/active?urgency=CUSTOMER_REPLY');
  await expect(page.getByRole('checkbox', { name: 'New Customer reply' })).toBeChecked();
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
    page.getByRole('heading', { name: 'Discovery follow-ups could not be loaded' }),
  ).toBeVisible();
  const retry = page.getByTestId('follow-ups-retry');
  await tabTo(page, retry);
  await page.keyboard.press('Enter');

  const row = page.getByTestId('open-follow-up-row').filter({ hasText: question });
  await expect(row).toBeVisible();
  await expect(row.getByRole('term')).toHaveText(['Owner', 'Due date', 'Next action']);
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
  await tabTo(page, openAction);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(
    `/projects/${project.id}/readiness?returnTo=%2Ffollow-ups#discovery-follow-ups`,
  );
  const returnLink = page.getByTestId('project-context-return');
  await expect(returnLink).toContainText('Back to Discovery Follow-ups');
  await tabTo(page, returnLink);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/follow-ups');
  await expect(page.getByTestId('open-follow-up-row').filter({ hasText: question })).toBeVisible();
});

test('keeps every Project journey context usable at 390 px', async ({ page }) => {
  const uniquePart = `narrow-journey-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const createdProject = await page.request.post('/api/projects', {
    data: {
      name: `Keskeny projektút ${uniquePart}`,
      customerContactName: 'Minta Kapcsolattartó',
      customerContactEmail: `${uniquePart}@example.test`,
      internalOwnerName: 'Kovács Anna',
      nextActionOwnerRole: 'INTERNAL_OWNER',
      nextAction: 'Készítsd elő a következő egyeztetést.',
    },
  });
  expect(createdProject.status()).toBe(201);
  const project = (await createdProject.json()) as { readonly id: string };

  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto('/');
  await expectNarrowPage(
    page,
    'Portfolio Overview',
    page.getByTestId('active-project-queue-link'),
  );

  await page.goto(`/projects/active?q=${encodeURIComponent(uniquePart)}`);
  await expectNarrowPage(
    page,
    'Active Project Queue',
    page.getByTestId(`queue-action-${project.id}`),
  );
  await expect(page.getByTestId(`queue-project-${project.id}`)).toBeVisible();

  await page.goto(`/projects/${project.id}/status`);
  await expectNarrowPage(
    page,
    'Project Status',
    page.getByTestId('project-status-edit-coordination'),
  );

  await page.goto(`/projects/${project.id}/interview`);
  await expectNarrowPage(
    page,
    'Initial Intake',
    page.getByTestId('publish-project-schema-button').locator('button'),
  );

  await page.goto(`/projects/${project.id}/readiness`);
  await expectNarrowPage(
    page,
    'Estimation Readiness',
    page.getByTestId('project-context-primary-action'),
  );
  await expect(
    page.getByTestId('readiness-review-unavailable-no-initial-intake'),
  ).toBeVisible();

  await page.goto(`/projects/${project.id}/decision-review`);
  await expectNarrowPage(
    page,
    'Decision Review',
    page.getByTestId('save-decision-review-button').locator('button'),
  );

  await page.goto(`/projects/${project.id}/markdown`);
  await expectNarrowPage(
    page,
    'Project Specification',
    page.getByTestId('generate-markdown-button'),
  );

  await page.goto(`/projects/${project.id}/settings`);
  await expectNarrowPage(
    page,
    'Project Settings',
    page.getByTestId('save-project-basics').locator('button'),
  );
});

async function expectNarrowPage(
  page: Page,
  heading: string,
  reachableAction: Locator,
): Promise<void> {
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  await reachableAction.scrollIntoViewIfNeeded();
  await expect(reachableAction).toBeVisible();
  await expect(reachableAction).toBeInViewport();

  const viewportWidth = await page.evaluate(() => window.innerWidth);
  const actionBox = await reachableAction.boundingBox();
  expect(actionBox).not.toBeNull();
  expect(actionBox!.x).toBeGreaterThanOrEqual(0);
  expect(actionBox!.x + actionBox!.width).toBeLessThanOrEqual(viewportWidth);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}
