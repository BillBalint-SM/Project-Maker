import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { CustomerFollowUpState } from '@project-maker/contracts';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { CustomerFollowUpApiService } from './customer-follow-up-api.service';
import { CustomerFollowUpComponent } from './customer-follow-up.component';

const projectId = '11111111-1111-4111-8111-111111111111';

describe('CustomerFollowUpComponent', () => {
  it('requires a saved non-empty draft before automation can be enabled and links to its composer', async () => {
    const api = { load: vi.fn(() => of(followUpState({ messageDraft: null }))) };
    await TestBed.configureTestingModule({
      imports: [CustomerFollowUpComponent],
      providers: [provideRouter([]), { provide: CustomerFollowUpApiService, useValue: api }],
    }).compileComponents();
    const fixture = TestBed.createComponent(CustomerFollowUpComponent);
    fixture.componentRef.setInput('projectId', projectId);
    fixture.componentRef.setInput('archived', false);
    fixture.componentRef.setInput('mode', 'settings');

    fixture.detectChanges();
    await fixture.whenStable();

    const root = fixture.nativeElement as HTMLElement;
    expect((root.querySelector('[data-testid="follow-up-enabled-input"]') as HTMLInputElement).disabled)
      .toBe(true);
    const draftLink = root.querySelector('[data-testid="open-follow-up-draft-composer"]') as HTMLAnchorElement;
    expect(draftLink.href).toContain(`/projects/${projectId}/customer-correspondences#customer-communication`);
    expect(root.textContent).toContain('Save a non-empty Customer follow-up draft before enabling automation.');
  });
});

function followUpState(overrides: Partial<CustomerFollowUpState>): CustomerFollowUpState {
  return {
    projectId,
    messageDraft: 'Please send your feedback.',
    referencedFollowUpId: null,
    draftVersion: 1,
    enabled: false,
    intervalMinutes: 10_080,
    expiresAt: null,
    lastPingAt: null,
    nextPingAt: null,
    lastDeliveryStatus: 'NEVER',
    lastDeliveryError: null,
    latestManualAttempt: null,
    ...overrides,
  };
}
