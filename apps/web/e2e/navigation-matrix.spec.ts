import { expect, test, type Locator, type Page } from '@playwright/test';

test('opens every employee workspace destination through its real navigation binding', async ({
  page,
  request,
}) => {
  const pageErrors: Error[] = [];
  page.on('pageerror', (error) => pageErrors.push(error));

  const globalDestinations = [
    ['Portfolio', '/', 'Portfolio | Project Maker'],
    ['Roadmap', '/roadmap', 'Business roadmap | Project Maker'],
    ['Notifications', '/notifications', 'Notifications | Project Maker'],
    ['New project', '/projects/new', 'New project | Project Maker'],
    ['Active project queue', '/projects/active', 'Active project queue | Project Maker'],
    ['Discovery follow-ups', '/follow-ups', 'Discovery follow-ups | Project Maker'],
    [
      'Specification templates',
      '/settings/markdown-templates',
      'Specification templates | Project Maker',
    ],
    ['Git connections', '/settings/git-setups', 'Git connections | Project Maker'],
    ['Question Bank', '/settings/questions', 'Question Bank | Project Maker'],
    [
      'Question Templates',
      '/settings/question-templates',
      'Question Templates | Project Maker',
    ],
    ['Account', '/account', 'My account | Project Maker'],
  ] as const;

  await page.goto('/');
  for (const [label, path, title] of globalDestinations) {
    const panel = await openNavigation(page);
    await panel.getByRole('link', { name: label, exact: true }).click();
    await expect(page).toHaveURL(path);
    await expect(page).toHaveTitle(title);
    await expect(page.locator('#main-content')).toBeVisible();
  }

  const panel = await openNavigation(page);
  await panel.getByRole('link', { name: /Open visual Workspace Map/ }).click();
  await expect(page).toHaveURL('/workspace-map');
  await expect(page).toHaveTitle('Workspace Map | Project Maker');

  const unique = `navigation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const created = await request.post('/api/projects', {
    data: {
      name: `Navigation matrix ${unique}`,
      customerContactName: 'Navigation Customer',
      customerContactEmail: `${unique}@example.test`,
      internalOwnerName: 'Navigation Owner',
    },
  });
  expect(created.status()).toBe(201);
  const project = (await created.json()) as { readonly id: string };

  const projectDestinations = [
    ['status', 'status', 'Project status | Project Maker'],
    ['interview', 'interview', 'Initial Intake | Project Maker'],
    ['discovery', 'discovery', 'Discovery | Project Maker'],
    ['readiness', 'readiness', 'Estimation readiness | Project Maker'],
    ['decision-review', 'decision-review', 'Decision Review | Project Maker'],
    ['markdown', 'markdown', 'Project specification | Project Maker'],
    ['delivery', 'delivery', 'Delivery package | Project Maker'],
    ['settings', 'settings', 'Project settings | Project Maker'],
  ] as const;

  await page.goto(`/projects/${project.id}/status`);
  for (const [testIdSuffix, path, title] of projectDestinations) {
    await page.getByTestId(`project-context-nav-${testIdSuffix}`).click();
    await expect(page).toHaveURL(
      (url) =>
        url.pathname === `/projects/${project.id}/${path}` &&
        url.searchParams.get('returnTo') === '/',
    );
    await expect(page).toHaveTitle(title);
    await expect(page.getByTestId('project-context-shell')).toBeVisible();
  }

  await page.getByTestId('project-context-nav-status').click();
  await page.getByTestId('project-status-open-customer-communication').click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname ===
        `/projects/${project.id}/customer-correspondences` &&
      url.searchParams.get('returnTo') === '/',
  );
  await expect(page).toHaveTitle('Customer correspondence | Project Maker');
  await expect(page.getByTestId('project-context-shell')).toBeVisible();

  expect(pageErrors).toEqual([]);
});

async function openNavigation(page: Page): Promise<Locator> {
  const toggle = page.getByTestId('navigation-toggle');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
  const panel = page.getByTestId('navigation-panel');
  await expect(panel).toBeVisible();
  return panel;
}
