import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import type { BaseQuestionBank } from '@project-maker/contracts';

import { appConfig } from '../app.config';
import { QuestionBankApiService } from './question-bank-api.service';
import { QuestionBankPage } from './question-bank.page';

describe('QuestionBankPage', () => {
  it('groups questions by published playbook and topic, then filters the browser locally', async () => {
    const bank: BaseQuestionBank = {
      version: 4,
      questions: [
        buildQuestion({ id: 'general-active', stableKey: 'general-001', text: 'Mi az üzleti cél?' }),
        buildQuestion({ id: 'general-inactive', stableKey: 'general-002', topic: 'Hatókör', text: 'Mi tartozik a hatókörbe?', active: false }),
        buildQuestion({ id: 'special-active', stableKey: 'special-001', topic: 'Hatókör', text: 'Milyen különleges korlát van?' }),
        buildQuestion({ id: 'unassigned', stableKey: 'custom-question', topic: 'Egyéb', text: 'Van további kérdés?' }),
      ],
    };
    const page = await renderQuestionBankPage(createApi(bank));

    expect(page.nativeElement.querySelector('[data-testid="question-playbook-group-general"]')).not.toBeNull();
    expect(page.nativeElement.querySelector('[data-testid="question-playbook-group-special"]')).not.toBeNull();
    expect(page.nativeElement.querySelector('[data-testid="question-playbook-group-UNASSIGNED"]')).not.toBeNull();

    const search = page.nativeElement.querySelector('[data-testid="question-bank-search"]') as HTMLInputElement;
    setInputValue(search, 'uzleti');
    page.fixture.detectChanges();

    expect(page.nativeElement.querySelector('[data-testid="base-question-general-active"]')).not.toBeNull();
    expect(page.nativeElement.querySelector('[data-testid="base-question-general-inactive"]')).toBeNull();

    setInputValue(search, '');
    (page.nativeElement.querySelector('[data-testid="question-status-inactive"]') as HTMLButtonElement).click();
    page.fixture.detectChanges();

    expect(page.nativeElement.querySelector('[data-testid="base-question-general-inactive"]')).not.toBeNull();
    expect(page.nativeElement.querySelector('[data-testid="base-question-general-active"]')).toBeNull();

    (page.nativeElement.querySelector('[data-testid="question-status-all"]') as HTMLButtonElement).click();
    const playbook = page.nativeElement.querySelector('[data-testid="question-bank-playbook-filter"]') as HTMLSelectElement;
    playbook.value = 'special';
    playbook.dispatchEvent(new Event('change'));
    page.fixture.detectChanges();

    expect(page.nativeElement.querySelector('[data-testid="base-question-special-active"]')).not.toBeNull();
    expect(page.nativeElement.querySelector('[data-testid="base-question-general-active"]')).toBeNull();
  });

  it('edits a base question inside its own card without moving to a page-top form', async () => {
    const initialBank: BaseQuestionBank = { version: 4, questions: [buildQuestion({})] };
    const publishedBank: BaseQuestionBank = {
      version: 5,
      questions: [buildQuestion({ text: 'Módosított kérdés' })],
    };
    const api = createApi(initialBank, publishedBank);
    const page = await renderQuestionBankPage(api);
    const article = page.nativeElement.querySelector('[data-testid="base-question-question-1"]') as HTMLElement;

    button(page.nativeElement, '[data-testid="edit-base-question-question-1"]')?.click();
    page.fixture.detectChanges();
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    const editor = article.querySelector('[data-testid="base-question-form"]');
    const questionText = article.querySelector('[data-testid="base-question-text"]') as HTMLTextAreaElement;
    expect(editor).not.toBeNull();
    expect(questionText.value).toBe('Mi a projekt üzleti célja?');
    expect(document.activeElement).toBe(questionText);

    setInputValue(questionText, 'Módosított kérdés');
    button(article, '[data-testid="save-base-question-button"]')?.click();
    await page.fixture.whenStable();
    page.fixture.detectChanges();

    expect(api.updateBaseQuestion).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'question-1', text: 'Módosított kérdés' }),
    );
    expect(page.nativeElement.textContent).toContain('Módosított kérdés');
    expect(page.nativeElement.querySelector('[data-testid="base-question-form"]')).toBeNull();
    expect(document.activeElement).toBe(
      button(page.nativeElement, '[data-testid="edit-base-question-question-1"]'),
    );
  });

  it('uploads a selected reference file and renders the returned published reference-file list', async () => {
    const initialBank = bankWithReferenceFiles([]);
    const publishedBank = bankWithReferenceFiles([
      {
        id: 'reference-file-1',
        originalName: 'felmérési-irányelvek.txt',
        contentType: 'text/plain',
        sizeBytes: 18,
        sha256: 'a'.repeat(64),
        createdAt: '2026-08-22T10:00:00.000Z',
      },
    ]);
    const api = {
      loadBaseQuestionBank: vi.fn().mockReturnValue(of(initialBank)),
      loadPlaybooks: vi.fn().mockReturnValue(of(playbooks)),
      createBaseQuestion: vi.fn(),
      updateBaseQuestion: vi.fn(),
      addReferenceFile: vi.fn().mockReturnValue(of(publishedBank)),
      removeReferenceFile: vi.fn(),
      referenceFileDownloadUrl: vi.fn(() => '/api/reference-file-1/download'),
    };
    const page = await renderQuestionBankPage(api);
    const file = new File(['irányelvek'], 'felmérési-irányelvek.txt', {
      type: 'text/plain',
    });
    const fileInput = page.nativeElement.querySelector(
      '[data-testid="question-reference-file-question-1"]',
    ) as HTMLInputElement;

    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    fileInput.dispatchEvent(new Event('change'));
    page.fixture.detectChanges();

    const addButton = button(
      page.nativeElement,
      '[data-testid="add-question-reference-question-1"]',
    );
    expect(addButton?.disabled).toBe(false);
    addButton?.click();
    page.fixture.detectChanges();

    expect(api.addReferenceFile).toHaveBeenCalledWith('question-1', file);
    expect(page.nativeElement.textContent).toContain('felmérési-irányelvek.txt');
    const download = page.nativeElement.querySelector('a[href="/api/reference-file-1/download"]');
    expect(download?.textContent?.trim()).toBe('Download');
  });
});

