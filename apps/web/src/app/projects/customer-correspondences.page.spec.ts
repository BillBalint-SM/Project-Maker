import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { CustomerCorrespondencesPage } from './customer-correspondences.page';
import { CustomerRepliesApiService } from './customer-replies-api.service';

describe('CustomerCorrespondencesPage', () => {
  it('renders reply text safely and keeps quoted history collapsed', async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerCorrespondencesPage],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'project-1' } } } },
        {
          provide: CustomerRepliesApiService,
          useValue: { forProject: () => of({
            newReplyCount: 1,
            correspondences: [{
              id: 'correspondence-1', status: 'Új válasz', unreadMessageCount: 1,
              messages: [{
                id: 'message-1', providerMessageReference: 'provider-1', internetMessageId: null,
                receivedAt: '2026-08-18T14:00:00.000Z', senderAddress: 'other@example.test',
                senderClassification: 'UNRECOGNIZED', recipientAddresses: ['project-maker+token@pte.hu'],
                subject: 'Válasz', textContent: '<img src=x onerror=steal()>',
                visibleText: '<img src=x onerror=steal()>', quotedText: 'On Monday wrote:\nRégi szöveg',
                attachmentCount: 0, attachments: [], correlationEvidence: 'TOKENIZED_REPLY_TO',
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
  });
});
