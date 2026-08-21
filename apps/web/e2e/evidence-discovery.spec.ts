import { expect, test, type Locator, type Page } from '@playwright/test';

test('runs the non-general playbook → contact → Stakeholder answer → Insight path', async ({ page }) => {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await page.goto('/projects/new');
  await page.getByTestId('project-name-input').fill(`Integrációs discovery ${unique}`);
  await page.getByTestId('internal-owner-name-input').fill('Belső PO');
  await page.getByTestId('customer-contact-name-input').fill('Ügyfélkapcsolat');
  await page.getByTestId('customer-contact-email-input').fill(`discovery-${unique}@example.test`);
  await page.getByTestId('project-playbook-select').selectOption('system-integration:1');
  await (await nativeButton(page, 'create-project-submit')).click();

  await expect(page).toHaveURL(/\/projects\/[^/]+\/interview$/);
  await expect(page.getByText('Integrációs nézőpont', { exact: false }).first()).toBeVisible();
  await (await nativeButton(page, 'publish-project-schema-button')).click();
  await expect(page.getByTestId('active-round-resume-state')).toBeVisible();

  await page.getByTestId('project-context-nav-discovery').click();
  await page.getByTestId('discovery-contact-name').fill('Integrációs szakértő');
  await (await nativeButton(page, 'save-discovery-contact')).click();
  await expect(page.getByText('Integrációs szakértő', { exact: true })).toBeVisible();

  await (await nativeButton(page, 'start-additional-round')).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/interview\?.*roundId=/);
  const firstAnswer = page.locator('[data-testid^="round-answer-textarea-"]').first();
  await firstAnswer.fill('A REST szerződés az első integrációs forrás.');
  const firstSaveState = page.locator('[data-testid^="round-answer-save-state-"]').first();
  await expect(firstSaveState).toContainText('Mentve');

  await page.getByTestId('project-context-nav-discovery').click();
  await page.getByTestId('insight-statement').fill('Az első szállítás egyetlen REST integrációra szűkíthető.');
  await page.getByTestId('insight-answer-source').selectOption({ index: 1 });
  await (await nativeButton(page, 'save-insight')).click();
  await expect(page.getByText('Az első szállítás egyetlen REST integrációra szűkíthető.', { exact: true })).toBeVisible();
  await expect(page.getByText(/1 forrás/)).toBeVisible();
});

async function nativeButton(page: { getByTestId(testId: string): Locator }, testId: string): Promise<Locator> {
  const button = page.getByTestId(testId).locator('button');
  await expect(button).toHaveCount(1);
  return button;
}
