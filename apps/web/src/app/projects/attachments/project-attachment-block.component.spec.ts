import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { appConfig } from '../../app.config';
import { ProjectAttachmentBlockComponent } from './project-attachment-block.component';
import { ProjectAttachmentsApiService } from './project-attachments-api.service';

describe('ProjectAttachmentBlockComponent', () => {
  it('keeps retained files downloadable without mutation controls for a read-only owner', async () => {
    const page = await renderAttachmentBlock(false);

    const download = page.nativeElement.querySelector(
      '[data-testid="download-project-attachment-attachment-1"]',
    ) as HTMLAnchorElement | null;
    expect(download?.textContent?.trim()).toBe('Letöltés');
    expect(download?.getAttribute('href')).toBe(
      '/api/projects/project-1/attachments/attachment-1/download',
    );
    expect(page.nativeElement.querySelector('[data-testid="project-attachment-file"]'))
      .toBeNull();
    expect(page.nativeElement.querySelector('[data-testid="remove-project-attachment-attachment-1"]'))
      .toBeNull();
  });

  it('uploads and only removes after explicit confirmation for a mutable owner', async () => {
    const page = await renderAttachmentBlock(true);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    const remove = button(
      page.nativeElement,
      '[data-testid="remove-project-attachment-attachment-1"]',
    );

    remove?.click();
    expect(page.api.remove).not.toHaveBeenCalled();
    remove?.click();
    expect(page.api.remove).toHaveBeenCalledWith('project-1', 'attachment-1');

    const fileInput = page.nativeElement.querySelector(
      '[data-testid="project-attachment-file"]',
    ) as HTMLInputElement;
    const file = new File(['scope'], 'ügyfél-igény.txt', { type: 'text/plain' });
    Object.defineProperty(fileInput, 'files', { configurable: true, value: [file] });
    fileInput.dispatchEvent(new Event('change'));
    page.fixture.detectChanges();
    button(page.nativeElement, '[data-testid="upload-project-attachment"]')?.click();

    expect(page.api.upload).toHaveBeenCalledWith(
      'project-1',
      'DISCOVERY_FOLLOW_UP',
      'follow-up-1',
      file,
    );
    expect(page.changed).toHaveBeenCalledTimes(2);
    confirm.mockRestore();
  });
});

async function renderAttachmentBlock(mutable: boolean): Promise<{
  readonly fixture: ComponentFixture<ProjectAttachmentBlockComponent>;
  readonly nativeElement: HTMLElement;
  readonly api: {
    readonly upload: ReturnType<typeof vi.fn>;
    readonly remove: ReturnType<typeof vi.fn>;
    readonly downloadUrl: ReturnType<typeof vi.fn>;
  };
  readonly changed: ReturnType<typeof vi.fn>;
}> {
  const api = {
    upload: vi.fn().mockReturnValue(of({})),
    remove: vi.fn().mockReturnValue(of(undefined)),
    downloadUrl: vi.fn((projectId: string, attachmentId: string) =>
      `/api/projects/${projectId}/attachments/${attachmentId}/download`),
  };
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    imports: [ProjectAttachmentBlockComponent],
    providers: [
      ...appConfig.providers,
      { provide: ProjectAttachmentsApiService, useValue: api },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(ProjectAttachmentBlockComponent);
  fixture.componentRef.setInput('projectId', 'project-1');
  fixture.componentRef.setInput('ownerKind', 'DISCOVERY_FOLLOW_UP');
  fixture.componentRef.setInput('ownerId', 'follow-up-1');
  fixture.componentRef.setInput('mutable', mutable);
  fixture.componentRef.setInput('attachments', [{
    id: 'attachment-1',
    projectId: 'project-1',
    ownerKind: 'DISCOVERY_FOLLOW_UP',
    ownerId: 'follow-up-1',
    originalName: 'forrás.txt',
    contentType: 'text/plain',
    sizeBytes: 6,
    sha256: 'a'.repeat(64),
    createdAt: '2026-08-22T10:00:00.000Z',
  }]);
  const changed = vi.fn();
  fixture.componentInstance.changed.subscribe(changed);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return { fixture, nativeElement: fixture.nativeElement as HTMLElement, api, changed };
}

function button(root: HTMLElement, selector: string): HTMLButtonElement | null {
  return root.querySelector(selector)?.querySelector('button') as HTMLButtonElement | null;
}
