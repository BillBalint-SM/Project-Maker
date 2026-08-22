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
  await expect(page.getByText('Integration perspective', { exact: false }).first()).toBeVisible();
  await (await nativeButton(page, 'publish-project-schema-button')).click();
  await expect(page.getByTestId('active-round-resume-state')).toBeVisible();

  await page.getByTestId('project-context-nav-discovery').click();
  await page.getByTestId('discovery-contact-name').fill('Integrációs szakértő');
  await page.getByRole('textbox', { name: 'Email', exact: true }).fill('szakerto@example.test');
  await page.getByRole('textbox', { name: 'Phone', exact: true }).fill('+36 30 123 4567');
  await page.getByRole('textbox', { name: 'Notes', exact: true }).fill('Az első integráció technikai kapcsolattartója.');
  await (await nativeButton(page, 'save-discovery-contact')).click();
  await expect(page.getByText('Integrációs szakértő', { exact: true })).toBeVisible();
  await page.reload();
  const contact = page.getByRole('listitem').filter({ hasText: 'Integrációs szakértő' });
  await contact.getByRole('button', { name: 'Edit' }).click();
  await expect(page.getByTestId('discovery-contact-name')).toHaveValue('Integrációs szakértő');
  await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue('szakerto@example.test');
  await expect(page.getByRole('textbox', { name: 'Phone', exact: true })).toHaveValue('+36 30 123 4567');
  await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue('Az első integráció technikai kapcsolattartója.');
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByTestId('discovery-contact-name')).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Phone', exact: true })).toHaveValue('');
  await expect(page.getByRole('textbox', { name: 'Notes', exact: true })).toHaveValue('');

  await (await nativeButton(page, 'start-additional-round')).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/interview\?.*roundId=/);
  const firstAnswer = page.locator('[data-testid^="round-answer-textarea-"]').first();
  await firstAnswer.fill('A REST szerződés az első integrációs forrás.');
  const firstSaveState = page.locator('[data-testid^="round-answer-save-state-"]').first();
  await expect(firstSaveState).toContainText('Saved');

  await page.getByTestId('project-context-nav-discovery').click();
  await page.getByTestId('insight-statement').fill('Az első szállítás egyetlen REST integrációra szűkíthető.');
  await page.getByTestId('insight-answer-source').selectOption({ index: 1 });
  await (await nativeButton(page, 'save-insight')).click();
  await expect(page.getByText('Az első szállítás egyetlen REST integrációra szűkíthető.', { exact: true })).toBeVisible();
  await expect(page.getByText(/1 sources/)).toBeVisible();
});

async function nativeButton(page: { getByTestId(testId: string): Locator }, testId: string): Promise<Locator> {
  const button = page.getByTestId(testId).locator('button');
  await expect(button).toHaveCount(1);
  return button;
}
