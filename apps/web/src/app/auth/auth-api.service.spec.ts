import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';

import { AuthApiService } from './auth-api.service';

describe('AuthApiService', () => {
  it('keeps the current internal user in sync with session, login, and logout', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const api = TestBed.inject(AuthApiService);
    const http = TestBed.inject(HttpTestingController);
    const user = { id: '11111111-1111-4111-8111-111111111111', email: 'po@example.test' };

    api.loadSession().subscribe();
    http.expectOne('/api/auth/session').flush(null);
    expect(api.currentUser()).toBeNull();

    api.login({ email: user.email, password: 'biztonsagos-jelszo-42' }).subscribe();
    http.expectOne('/api/auth/login').flush(user);
    expect(api.currentUser()).toEqual(user);

    api.logout().subscribe();
    http.expectOne('/api/auth/logout').flush(null);
    expect(api.currentUser()).toBeNull();
    http.verify();
  });
});
