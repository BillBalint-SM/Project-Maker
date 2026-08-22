import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describe, expect, it } from 'vitest';

import { AuthApiService } from '../auth/auth-api.service';
import { NotificationsApiService } from './notifications-api.service';

describe('NotificationsApiService', () => {
  it('retains only a result from the session that started the request', async () => {
    const currentUser = signal({ id: 'user-a', email: 'a@example.test' });
    TestBed.configureTestingModule({
      providers: [
        NotificationsApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AuthApiService, useValue: { currentUser } },
      ],
    });
    const api = TestBed.inject(NotificationsApiService);
    const http = TestBed.inject(HttpTestingController);

    const staleRequest = firstValueFrom(api.load());
    currentUser.set({ id: 'user-b', email: 'b@example.test' });
    http.expectOne('/api/notifications').flush({ items: [], totalCount: 9 });
    await staleRequest;
    expect(api.current()).toBeNull();

    const currentRequest = firstValueFrom(api.load());
    http.expectOne('/api/notifications').flush({ items: [], totalCount: 2 });
    await currentRequest;
    expect(api.current()).toEqual({
      userId: 'user-b',
      notifications: { items: [], totalCount: 2 },
    });
    http.verify();
  });
});
