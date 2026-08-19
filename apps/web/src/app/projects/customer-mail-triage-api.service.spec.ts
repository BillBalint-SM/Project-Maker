import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { CustomerMailTriageApiService } from './customer-mail-triage-api.service';

describe('CustomerMailTriageApiService', () => {
  it('loads triage work and sends an explicit idempotent command', async () => {
    TestBed.configureTestingModule({
      providers: [
        CustomerMailTriageApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    const api = TestBed.inject(CustomerMailTriageApiService);
    const http = TestBed.inject(HttpTestingController);

    const viewResult = firstValueFrom(api.view());
    http.expectOne('/api/customer-mail-triage').flush({
      unmatchedMessages: [],
      mailSystemEvents: [],
      eligibleCorrespondences: [],
    });
    await expect(viewResult).resolves.toEqual(expect.objectContaining({ unmatchedMessages: [] }));

    const commandResult = firstValueFrom(api.command('11111111-1111-4111-8111-111111111111', {
      command: 'DISMISS',
      expectedVersion: 1,
    }));
    const command = http.expectOne(
      '/api/customer-mail-triage/11111111-1111-4111-8111-111111111111/commands',
    );
    expect(command.request.method).toBe('POST');
    command.flush({
      messageId: '11111111-1111-4111-8111-111111111111',
      state: 'DISMISSED',
      version: 2,
      projectId: null,
      correspondenceId: null,
    });
    await expect(commandResult).resolves.toEqual(expect.objectContaining({ state: 'DISMISSED' }));
    http.verify();
  });
});
