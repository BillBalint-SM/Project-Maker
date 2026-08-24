import { expect, test } from '@playwright/test';

import {
  expectVisibleKeyboardFocus,
  tabTo,
} from './keyboard-assertions';

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
  'Question Templates',
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
  await page.goto('/');

  await expect(page.locator('[data-nav-label]')).toHaveText(globalNavigationLabels);
  const replyCount = page.getByTestId('global-customer-reply-count');
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
  await expect(replyCount).toHaveAccessibleName('Open 3 new Customer replies');

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
  ];
  for (const target of focusSequence) {
    await tabTo(page, target);
  }
  for (let step = 0; step < 4; step += 1) {
    await page.keyboard.press('Shift+Tab');
  }
  await expectVisibleKeyboardFocus(replyCount);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL('/projects/active?urgency=CUSTOMER_REPLY');
  await expect(page.getByRole('checkbox', { name: 'New Customer reply' })).toBeChecked();
});

test('recovers the global follow-up list and returns to its exact context', async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
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
  await page.setViewportSize({ width: 1280, height: 720 });
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
