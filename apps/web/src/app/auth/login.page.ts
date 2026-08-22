import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { InputTextModule } from 'primeng/inputtext';
import { Observable } from 'rxjs';

import {
  AuthApiService,
  type Credentials,
  type InternalUser,
} from './auth-api.service';

type AuthMode = 'login' | 'signup' | 'restore';

@Component({
  selector: 'app-login-page',
  imports: [ButtonModule, CardModule, InputTextModule, ReactiveFormsModule],
  templateUrl: './login.page.html',
  styleUrl: './login.page.scss',
})
export class LoginPage implements OnInit {
  private readonly auth = inject(AuthApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = signal<AuthMode>('login');
  readonly pending = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly heading = computed(() => authModeText[this.mode()].heading);
  readonly description = computed(() => authModeText[this.mode()].description);
  readonly submitLabel = computed(() => authModeText[this.mode()].submitLabel);
  readonly authForm = new FormGroup({
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email, Validators.maxLength(320)],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(12), Validators.maxLength(128)],
    }),
  });

  ngOnInit(): void {
    if (this.auth.currentUser()) {
      void this.enterApp();
      return;
    }
    if (this.auth.currentUser() === undefined) {
      this.auth
        .loadSession()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({ next: (user) => user && void this.enterApp(), error: () => undefined });
    }
  }

  selectMode(mode: AuthMode): void {
    this.mode.set(mode);
    this.actionError.set(null);
  }

  submit(): void {
    this.authForm.markAllAsTouched();
    if (this.authForm.invalid || this.pending()) {
      return;
    }

    this.pending.set(true);
    this.actionError.set(null);
    const credentials = this.authForm.getRawValue();
    this.command(credentials)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.pending.set(false);
          void this.enterApp();
        },
        error: (error: Error) => {
          this.pending.set(false);
          this.actionError.set(error.message);
        },
      });
  }

  private command(credentials: Credentials): Observable<InternalUser> {
    if (this.mode() === 'signup') {
      return this.auth.signUp(credentials);
    }
    if (this.mode() === 'restore') {
      return this.auth.restore(credentials);
    }
    return this.auth.login(credentials);
  }

  private enterApp(): Promise<boolean> {
    const requested = this.route.snapshot.queryParamMap.get('returnUrl');
    const destination = requested?.startsWith('/') && !requested.startsWith('//') ? requested : '/';
    return this.router.navigateByUrl(destination);
  }
}

const authModeText: Record<
  AuthMode,
  { readonly heading: string; readonly description: string; readonly submitLabel: string }
> = {
  login: {
    heading: 'Sign in',
    description: 'Sign in with your email address and password to access internal project work.',
    submitLabel: 'Sign in',
  },
  signup: {
    heading: 'Create account',
    description: 'Create your Internal user account. No additional approval is required.',
    submitLabel: 'Create account',
  },
  restore: {
    heading: 'Restore account',
    description: 'Restore a previously deactivated account using its original email address and password.',
    submitLabel: 'Restore account',
  },
};