async function renderQuestionBankPage(api: {
  readonly loadBaseQuestionBank: ReturnType<typeof vi.fn>;
  readonly loadPlaybooks: ReturnType<typeof vi.fn>;
  readonly createBaseQuestion: ReturnType<typeof vi.fn>;
  readonly updateBaseQuestion: ReturnType<typeof vi.fn>;
  readonly addReferenceFile: ReturnType<typeof vi.fn>;
  readonly removeReferenceFile: ReturnType<typeof vi.fn>;
  readonly referenceFileDownloadUrl: ReturnType<typeof vi.fn>;
}): Promise<{ readonly fixture: ComponentFixture<QuestionBankPage>; readonly nativeElement: HTMLElement }> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [QuestionBankPage],
    providers: [
      ...appConfig.providers,
      { provide: QuestionBankApiService, useValue: api },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(QuestionBankPage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, nativeElement: fixture.nativeElement as HTMLElement };
}

function bankWithReferenceFiles(referenceFiles: BaseQuestionBank['questions'][number]['referenceFiles']): BaseQuestionBank {
  return {
    version: referenceFiles.length === 0 ? 4 : 5,
    questions: [buildQuestion({
      bankVersion: referenceFiles.length === 0 ? 4 : 5,
      referenceFiles,
    })],
  };
}

const playbooks = [
  { id: 'general', version: 1, name: 'General project' },
  { id: 'special', version: 1, name: 'Special project' },
] as const;

function createApi(bank: BaseQuestionBank, updatedBank = bank) {
  return {
    loadBaseQuestionBank: vi.fn().mockReturnValue(of(bank)),
    loadPlaybooks: vi.fn().mockReturnValue(of(playbooks)),
    createBaseQuestion: vi.fn(),
    updateBaseQuestion: vi.fn().mockReturnValue(of(updatedBank)),
    addReferenceFile: vi.fn(),
    removeReferenceFile: vi.fn(),
    referenceFileDownloadUrl: vi.fn((questionId: string, fileId: string) => `/api/${questionId}/${fileId}/download`),
  };
}

function buildQuestion(
  overrides: Partial<BaseQuestionBank['questions'][number]>,
): BaseQuestionBank['questions'][number] {
  return {
    id: 'question-1',
    stableKey: 'general-001',
    bankVersion: 4,
    topic: 'Cél',
    controlPoint: 'Projektcél',
    text: 'Mi a projekt üzleti célja?',
    type: 'TEXT',
    required: true,
    requiredForEstimate: false,
    blocking: false,
    order: 1,
    active: true,
    hint: null,
    options: null,
    source: 'SETTINGS_API',
    publishedAt: '2026-08-22T10:00:00.000Z',
    referenceFiles: [],
    ...overrides,
  };
}

function setInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  input.value = value;
  input.dispatchEvent(new Event('input'));
}

function button(root: HTMLElement, selector: string): HTMLButtonElement | null {
  return root.querySelector(selector)?.querySelector('button') as HTMLButtonElement | null;
}
