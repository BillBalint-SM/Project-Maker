import { expect, test, type APIRequestContext } from '@playwright/test';

interface ProjectWorkspace {
  readonly id: string;
}

test('opens the latest Initial Intake customer handoff without a legacy send control', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'handoff-navigation');
  const bank = await apiJson<{ questions: readonly { stableKey: string }[] }>(
    request,
    'GET',
    '/settings/base-questions',
  );
  const stableKey = bank.questions[0]?.stableKey;
  if (!stableKey) throw new Error('The seeded Question Bank is empty.');
  await apiJson(request, 'POST', `/projects/${project.id}/question-schema`, {
    questions: [{ stableKey, required: true, blocking: true }],
  });
  const round = await apiJson<{ id: string }>(
    request,
    'POST',
    `/projects/${project.id}/rounds`,
    { type: 'INITIAL_INTAKE' },
  );
  await apiJson(
    request,
    'POST',
    `/projects/${project.id}/rounds/${round.id}/finish`,
    {},
  );

  await page.goto(`/projects/${project.id}`);
  await expect(page.getByTestId('follow-up-card')).toBeVisible();
  await expect(page.getByTestId('send-customer-review-email-button')).toHaveCount(0);
  await page.getByTestId('open-interview-handoff-button').click();

  await expect(page).toHaveURL(`/projects/${project.id}/interview#customer-handoff`);
  await expect(page.getByTestId('interview-handoff')).toBeVisible();
});

test('explains the Felmérés prerequisite when no Initial Intake exists', async ({
  page,
  request,
}) => {
  const project = await createProject(request, 'missing-intake');

  await page.goto(`/projects/${project.id}`);
  await expect(page.getByTestId('follow-up-card')).toBeVisible();
  await expect(page.getByTestId('send-customer-review-email-button')).toHaveCount(0);
  await page.getByTestId('open-interview-handoff-button').click();

  await expect(page).toHaveURL(`/projects/${project.id}/interview#customer-handoff`);
  await expect(page.getByTestId('interview-handoff-prerequisite')).toContainText(
    'Előbb fogadd el a kérdéssémát és indítsd el az Initial Intake felmérést',
  );
  await expect(page.getByTestId('project-schema-status')).toBeVisible();
});

async function createProject(
  request: APIRequestContext,
  label: string,
): Promise<ProjectWorkspace> {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  return apiJson<ProjectWorkspace>(request, 'POST', '/projects', {
    name: `SMTP határ ${label} ${suffix}`,
    customerContactName: 'Teszt Kapcsolattartó',
    customerContactEmail: `smtp-boundary-${suffix}@example.test`,
    internalOwnerName: 'Teszt PO/PM',
    nextActionOwnerRole: 'INTERNAL_OWNER',
  });
}

async function apiJson<T>(
  request: APIRequestContext,
  method: 'GET' | 'POST',
  path: string,
  data?: unknown,
): Promise<T> {
  const response =
    method === 'GET'
      ? await request.get(`/api${path}`)
      : await request.post(`/api${path}`, { data });
  if (!response.ok()) {
    throw new Error(`${method} ${path} failed with HTTP ${response.status()}.`);
  }
  return (await response.json()) as T;
}
