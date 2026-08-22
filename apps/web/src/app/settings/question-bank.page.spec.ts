import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';
import type { BaseQuestionBank } from '@project-maker/contracts';

import { appConfig } from '../app.config';
import { QuestionBankApiService } from './question-bank-api.service';
import { QuestionBankPage } from './question-bank.page';

describe('QuestionBankPage', () => {
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
    questions: [{
      id: 'question-1',
      stableKey: 'general-001',
      bankVersion: referenceFiles.length === 0 ? 4 : 5,
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
      referenceFiles,
    }],
  };
}

function button(root: HTMLElement, selector: string): HTMLButtonElement | null {
  return root.querySelector(selector)?.querySelector('button') as HTMLButtonElement | null;
}
