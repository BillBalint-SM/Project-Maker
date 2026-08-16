import { expect, test } from '@playwright/test';

test.describe.serial('OUTPUT-01 Markdown template library employee workflow', () => {
  test.setTimeout(120_000);

  test('publishes a template and generates an immutable canonical specification from it', async ({
    page,
    request,
  }, testInfo) => {
    const suffix = `${testInfo.workerIndex}-${Date.now()}`;
    const templateName = `Átadási sablon ${suffix}`;
    const projectResponse = await request.post('/api/projects', {
      data: {
        name: `OUTPUT-01 böngészős projekt ${suffix}`,
        customerContactName: 'Teszt Ügyfél',
        customerContactEmail: 'output-01@example.test',
      },
    });
    expect(projectResponse.status()).toBe(201);
    const project = (await projectResponse.json()) as { readonly id: string };

    await page.goto('/settings/markdown-templates');
    await expect(page.getByRole('heading', { name: 'Markdown beállítások' })).toBeVisible();
    await page.getByTestId('new-markdown-template-button').click();
    await page.getByTestId('markdown-template-name-input').fill(templateName);
    await page
      .getByTestId('markdown-template-content-input')
      .fill('# Átadási terv — {{project.name}}\n\n{{revision.metadata}}\n\n{{project.context}}');
    await page.getByTestId('save-markdown-template-button').click();
    await expect(page.getByTestId('markdown-template-feedback')).toContainText('Draft mentve');

    await page
      .getByTestId('markdown-template-content-input')
      .fill('# Átadási terv — {{project.name}}\n\n{{revision.metadata}}\n\n{{project.context}}\n\nMentett változat');
    await expect(page.getByTestId('preview-markdown-template-button').locator('button')).toBeDisabled();
    await expect(page.getByTestId('publish-markdown-template-button').locator('button')).toBeDisabled();
    await page.getByTestId('save-markdown-template-button').click();
    await expect(page.getByTestId('publish-markdown-template-button').locator('button')).toBeEnabled();

    await page.getByTestId('preview-markdown-template-button').click();
    await expect(page.getByTestId('markdown-template-preview')).toContainText('# Átadási terv — Minta projekt');
    await page.getByTestId('publish-markdown-template-button').click();
    await expect(page.getByTestId('markdown-template-version')).toContainText('Publikált v1');

    await page.goto(`/projects/${project.id}/markdown`);
    const templateSelect = page.getByTestId('markdown-template-select');
    const templateOption = templateSelect.locator('option').filter({ hasText: templateName });
    const templateId = await templateOption.getAttribute('value');
    expect(templateId).toBeTruthy();
    await templateSelect.selectOption(templateId!);
    await expect(page.getByTestId('markdown-generation-form')).toHaveClass(/ng-valid/);
    const generationResponse = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        response.url().includes(`/api/projects/${project.id}/markdown-revisions`),
      { timeout: 15_000 },
    );
    await page.getByTestId('generate-markdown-button').click();
    expect((await generationResponse).status()).toBe(201);

    await expect(page.getByTestId('markdown-revision-template')).toContainText(`${templateName} · v1`);
    await expect(page.getByTestId('markdown-content-preview')).toContainText('Átadási terv');
    await expect(page.getByTestId('markdown-content-preview')).not.toContainText('```json');

    await page.reload();
    await expect(templateSelect).toHaveValue(templateId!);

    const requiredTemplate = await request.post('/api/settings/markdown-templates', {
      data: {
        name: `Kötelező schema sablon ${suffix}`,
        draftContent: '# {{project.name}}\n\n{{project.schema}}',
      },
    });
    expect(requiredTemplate.status()).toBe(201);
    const required = (await requiredTemplate.json()) as { readonly id: string };
    expect((await request.post(`/api/settings/markdown-templates/${required.id}/publish`)).status()).toBe(201);

    const blockedProjectResponse = await request.post('/api/projects', {
      data: {
        name: `OUTPUT-01 hiányos projekt ${suffix}`,
        customerContactName: 'Teszt Ügyfél',
        customerContactEmail: 'output-01-blocked@example.test',
      },
    });
    const blockedProject = (await blockedProjectResponse.json()) as { readonly id: string };
    await page.goto(`/projects/${blockedProject.id}/markdown`);
    await page.getByTestId('markdown-template-select').selectOption(required.id);
    await page.getByTestId('generate-markdown-button').click();
    await expect(page.getByTestId('markdown-action-error')).toContainText('Elfogadott projekt-kérdésséma');

    expect((await request.post(`/api/projects/${blockedProject.id}/archive`)).status()).toBe(201);
    await page.getByTestId('generate-markdown-button').click();
    await expect(page.getByTestId('markdown-action-error')).toContainText('Archived projects');
  });
});
