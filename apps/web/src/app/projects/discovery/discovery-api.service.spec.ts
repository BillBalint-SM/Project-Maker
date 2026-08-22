import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { DiscoveryApiService } from './discovery-api.service';

describe('DiscoveryApiService', () => {
  it('uses professional English for Project contact and Insight save failures', async () => {
    TestBed.configureTestingModule({ providers: [DiscoveryApiService, provideHttpClient(), provideHttpClientTesting()] });
    const api = TestBed.inject(DiscoveryApiService); const http = TestBed.inject(HttpTestingController);
    const projectId = '11111111-1111-4111-8111-111111111111'; const itemId = '22222222-2222-4222-8222-222222222222';
    const contact = firstValueFrom(api.updateContact(projectId, itemId, {} as never));
    http.expectOne(`/api/projects/${projectId}/contacts/${itemId}`).flush({}, { status: 500, statusText: 'Error' });
    await expect(contact).rejects.toThrow('Unable to save the Project contact.');
    const insight = firstValueFrom(api.createInsight(projectId, {} as never));
    http.expectOne(`/api/projects/${projectId}/insights`).flush({}, { status: 500, statusText: 'Error' });
    await expect(insight).rejects.toThrow('Unable to save the Insight.'); http.verify();
  });
});
