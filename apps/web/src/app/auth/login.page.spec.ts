import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it, vi } from 'vitest';

import { AuthApiService } from './auth-api.service';
import { LoginPage } from './login.page';

describe('LoginPage', () => {
  it('starts with the Hungarian login form and enters the protected app after authentication', async () => {
    const user = { id: '11111111-1111-4111-8111-111111111111', email: 'po@example.test' };
    const auth = {
      currentUser: signal(undefined),
      loadSession: vi.fn().mockReturnValue(of(null)),
      login: vi.fn().mockReturnValue(of(user)),
      signUp: vi.fn(),
      restore: vi.fn(),
    };
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [provideRouter([]), { provide: AuthApiService, useValue: auth }],
    }).compileComponents();

    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    await fixture.whenStable();

    expect(fixture.nativeElement.querySelector('h1')?.textContent).toContain('Bejelentkezés');
    const email = fixture.nativeElement.querySelector('#auth-email') as HTMLInputElement;
    const password = fixture.nativeElement.querySelector('#auth-password') as HTMLInputElement;
    email.value = user.email;
    email.dispatchEvent(new Event('input'));
    password.value = 'biztonsagos-jelszo-42';
    password.dispatchEvent(new Event('input'));
    fixture.nativeElement
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await fixture.whenStable();

    expect(auth.login).toHaveBeenCalledWith({
      email: user.email,
      password: 'biztonsagos-jelszo-42',
    });
    expect(TestBed.inject(Router).url).toBe('/');
  });
});
