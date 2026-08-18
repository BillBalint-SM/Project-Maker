import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { CustomerCorrespondencesPage } from './customer-correspondences.page';
import { CustomerRepliesApiService } from './customer-replies-api.service';

describe('CustomerCorrespondencesPage', () => {
  it('renders reply text safely and keeps quoted history collapsed', async () => {
    const correspondence = {
      id: 'correspondence-1', status: 'Új válasz' as const, unreadMessageCount: 1, processingVersion: 1,
      messages: [{
        id: 'message-1', providerMessageReference: 'provider-1', internetMessageId: null,
        receivedAt: '2026-08-18T14:00:00.000Z', senderAddress: 'other@example.test',
        senderClassification: 'UNRECOGNIZED' as const, recipientAddresses: ['project-maker+token@pte.hu'],
        subject: 'Válasz', textContent: '<img src=x onerror=steal()>',
        visibleText: '<img src=x onerror=steal()>', quotedText: 'On Monday wrote:\nRégi szöveg',
        attachmentCount: 0, attachments: [], correlationEvidence: 'TOKENIZED_REPLY_TO' as const,
        classification: null,
      }],
    };
    const work = { newReplyCount: 1, correspondences: [correspondence] };
    const command = vi.fn()
      .mockReturnValueOnce(throwError(() => new Error('rejected')))
      .mockReturnValue(of({ ...correspondence, unreadMessageCount: 0, processingVersion: 2 }));
    const summary = vi.fn(() => of({ newReplyCount: 0, projectCount: 0, projects: [] }));
    await TestBed.configureTestingModule({
      imports: [CustomerCorrespondencesPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'project-1' } } } },
        {
          provide: CustomerRepliesApiService,
          useValue: { command, summary, forProject: () => of(work) },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(CustomerCorrespondencesPage);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.message-text')?.textContent).toContain('<img src=x onerror=steal()>');
    expect(fixture.nativeElement.querySelector('.message-text img')).toBeNull();
    expect((fixture.nativeElement.querySelector('details') as HTMLDetailsElement).open).toBe(false);
    expect(fixture.nativeElement.textContent).toContain('Nem felismert Customer válaszfeladó');
    const close = Array.from(fixture.nativeElement.querySelectorAll('button'))
      .find((button) => (button as HTMLButtonElement).textContent?.trim() === 'Lezárás') as HTMLButtonElement;
    close.click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain('Töltsd újra az adatokat');
    expect(fixture.nativeElement.querySelector('.message-text')?.textContent).toContain('<img src=x onerror=steal()>');
    expect(fixture.nativeElement.textContent).toContain('Adatok újratöltése');
    const reviewed = fixture.nativeElement.querySelector('[data-testid="mark-reviewed-correspondence-1"]') as HTMLButtonElement;
    expect(reviewed).not.toBeNull();
    reviewed.click();
    expect(command).toHaveBeenCalledWith('project-1', 'correspondence-1', {
      command: 'MARK_REVIEWED', expectedVersion: 1,
    });
    expect(summary).toHaveBeenCalledTimes(1);
    const classification = fixture.nativeElement.querySelector('[data-testid="classification-message-1"]') as HTMLSelectElement;
    expect(Array.from(classification.options).map((option) => option.text)).toEqual([
      'Válassz besorolást', 'Elfogadva', 'Módosítást kér', 'Kérdés vagy válasz', 'Egyéb',
    ]);
  });
});
