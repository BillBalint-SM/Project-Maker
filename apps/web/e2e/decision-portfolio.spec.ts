import { expect, test, type Locator, type Page } from '@playwright/test';

test('connects project status, formal decision, roadmap, and filtered portfolio', async ({ page }) => {
  test.setTimeout(60_000);
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const projectName = `Portfólió projekt ${unique}`;
  const goalName = `Üzleti cél ${unique}`;
  const initiativeName = `Kezdeményezés ${unique}`;

  await page.goto('/projects/new');
  await page.getByTestId('project-name-input').fill(projectName);
  await page.getByTestId('internal-owner-name-input').fill('Belső PO');
  await page.getByTestId('customer-contact-name-input').fill('Ügyfélkapcsolat');
  await page.getByTestId('customer-contact-email-input').fill(`portfolio-${unique}@example.test`);
  await (await nativeButton(page, 'create-project-submit')).click();

  await page.getByTestId('project-context-nav-status').click();
  await page.getByTestId('status-health').selectOption('BLOCKED');
  await page.getByTestId('status-summary').fill('A külső függőség blokkolja a projektet.');
  await page.getByTestId('status-next-step').fill('Beszállítói döntés megszerzése.');
  await (await nativeButton(page, 'save-status-update')).click();
  await expect(page.getByTestId('status-update-history')).toContainText('Blocked');

  await page.getByTestId('project-context-nav-decision-review').click();
  await page.getByTestId('formal-decision-outcome').selectOption('GO');
  await page.getByTestId('formal-decision-maker').fill('Terméktanács');
  await page.getByTestId('formal-decision-rationale').fill('A szükséges üzleti eredmény és a szállítási út tiszta.');
  await (await nativeButton(page, 'save-formal-decision')).click();
  await expect(page.getByTestId('formal-decision-history')).toContainText('Go');

  await page.getByTestId('global-roadmap-link').click();
  await page.getByTestId('new-goal-name').fill(goalName);
  await (await nativeButton(page, 'create-goal')).click();
  await page.getByTestId('new-initiative-name').fill(initiativeName);
  await (await nativeButton(page, 'create-initiative')).click();
  const assignment = page
    .getByText(projectName, { exact: true })
    .locator('..')
    .getByTestId('project-initiative-assignment');
  const initiativeId = await assignment
    .getByRole('option', { name: initiativeName, exact: true })
    .getAttribute('value');
  expect(initiativeId).not.toBeNull();
  await assignment.selectOption({ label: initiativeName });
  await expect(page.getByTestId('roadmap-goals')).toContainText(projectName);
  await page.reload();
  await expect(
    page
      .getByText(projectName, { exact: true })
      .locator('..')
      .getByTestId('project-initiative-assignment'),
  ).toHaveValue(initiativeId!);

  await page.getByTestId('global-portfolio-link').click();
  await page.getByTestId('portfolio-health-filter').selectOption('BLOCKED');
  await page.getByTestId('portfolio-decision-filter').selectOption('GO');
  await (await nativeButton(page, 'apply-portfolio-filters')).click();
  await expect(page.getByTestId('portfolio-results')).toContainText(projectName);
  await expect(page.getByTestId('portfolio-results')).toContainText(goalName);
});

async function nativeButton(page: Page, testId: string): Promise<Locator> {
  const host = page.getByTestId(testId);
  const nested = host.locator('button');
  return (await nested.count()) === 1 ? nested : host;
}
