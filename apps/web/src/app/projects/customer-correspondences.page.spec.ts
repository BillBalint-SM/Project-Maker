import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { CustomerCorrespondencesPage } from './customer-correspondences.page';
import { CustomerRepliesApiService } from './customer-replies-api.service';

describe('CustomerCorrespondencesPage', () => {
  it('renders reply text safely and keeps quoted history collapsed', async () => {
    const command = vi.fn(() => of({
      id: 'correspondence-1', status: 'Új válasz' as const, unreadMessageCount: 0,
      processingVersion: 2, messages: [],
    }));
    await TestBed.configureTestingModule({
      imports: [CustomerCorrespondencesPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'project-1' } } } },
        {
          provide: CustomerRepliesApiService,
          useValue: { command, forProject: () => of({
            newReplyCount: 1,
            correspondences: [{
              id: 'correspondence-1', status: 'Új válasz', unreadMessageCount: 1, processingVersion: 1,
              messages: [{
                id: 'message-1', providerMessageReference: 'provider-1', internetMessageId: null,
                receivedAt: '2026-08-18T14:00:00.000Z', senderAddress: 'other@example.test',
                senderClassification: 'UNRECOGNIZED', recipientAddresses: ['project-maker+token@pte.hu'],
                subject: 'Válasz', textContent: '<img src=x onerror=steal()>',
                visibleText: '<img src=x onerror=steal()>', quotedText: 'On Monday wrote:\nRégi szöveg',
                attachmentCount: 0, attachments: [], correlationEvidence: 'TOKENIZED_REPLY_TO',
                classification: null,
              }],
            }],
          }) },
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
    const reviewed = fixture.nativeElement.querySelector('[data-testid="mark-reviewed-correspondence-1"]') as HTMLButtonElement;
    expect(reviewed).not.toBeNull();
    reviewed.click();
    expect(command).toHaveBeenCalledWith('project-1', 'correspondence-1', {
      command: 'MARK_REVIEWED', expectedVersion: 1,
    });
    const classification = fixture.nativeElement.querySelector('[data-testid="classification-message-1"]') as HTMLSelectElement;
    expect(Array.from(classification.options).map((option) => option.text)).toEqual([
      'Válassz besorolást', 'Elfogadva', 'Módosítást kér', 'Kérdés vagy válasz', 'Egyéb',
    ]);
  });
});
