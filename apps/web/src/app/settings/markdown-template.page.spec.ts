import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';
import { of } from 'rxjs';

import { appConfig } from '../app.config';
import { MarkdownTemplateApiService } from './markdown-template-api.service';
import { MarkdownTemplatePage } from './markdown-template.page';

describe('MarkdownTemplatePage', () => {
  it('blocks a whitespace-only template name and explains that a name is required', async () => {
    const api = {
      list: vi.fn().mockReturnValue(of([])),
      create: vi.fn(),
      update: vi.fn(),
      preview: vi.fn(),
      publish: vi.fn(),
    };
    const fixture = await renderMarkdownTemplatePage(api);

    fixture.componentInstance.newTemplate();
    fixture.componentInstance.form.controls.name.setValue('   ');
    fixture.componentInstance.form.controls.name.markAsTouched();
    fixture.detectChanges();

    const root = fixture.nativeElement as HTMLElement;
    expect(
      root.querySelector('[data-testid="markdown-template-name-error"]')?.textContent,
    ).toContain('Template name is required.');
    expect(
      root.querySelector('[data-testid="save-markdown-template-button"] button'),
    ).toHaveProperty('disabled', true);

    fixture.componentInstance.save();
    expect(api.create).not.toHaveBeenCalled();
  });
});

async function renderMarkdownTemplatePage(api: {
  readonly list: ReturnType<typeof vi.fn>;
  readonly create: ReturnType<typeof vi.fn>;
  readonly update: ReturnType<typeof vi.fn>;
  readonly preview: ReturnType<typeof vi.fn>;
  readonly publish: ReturnType<typeof vi.fn>;
}): Promise<ComponentFixture<MarkdownTemplatePage>> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [MarkdownTemplatePage],
    providers: [
      ...appConfig.providers,
      { provide: MarkdownTemplateApiService, useValue: api },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(MarkdownTemplatePage);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}
