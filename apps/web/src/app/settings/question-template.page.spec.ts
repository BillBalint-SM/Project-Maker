import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';
import type { BaseQuestionBank, QuestionTemplateSummary } from '@project-maker/contracts';

import { appConfig } from '../app.config';
import { QuestionBankApiService } from './question-bank-api.service';
import { QuestionTemplateApiService } from './question-template-api.service';
import { QuestionTemplatePage } from './question-template.page';

describe('QuestionTemplatePage', () => {
  it('creates a draft from selected Question Bank questions', async () => {
    const created = buildTemplate({ name: 'Delivery intake' });
    const api = {
      list: vi.fn().mockReturnValue(of([])),
      create: vi.fn().mockReturnValue(of(created)),
      updateDraft: vi.fn(),
      publish: vi.fn(),
    };
    const page = await renderPage(api);

    findButton(page.nativeElement, '[data-testid="new-question-template"]')?.click();
    page.fixture.detectChanges();
    setInput(page.nativeElement.querySelector('#question-template-name'), 'Delivery intake');
    const questionCheckbox = page.nativeElement.querySelector('.question-choice input') as HTMLInputElement;
    questionCheckbox.click();
    page.fixture.detectChanges();
    findButton(page.nativeElement, '[data-testid="save-question-template"]')?.click();
    await page.fixture.whenStable();

    expect(api.create).toHaveBeenCalledWith({
      name: 'Delivery intake',
      questions: [{ stableKey: 'general-001', required: true, blocking: true }],
    });
  });

  it('filters the Library by assigned Project name', async () => {
    const api = {
      list: vi.fn().mockReturnValue(of([
        buildTemplate({ name: 'Alpha intake', projectName: 'Alpha' }),
        buildTemplate({ id: '22222222-2222-4222-8222-222222222222', name: 'Beta intake', projectName: 'Beta' }),
      ])),
      create: vi.fn(), updateDraft: vi.fn(), publish: vi.fn(),
    };
    const page = await renderPage(api);
    const projectSelect = page.nativeElement.querySelectorAll('.browser-toolbar select')[0] as HTMLSelectElement;
    projectSelect.value = 'Beta';
    projectSelect.dispatchEvent(new Event('change'));
    page.fixture.detectChanges();

    expect(page.nativeElement.textContent).toContain('Beta intake');
    expect(page.nativeElement.textContent).not.toContain('Alpha intake');
  });
});

async function renderPage(api: object): Promise<{ fixture: ComponentFixture<QuestionTemplatePage>; nativeElement: HTMLElement }> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [QuestionTemplatePage],
    providers: [
      ...appConfig.providers,
      { provide: QuestionTemplateApiService, useValue: api },
      { provide: QuestionBankApiService, useValue: { loadBaseQuestionBank: vi.fn().mockReturnValue(of(buildBank())) } },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(QuestionTemplatePage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, nativeElement: fixture.nativeElement as HTMLElement };
}

function buildBank(): BaseQuestionBank {
  return {
    version: 1,
    questions: [{
      id: 'question-1', stableKey: 'general-001', bankVersion: 1, topic: 'Goals',
      controlPoint: 'Goal', text: 'What is the goal?', type: 'TEXT', required: true,
      requiredForEstimate: true, blocking: true, order: 1, active: true, hint: null,
      options: null, source: 'CANONICAL_SEED', publishedAt: '2026-08-24T00:00:00.000Z',
      referenceFiles: [],
    }],
  };
}

function buildTemplate(overrides: { id?: string; name: string; projectName?: string }): QuestionTemplateSummary {
  return {
    id: overrides.id ?? '11111111-1111-4111-8111-111111111111', name: overrides.name,
    draftQuestions: [{ stableKey: 'general-001', required: true, blocking: true }],
    latestPublishedVersion: null, latestPublishedQuestions: null, state: 'DRAFT',
    unavailableQuestionCount: 0,
    assignedProjects: overrides.projectName ? [{ projectId: overrides.id ?? 'project-1', projectName: overrides.projectName, schemaVersion: 1 }] : [],
    updatedAt: '2026-08-24T00:00:00.000Z',
  };
}

function findButton(root: HTMLElement, selector: string): HTMLButtonElement | null {
  return root.querySelector(selector)?.querySelector('button') ?? root.querySelector(selector);
}

function setInput(element: Element | null, value: string): void {
  const input = element as HTMLInputElement;
  input.value = value;
  input.dispatchEvent(new Event('input'));
}
