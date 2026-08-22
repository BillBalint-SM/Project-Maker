import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { DeliveryApiService } from './delivery-api.service';

describe('DeliveryApiService', () => {
  it('returns a nullable package response and uses professional English for Git setup failures', async () => {
    TestBed.configureTestingModule({ providers: [DeliveryApiService, provideHttpClient(), provideHttpClientTesting()] });
    const api = TestBed.inject(DeliveryApiService); const http = TestBed.inject(HttpTestingController);
    const id = '11111111-1111-4111-8111-111111111111';
    const absent = firstValueFrom(api.loadPackage(id)); http.expectOne(`/api/projects/${id}/delivery-package`).flush(null);
    await expect(absent).resolves.toBeNull();
    const failed = firstValueFrom(api.updateGitSetup(id, {} as never));
    http.expectOne(`/api/git-setups/${id}`).flush({}, { status: 500, statusText: 'Error' });
    await expect(failed).rejects.toThrow('Unable to save the Git setup. Refresh the page and try again.'); http.verify();
  });
});
