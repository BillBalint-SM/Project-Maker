import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { CustomerMailTriageApiService } from './customer-mail-triage-api.service';
import { CustomerMailTriagePage } from './customer-mail-triage.page';

describe('CustomerMailTriagePage', () => {
  it('shows unmatched and mail-system work and dismisses only through an explicit action', async () => {
    const api = {
      view: vi.fn().mockReturnValue(of({
        unmatchedMessages: [{
          id: '11111111-1111-4111-8111-111111111111',
          kind: 'UNKNOWN_AUTOMATION',
          providerMessageReference: 'provider-1',
          receivedAt: '2026-08-18T17:00:00.000Z',
          senderAddress: 'automation@example.test',
          subject: 'Automatikus üzenet',
          visibleText: 'Ellenőrzendő automatikus levél.',
          quotedText: null,
          attachmentCount: 0,
          attachments: [],
          version: 1,
        }],
        mailSystemEvents: [{
          id: 'event-1',
          providerMessageReference: 'dsn-1',
          type: 'DELIVERY_REPORT',
          occurredAt: '2026-08-18T16:00:00.000Z',
          projectId: null,
          correspondenceId: null,
        }],
        eligibleCorrespondences: [],
      })),
      command: vi.fn().mockReturnValue(of({
        messageId: '11111111-1111-4111-8111-111111111111',
        state: 'DISMISSED',
        version: 2,
        projectId: null,
        correspondenceId: null,
      })),
    };
    await TestBed.configureTestingModule({
      imports: [CustomerMailTriagePage],
      providers: [
        provideRouter([]),
        { provide: CustomerMailTriageApiService, useValue: api },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(CustomerMailTriagePage);
    await fixture.whenStable();
    expect(fixture.nativeElement.textContent).toContain('Ellenőrzendő automatikus levél.');
    expect(fixture.nativeElement.textContent).toContain('Delivery report');

    const dismiss = fixture.nativeElement.querySelector(
      '[data-testid="dismiss-message-11111111-1111-4111-8111-111111111111"]',
    ) as HTMLButtonElement;
    dismiss.click();
    await fixture.whenStable();

    expect(api.command).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', {
      command: 'DISMISS',
      expectedVersion: 1,
    });
    expect(fixture.nativeElement.textContent).not.toContain('Ellenőrzendő automatikus levél.');
  });
});
