import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { AuthApiService } from '../auth/auth-api.service';
import { CustomerRepliesApiService } from './customer-replies-api.service';

describe('CustomerRepliesApiService', () => {
  it('publishes summary changes only for the session that started the request', async () => {
    const currentUser = signal({ id: 'user-a', email: 'a@example.test' });
    TestBed.configureTestingModule({
      providers: [
        CustomerRepliesApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthApiService, useValue: { currentUser } },
      ],
    });
    const api = TestBed.inject(CustomerRepliesApiService);
    const http = TestBed.inject(HttpTestingController);
    const updates: unknown[] = [];
    api.summaryChanges.subscribe((update) => updates.push(update));

    const staleRequest = firstValueFrom(api.summary());
    currentUser.set({ id: 'user-b', email: 'b@example.test' });
    http.expectOne('/api/customer-correspondences/summary').flush({
      newReplyCount: 9,
      projectCount: 1,
      projects: [],
    });
    await staleRequest;
    expect(updates).toEqual([]);

    const currentRequest = firstValueFrom(api.summary());
    http.expectOne('/api/customer-correspondences/summary').flush({
      newReplyCount: 2,
      projectCount: 1,
      projects: [],
    });
    await currentRequest;
    expect(updates).toEqual([
      {
        userId: 'user-b',
        summary: { newReplyCount: 2, projectCount: 1, projects: [] },
      },
    ]);
    http.verify();
  });
});
